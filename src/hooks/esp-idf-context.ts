import { existsSync } from "fs"
import { join } from "path"
import { readFile } from "fs/promises"

type ToolExecuteBeforeInput = {
  tool: string
  args: Record<string, unknown>
}

type ToolExecuteBeforeOutput = {
  args: Record<string, unknown>
}

interface SdkConfig {
  target?: string
  flashSize?: string
  psramEnabled?: boolean
  wifiEnabled?: boolean
  btEnabled?: boolean
  bleEnabled?: boolean
  partitionTable?: string
  freertosHz?: number
}

async function parseSdkConfig(directory: string): Promise<SdkConfig | null> {
  const sdkconfigPath = join(directory, "sdkconfig")
  if (!existsSync(sdkconfigPath)) return null

  try {
    const content = await readFile(sdkconfigPath, "utf-8")
    const lines = content.split("\n")
    const config: SdkConfig = {}

    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed.startsWith("#") || !trimmed.includes("=")) continue

      const [key, value] = trimmed.split("=", 2)

      switch (key) {
        case "CONFIG_IDF_TARGET":
          config.target = value.replace(/"/g, "")
          break
        case "CONFIG_ESPTOOLPY_FLASHSIZE":
          config.flashSize = value.replace(/"/g, "")
          break
        case "CONFIG_ESP32_SPIRAM_SUPPORT":
        case "CONFIG_SPIRAM":
          config.psramEnabled = value === "y"
          break
        case "CONFIG_ESP_WIFI_ENABLED":
          config.wifiEnabled = value === "y"
          break
        case "CONFIG_BT_ENABLED":
          config.btEnabled = value === "y"
          break
        case "CONFIG_BT_NIMBLE_ENABLED":
          config.bleEnabled = value === "y"
          break
        case "CONFIG_PARTITION_TABLE_CUSTOM_FILENAME":
          config.partitionTable = value.replace(/"/g, "")
          break
        case "CONFIG_FREERTOS_HZ":
          config.freertosHz = parseInt(value, 10)
          break
      }
    }

    return config
  } catch {
    return null
  }
}

async function parsePartitionTable(
  directory: string,
  filename?: string
): Promise<string | null> {
  const csvPath = join(directory, filename ?? "partitions.csv")
  if (!existsSync(csvPath)) return null

  try {
    const content = await readFile(csvPath, "utf-8")
    return content
  } catch {
    return null
  }
}

export function createEspIdfContextHook(ctx: { directory: string }) {
  let sdkConfig: SdkConfig | null = null
  let contextInjected = false

  return {
    async beforeToolExecute(
      _input: ToolExecuteBeforeInput,
      _output: ToolExecuteBeforeOutput
    ) {
      if (contextInjected) return

      const sdkconfigPath = join(ctx.directory, "sdkconfig")
      if (!existsSync(sdkconfigPath)) return

      sdkConfig = await parseSdkConfig(ctx.directory)
      if (!sdkConfig) return

      const partitions = await parsePartitionTable(
        ctx.directory,
        sdkConfig.partitionTable
      )

      const contextParts: string[] = [
        "## ESP-IDF Project Context (auto-detected by oh-my-embedded)",
        "",
        `- **Target**: ${sdkConfig.target ?? "unknown"}`,
        `- **Flash**: ${sdkConfig.flashSize ?? "unknown"}`,
        `- **PSRAM**: ${sdkConfig.psramEnabled ? "Enabled" : "Disabled"}`,
        `- **WiFi**: ${sdkConfig.wifiEnabled ? "Enabled" : "Disabled"}`,
        `- **Bluetooth**: ${sdkConfig.btEnabled ? "Enabled" : "Disabled"}`,
        `- **BLE (NimBLE)**: ${sdkConfig.bleEnabled ? "Enabled" : "Disabled"}`,
        `- **FreeRTOS tick rate**: ${sdkConfig.freertosHz ?? 100}Hz`,
      ]

      if (partitions) {
        contextParts.push("", "### Partition Table", "```", partitions.trim(), "```")
      }

      if (sdkConfig.wifiEnabled && sdkConfig.target === "esp32") {
        contextParts.push(
          "",
          "### Important: ADC2 + WiFi Conflict",
          "ADC2 channels (GPIO 0,2,4,12-15,25-27) **cannot be used while WiFi is active**.",
          "Use ADC1 channels (GPIO 32-39) for analog reads in WiFi projects."
        )
      }

      console.error(`[oh-my-embedded] ESP-IDF context: ${sdkConfig.target}, flash=${sdkConfig.flashSize}`)
      contextInjected = true
    },

    getSdkConfig(): SdkConfig | null {
      return sdkConfig
    },
  }
}

import { tool } from "@opencode-ai/plugin"

interface PinInfo {
  gpio: number
  functions: string[]
  adc?: string
  dac?: string
  touch?: string
  strapping?: boolean
  input_only?: boolean
  notes?: string
}

// ESP32 (classic) pin map
const ESP32_PINS: PinInfo[] = [
  { gpio: 0, functions: ["GPIO", "CLK_OUT1", "EMAC_TX_CLK"], touch: "T1", strapping: true, notes: "Boot mode select. Pull-up. LOW=download mode." },
  { gpio: 1, functions: ["GPIO", "U0TXD", "CLK_OUT3", "EMAC_RXD2"], notes: "UART0 TX (default console). Avoid for general use." },
  { gpio: 2, functions: ["GPIO", "HSPIWP", "HS2_DATA0", "SD_DATA0"], adc: "ADC2_CH2", touch: "T2", strapping: true, notes: "Must be LOW or floating for flash boot." },
  { gpio: 3, functions: ["GPIO", "U0RXD", "CLK_OUT2"], notes: "UART0 RX (default console). Avoid for general use." },
  { gpio: 4, functions: ["GPIO", "HSPIHD", "HS2_DATA1", "SD_DATA1", "EMAC_TX_ER"], adc: "ADC2_CH0", touch: "T0" },
  { gpio: 5, functions: ["GPIO", "VSPICS0", "HS1_DATA6", "EMAC_RX_CLK"], strapping: true, notes: "Strapping pin. HIGH at boot for SPI flash timing." },
  { gpio: 12, functions: ["GPIO", "HSPIQ", "HS2_DATA2", "SD_DATA2", "MTDI"], adc: "ADC2_CH5", touch: "T5", strapping: true, notes: "MTDI strapping. Sets flash voltage. Do NOT pull high if using 3.3V flash." },
  { gpio: 13, functions: ["GPIO", "HSPID", "HS2_DATA3", "SD_DATA3", "MTCK"], adc: "ADC2_CH4", touch: "T4" },
  { gpio: 14, functions: ["GPIO", "HSPICLK", "HS2_CLK", "SD_CLK", "MTMS"], adc: "ADC2_CH6", touch: "T6", notes: "Outputs PWM at boot." },
  { gpio: 15, functions: ["GPIO", "HSPICS0", "HS2_CMD", "SD_CMD", "MTDO"], adc: "ADC2_CH3", touch: "T3", strapping: true, notes: "Strapping pin. Controls UART0 debug output at boot." },
  { gpio: 16, functions: ["GPIO", "HS1_DATA4", "U2RXD", "EMAC_CLK_OUT"], notes: "OK for general use. Used by PSRAM on WROVER modules." },
  { gpio: 17, functions: ["GPIO", "HS1_DATA5", "U2TXD", "EMAC_CLK_OUT_180"], notes: "OK for general use. Used by PSRAM on WROVER modules." },
  { gpio: 18, functions: ["GPIO", "VSPICLK", "HS1_DATA7"] },
  { gpio: 19, functions: ["GPIO", "VSPIQ", "U0CTS", "EMAC_TXD0"] },
  { gpio: 21, functions: ["GPIO", "VSPIHD", "EMAC_TX_EN"], notes: "Default I2C SDA." },
  { gpio: 22, functions: ["GPIO", "VSPIWP", "U0RTS", "EMAC_TXD1"], notes: "Default I2C SCL." },
  { gpio: 23, functions: ["GPIO", "VSPID", "HS1_STROBE"] },
  { gpio: 25, functions: ["GPIO", "EMAC_RXD0"], adc: "ADC2_CH8", dac: "DAC1" },
  { gpio: 26, functions: ["GPIO", "EMAC_RXD1"], adc: "ADC2_CH9", dac: "DAC2" },
  { gpio: 27, functions: ["GPIO", "EMAC_RX_DV"], adc: "ADC2_CH7", touch: "T7" },
  { gpio: 32, functions: ["GPIO", "XTAL_32K_P"], adc: "ADC1_CH4", touch: "T9", notes: "32kHz crystal if RTC needed." },
  { gpio: 33, functions: ["GPIO", "XTAL_32K_N"], adc: "ADC1_CH5", touch: "T8", notes: "32kHz crystal if RTC needed." },
  { gpio: 34, functions: ["GPIO"], adc: "ADC1_CH6", input_only: true, notes: "Input only. No pullup/pulldown." },
  { gpio: 35, functions: ["GPIO"], adc: "ADC1_CH7", input_only: true, notes: "Input only. No pullup/pulldown." },
  { gpio: 36, functions: ["GPIO", "SENSOR_VP"], adc: "ADC1_CH0", input_only: true, notes: "Input only (SVP). No pullup/pulldown." },
  { gpio: 39, functions: ["GPIO", "SENSOR_VN"], adc: "ADC1_CH3", input_only: true, notes: "Input only (SVN). No pullup/pulldown." },
]

export const pinMapper = tool({
  description:
    "ESP32 pin mapping tool. Find available GPIO pins by function (SPI, I2C, ADC, DAC, Touch, UART), check pin conflicts, identify strapping pins, and get pin assignment recommendations.",
  args: {
    action: tool.schema
      .string()
      .describe(
        '"find" = find pins by function, "check" = check pin assignment for conflicts, "available" = list all available pins, "info" = get details on a specific GPIO'
      ),
    function_filter: tool.schema
      .string()
      .optional()
      .describe('Filter by function: "adc", "dac", "touch", "spi", "i2c", "uart", "input_only", "safe" (no strapping pins)'),
    gpio: tool.schema
      .number()
      .optional()
      .describe("GPIO number for info action"),
    assigned_pins: tool.schema
      .string()
      .optional()
      .describe('JSON array of already assigned pins for conflict check. Format: [{"gpio": 18, "use": "SPI_CLK"}, ...]'),
    mcu: tool.schema
      .string()
      .optional()
      .describe('MCU variant: "esp32" (default), "esp32s3", "esp32c3". Currently ESP32 classic is fully supported.'),
  },
  async execute(args) {
    switch (args.action) {
      case "find":
        return JSON.stringify(findPins(args.function_filter ?? "safe"), null, 2)
      case "check":
        return JSON.stringify(checkConflicts(args.assigned_pins ?? "[]"), null, 2)
      case "available":
        return JSON.stringify(listAvailable(), null, 2)
      case "info":
        return JSON.stringify(getPinInfo(args.gpio ?? 0), null, 2)
      default:
        return `Unknown action: ${args.action}. Use: find, check, available, info`
    }
  },
})

function findPins(filter: string) {
  let filtered: PinInfo[]

  switch (filter) {
    case "adc":
      filtered = ESP32_PINS.filter((p) => p.adc)
      break
    case "adc1":
      filtered = ESP32_PINS.filter((p) => p.adc?.startsWith("ADC1"))
      break
    case "adc2":
      filtered = ESP32_PINS.filter((p) => p.adc?.startsWith("ADC2"))
      break
    case "dac":
      filtered = ESP32_PINS.filter((p) => p.dac)
      break
    case "touch":
      filtered = ESP32_PINS.filter((p) => p.touch)
      break
    case "spi":
      filtered = ESP32_PINS.filter((p) => p.functions.some((f) => f.includes("SPI")))
      break
    case "i2c":
      filtered = ESP32_PINS.filter((p) => [21, 22].includes(p.gpio))
      break
    case "uart":
      filtered = ESP32_PINS.filter((p) => p.functions.some((f) => f.includes("U0") || f.includes("U2")))
      break
    case "input_only":
      filtered = ESP32_PINS.filter((p) => p.input_only)
      break
    case "safe":
      filtered = ESP32_PINS.filter((p) => !p.strapping && !p.input_only && p.gpio !== 1 && p.gpio !== 3)
      break
    default:
      filtered = ESP32_PINS
  }

  return {
    filter,
    count: filtered.length,
    pins: filtered.map((p) => ({
      gpio: p.gpio,
      functions: p.functions.join(", "),
      ...(p.adc && { adc: p.adc }),
      ...(p.dac && { dac: p.dac }),
      ...(p.touch && { touch: p.touch }),
      ...(p.strapping && { strapping: true }),
      ...(p.input_only && { input_only: true }),
      ...(p.notes && { notes: p.notes }),
    })),
    ...(filter === "adc" && {
      warning: "ADC2 channels cannot be used when WiFi is active. Use ADC1 for WiFi projects.",
    }),
  }
}

function checkConflicts(assignedJson: string) {
  const assigned = JSON.parse(assignedJson) as Array<{ gpio: number; use: string }>
  const conflicts: string[] = []
  const warnings: string[] = []

  for (const pin of assigned) {
    const info = ESP32_PINS.find((p) => p.gpio === pin.gpio)
    if (!info) {
      conflicts.push(`GPIO${pin.gpio} (${pin.use}): Invalid GPIO number for ESP32.`)
      continue
    }

    if (info.strapping) {
      warnings.push(
        `GPIO${pin.gpio} (${pin.use}): Strapping pin! ${info.notes ?? "May affect boot behavior."}`
      )
    }

    if (info.input_only && !["ADC", "INPUT", "SENSOR"].some((f) => pin.use.toUpperCase().includes(f))) {
      conflicts.push(`GPIO${pin.gpio} (${pin.use}): Input-only pin — cannot be used as output.`)
    }

    if ([1, 3].includes(pin.gpio)) {
      warnings.push(`GPIO${pin.gpio} (${pin.use}): UART0 console pin. Will conflict with serial monitor.`)
    }

    if ([16, 17].includes(pin.gpio)) {
      warnings.push(`GPIO${pin.gpio} (${pin.use}): Used by PSRAM on ESP32-WROVER modules. Check your module.`)
    }
  }

  // Check for duplicate GPIO assignments
  const gpioUsage = new Map<number, string[]>()
  for (const pin of assigned) {
    const uses = gpioUsage.get(pin.gpio) ?? []
    uses.push(pin.use)
    gpioUsage.set(pin.gpio, uses)
  }
  for (const [gpio, uses] of gpioUsage) {
    if (uses.length > 1) {
      conflicts.push(`GPIO${gpio}: Assigned to multiple functions: ${uses.join(", ")}`)
    }
  }

  return {
    assigned_pins: assigned.length,
    conflicts: conflicts.length > 0 ? conflicts : "None",
    warnings: warnings.length > 0 ? warnings : "None",
    status: conflicts.length === 0 ? "OK" : "CONFLICTS FOUND",
  }
}

function listAvailable() {
  return {
    total_gpios: ESP32_PINS.length,
    safe_gpios: ESP32_PINS.filter((p) => !p.strapping && !p.input_only && p.gpio !== 1 && p.gpio !== 3).length,
    categories: {
      strapping: ESP32_PINS.filter((p) => p.strapping).map((p) => p.gpio),
      input_only: ESP32_PINS.filter((p) => p.input_only).map((p) => p.gpio),
      uart0_console: [1, 3],
      psram_wrover: [16, 17],
      adc1_wifi_safe: ESP32_PINS.filter((p) => p.adc?.startsWith("ADC1")).map((p) => p.gpio),
      adc2_no_wifi: ESP32_PINS.filter((p) => p.adc?.startsWith("ADC2")).map((p) => p.gpio),
      dac: ESP32_PINS.filter((p) => p.dac).map((p) => p.gpio),
      touch: ESP32_PINS.filter((p) => p.touch).map((p) => p.gpio),
    },
  }
}

function getPinInfo(gpio: number) {
  const info = ESP32_PINS.find((p) => p.gpio === gpio)
  if (!info) return { error: `GPIO${gpio} not found in ESP32 pin map.` }
  return {
    gpio: info.gpio,
    functions: info.functions,
    adc: info.adc ?? "N/A",
    dac: info.dac ?? "N/A",
    touch: info.touch ?? "N/A",
    strapping: info.strapping ?? false,
    input_only: info.input_only ?? false,
    notes: info.notes ?? "General purpose GPIO. Safe to use.",
  }
}

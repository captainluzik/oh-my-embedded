import { existsSync } from "fs"
import { join } from "path"

interface EmbeddedProjectInfo {
  type: "esp-idf" | "platformio" | "zephyr" | "stm32cube" | "arduino" | "cmake-embedded" | "unknown"
  framework?: string
  target?: string
  configFiles: string[]
}

const PROJECT_MARKERS: Array<{
  files: string[]
  type: EmbeddedProjectInfo["type"]
  framework?: string
}> = [
  { files: ["sdkconfig", "sdkconfig.defaults"], type: "esp-idf", framework: "ESP-IDF" },
  { files: ["platformio.ini"], type: "platformio", framework: "PlatformIO" },
  { files: ["prj.conf", "west.yml"], type: "zephyr", framework: "Zephyr RTOS" },
  { files: [".ioc"], type: "stm32cube", framework: "STM32CubeMX" },
  { files: ["sketch.json", ".arduino"], type: "arduino", framework: "Arduino" },
]

export function createAutoDetectHook(ctx: { directory: string }) {
  let detectedProject: EmbeddedProjectInfo | null = null

  function detectProject(directory: string): EmbeddedProjectInfo | null {
    for (const marker of PROJECT_MARKERS) {
      const foundFiles = marker.files.filter((f) => existsSync(join(directory, f)))
      if (foundFiles.length > 0) {
        return {
          type: marker.type,
          framework: marker.framework,
          configFiles: foundFiles,
        }
      }
    }

    return null
  }

  return {
    async onSessionCreated(_event: unknown) {
      detectedProject = detectProject(ctx.directory)
      if (detectedProject) {
        console.error(
          `[oh-my-embedded] Detected ${detectedProject.framework ?? detectedProject.type} project (${detectedProject.configFiles.join(", ")})`
        )
      }
    },

    getDetectedProject(): EmbeddedProjectInfo | null {
      return detectedProject
    },
  }
}

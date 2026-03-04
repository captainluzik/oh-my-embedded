import type { Plugin } from "@opencode-ai/plugin"
import { createAutoDetectHook } from "./hooks/auto-detect"
import { createEspIdfContextHook } from "./hooks/esp-idf-context"
import { createTools } from "./tools/index"

/**
 * oh-my-embedded — Embedded systems engineering plugin for OpenCode.
 *
 * Provides:
 * - Skills: embedded-engineer, embedded-review, pcb-designer, component-sourcer,
 *           firmware-debugger, circuit-simulator
 * - Tools: power-calculator, impedance-calculator, resistor-divider, pin-mapper,
 *          decoupling-advisor
 * - Commands: /flash, /debug, /bom, /power-budget, /review-firmware
 * - Hooks: auto-detect embedded project, ESP-IDF context injection
 */
const OhMyEmbedded: Plugin = async (ctx) => {
  const tools = createTools()
  const autoDetect = createAutoDetectHook(ctx)
  const espIdfContext = createEspIdfContextHook(ctx)

  return {
    tool: tools,

    "session.created": async ({ event }: { event: unknown }) => {
      await autoDetect.onSessionCreated(event)
    },

    "tool.execute.before": async (input, output) => {
      await espIdfContext.beforeToolExecute(
        { tool: input.tool, args: output.args ?? {} },
        { args: output.args ?? {} }
      )
    },
  }
}

export default OhMyEmbedded

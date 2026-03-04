import { existsSync } from "node:fs"
import { join } from "node:path"
import type { Plugin } from "@opencode-ai/plugin"
import type { Config } from "@opencode-ai/sdk"
import { createAutoDetectHook } from "./hooks/auto-detect"
import { createEspIdfContextHook } from "./hooks/esp-idf-context"
import { createTools } from "./tools/index"

const HOME = process.env.HOME ?? process.env.USERPROFILE ?? "~"
const MCP_DIR = join(HOME, ".local", "share", "oh-my-embedded")

function mcpLocal(
  command: string[],
  env?: Record<string, string>,
): {
  type: "local"
  command: string[]
  environment?: Record<string, string>
  enabled: boolean
  timeout: number
} {
  return { type: "local", command, environment: env, enabled: true, timeout: 30_000 } as const
}

function registerMcpServers(config: Config) {
  if (!config.mcp) config.mcp = {}

  const espMcpDir = join(MCP_DIR, "esp-mcp")
  if (existsSync(espMcpDir)) {
    config.mcp["esp-mcp"] = mcpLocal([
      "uv",
      "run",
      "--directory",
      espMcpDir,
      "--python",
      "3.11",
      "python",
      "main.py",
    ])
  }

  const kicadEntry = join(MCP_DIR, "kicad-mcp-server", "dist", "index.js")
  if (existsSync(kicadEntry) && pcbnewAvailable()) {
    config.mcp["kicad-mcp"] = mcpLocal(["node", kicadEntry])
  }

  const jlcMcpEntry = join(MCP_DIR, "jlc-cli", "packages", "mcp", "dist", "index.js")
  if (existsSync(jlcMcpEntry)) {
    config.mcp["jlcpcb-mcp"] = mcpLocal(["node", jlcMcpEntry])
  }

  if (commandExistsSync("uvx")) {
    config.mcp.spicebridge = mcpLocal(["uvx", "spicebridge"])
  }

  if (commandExistsSync("mcp-server-gdb")) {
    config.mcp["mcp-server-gdb"] = mcpLocal(["mcp-server-gdb"])
  }

  if (commandExistsSync("serial-mcp-server")) {
    config.mcp["serial-mcp-server"] = mcpLocal(["serial-mcp-server"])
  }
}

function commandExistsSync(cmd: string): boolean {
  try {
    const result = Bun.spawnSync(["which", cmd], { stdout: "pipe", stderr: "pipe" })
    return result.exitCode === 0
  } catch {
    return false
  }
}

function pcbnewAvailable(): boolean {
  try {
    const result = Bun.spawnSync(["python3", "-c", "import pcbnew"], {
      stdout: "pipe",
      stderr: "pipe",
    })
    return result.exitCode === 0
  } catch {
    return false
  }
}

const OhMyEmbedded: Plugin = async (ctx) => {
  const tools = createTools()
  const autoDetect = createAutoDetectHook(ctx)
  const espIdfContext = createEspIdfContextHook(ctx)

  return {
    tool: tools,

    config: async (config: Config) => {
      registerMcpServers(config)
    },

    "session.created": async ({ event }: { event: unknown }) => {
      await autoDetect.onSessionCreated(event)
    },

    "tool.execute.before": async (input, output) => {
      await espIdfContext.beforeToolExecute(
        { tool: input.tool, args: output.args ?? {} },
        { args: output.args ?? {} },
      )
    },
  }
}

export default OhMyEmbedded

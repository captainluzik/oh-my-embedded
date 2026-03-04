import { existsSync } from "node:fs"
import { dirname, join } from "node:path"
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
  const kicadPythonPath = existsSync(kicadEntry) ? findKicadPythonPath() : undefined
  if (kicadEntry && kicadPythonPath) {
    config.mcp["kicad-mcp"] = mcpLocal(["node", kicadEntry], {
      PYTHONPATH: kicadPythonPath,
    })
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

const KICAD_PYTHON_PATHS = [
  "/Applications/KiCad/KiCad.app/Contents/Frameworks/Python.framework/Versions/3.9/lib/python3.9/site-packages",
  "/usr/lib/python3/dist-packages",
  "/usr/local/lib/python3/dist-packages",
]

function findKicadPythonPath(): string | undefined {
  for (const p of KICAD_PYTHON_PATHS) {
    if (existsSync(join(p, "pcbnew.py"))) return p
  }

  try {
    const result = Bun.spawnSync(["python3", "-c", "import pcbnew; print(pcbnew.__file__)"], {
      stdout: "pipe",
      stderr: "pipe",
    })
    if (result.exitCode === 0) {
      const out = new TextDecoder().decode(result.stdout).trim()
      if (out) return dirname(out)
    }
  } catch {}

  return undefined
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

#!/usr/bin/env bun

import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"

const HOME = process.env.HOME ?? process.env.USERPROFILE ?? "~"
const MCP_SERVERS_DIR = join(HOME, ".local", "share", "oh-my-embedded")

const OPENCODE_CONFIG_DIR = join(HOME, ".config", "opencode")
const OPENCODE_CONFIG_FILE = join(OPENCODE_CONFIG_DIR, "opencode.json")
const SKILLS_DIR = join(OPENCODE_CONFIG_DIR, "skills")
const COMMANDS_DIR = join(OPENCODE_CONFIG_DIR, "commands")
const AGENTS_DIR = join(OPENCODE_CONFIG_DIR, "agents")

// ── Logging ──────────────────────────────────────────────────────

function log(msg: string) {
  console.log(`  ${msg}`)
}

function logStep(msg: string) {
  console.log(`\n> ${msg}`)
}

function logOk(msg: string) {
  console.log(`  ✓ ${msg}`)
}

function logWarn(msg: string) {
  console.log(`  ⚠ ${msg}`)
}

function logFail(msg: string) {
  console.log(`  ✗ ${msg}`)
}

// ── Helpers ──────────────────────────────────────────────────────

function ensureDir(dir: string) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}

async function commandExists(cmd: string): Promise<boolean> {
  try {
    const proc = Bun.spawn(["which", cmd], { stdout: "pipe", stderr: "pipe" })
    const code = await proc.exited
    return code === 0
  } catch {
    return false
  }
}

async function runCommand(
  cmd: string[],
  label: string,
  opts: { timeoutMs?: number; cwd?: string } = {},
): Promise<boolean> {
  const { timeoutMs = 300_000, cwd } = opts
  try {
    log(`Installing ${label}...`)
    const proc = Bun.spawn(cmd, {
      stdout: "pipe",
      stderr: "pipe",
      cwd,
      env: { ...process.env, CARGO_INSTALL_OPTS: "--quiet" },
    })

    const timeout = setTimeout(() => {
      proc.kill()
    }, timeoutMs)

    const code = await proc.exited
    clearTimeout(timeout)

    if (code === 0) {
      logOk(`${label} installed`)
      return true
    }
    const stderr = await new Response(proc.stderr).text()
    if (stderr.includes("already installed")) {
      logOk(`${label} already installed`)
      return true
    }
    logFail(`${label} failed (exit ${code})`)
    return false
  } catch (err) {
    logFail(`${label} failed: ${err instanceof Error ? err.message : err}`)
    return false
  }
}

async function gitClone(repo: string, targetDir: string, label: string): Promise<boolean> {
  if (existsSync(targetDir)) {
    logOk(`${label} already cloned`)
    return true
  }
  ensureDir(dirname(targetDir))
  return runCommand(["git", "clone", "--depth", "1", repo, targetDir], label)
}

function patchSkillMcpConfig(skillName: string, newMcpYaml: string) {
  const skillFile = join(SKILLS_DIR, skillName, "SKILL.md")
  if (!existsSync(skillFile)) {
    logWarn(`Skill file not found: ${skillFile}`)
    return
  }
  const content = readFileSync(skillFile, "utf-8")
  const patched = content.replace(/mcpConfig:\n(?:[ \t]+.*\n)*/, newMcpYaml)
  if (patched === content) {
    logWarn(`Could not find mcpConfig block in ${skillName}/SKILL.md`)
    return
  }
  writeFileSync(skillFile, patched)
  logOk(`Patched mcpConfig in ${skillName}`)
}

// ── Asset discovery ──────────────────────────────────────────────

function findAssetDir(): string {
  const candidates = [
    join(dirname(import.meta.dir), "skills"),
    join(dirname(import.meta.dir), "dist", "skills"),
    join(import.meta.dir, "..", "skills"),
    join(import.meta.dir, "..", "..", "skills"),
  ]

  for (const candidate of candidates) {
    if (existsSync(candidate)) return dirname(candidate)
  }

  throw new Error(
    "Could not find oh-my-embedded assets (skills/, commands/). Is the package installed correctly?",
  )
}

// ── Install steps ────────────────────────────────────────────────

function installSkills(assetDir: string) {
  logStep("Installing skills...")
  ensureDir(SKILLS_DIR)

  const skillsSource = join(assetDir, "skills")
  if (!existsSync(skillsSource)) {
    log("No skills directory found — skipping.")
    return
  }

  const skills = Bun.file(skillsSource)
    ? Array.from(new Bun.Glob("*/SKILL.md").scanSync({ cwd: skillsSource })).map(
        (f) => f.split("/")[0],
      )
    : []

  for (const skill of skills) {
    const dest = join(SKILLS_DIR, skill)
    const source = join(skillsSource, skill)
    ensureDir(dest)
    cpSync(source, dest, { recursive: true })
    log(`Installed skill: ${skill}`)
  }

  log(`${skills.length} skills installed to ${SKILLS_DIR}`)
}

function installCommands(assetDir: string) {
  logStep("Installing commands...")
  ensureDir(COMMANDS_DIR)

  const commandsSource = join(assetDir, "commands")
  if (!existsSync(commandsSource)) {
    log("No commands directory found — skipping.")
    return
  }

  const commands = Array.from(new Bun.Glob("*.md").scanSync({ cwd: commandsSource }))

  for (const cmd of commands) {
    cpSync(join(commandsSource, cmd), join(COMMANDS_DIR, cmd))
    log(`Installed command: /${cmd.replace(".md", "")}`)
  }

  log(`${commands.length} commands installed to ${COMMANDS_DIR}`)
}

function installAgents(assetDir: string) {
  logStep("Installing agents...")
  ensureDir(AGENTS_DIR)

  const agentsSource = join(assetDir, "agents")
  if (!existsSync(agentsSource)) {
    log("No agents directory found — skipping.")
    return
  }

  const agents = Array.from(new Bun.Glob("*.md").scanSync({ cwd: agentsSource }))

  for (const agent of agents) {
    cpSync(join(agentsSource, agent), join(AGENTS_DIR, agent))
    log(`Installed agent: @${agent.replace(".md", "")}`)
  }

  log(`${agents.length} agents installed to ${AGENTS_DIR}`)
}

function registerPlugin() {
  logStep("Registering plugin in opencode.json...")
  ensureDir(OPENCODE_CONFIG_DIR)

  let config: Record<string, unknown> = {}
  if (existsSync(OPENCODE_CONFIG_FILE)) {
    const raw = readFileSync(OPENCODE_CONFIG_FILE, "utf-8")
    config = JSON.parse(raw)
  }

  const plugins = (config.plugin as string[]) ?? []
  if (!plugins.includes("oh-my-embedded")) {
    plugins.push("oh-my-embedded")
    config.plugin = plugins
    writeFileSync(OPENCODE_CONFIG_FILE, `${JSON.stringify(config, null, 2)}\n`)
    log('Added "oh-my-embedded" to plugin list.')
  } else {
    log("Plugin already registered.")
  }
}

// ── MCP server dependencies ─────────────────────────────────────

interface McpInstallResult {
  name: string
  status: "installed" | "skipped" | "failed"
  reason?: string
}

async function installMcpServers(): Promise<McpInstallResult[]> {
  logStep("Installing MCP server dependencies...")
  log("These are needed by skills — they start on-demand when a skill is loaded.\n")

  const results: McpInstallResult[] = []
  ensureDir(MCP_SERVERS_DIR)

  // ── Check available package managers ───────────────────────────
  const hasUv = await commandExists("uv")
  const hasNpm = await commandExists("npm")
  const hasCargo = await commandExists("cargo")

  log(
    `Package managers: uv=${hasUv ? "yes" : "no"} npm=${hasNpm ? "yes" : "no"} cargo=${hasCargo ? "yes" : "no"}`,
  )
  console.log()

  // ── 1. Install uv if missing ──────────────────────────────────
  if (!hasUv) {
    log("uv not found — installing (needed for esp-mcp, spicebridge)...")
    const ok = await runCommand(
      ["bash", "-c", "curl -LsSf https://astral.sh/uv/install.sh | sh"],
      "uv (astral.sh)",
    )
    if (!ok) {
      results.push({ name: "uv", status: "failed", reason: "curl install failed" })
      logWarn("Without uv, skills embedded-engineer and circuit-simulator won't have MCP servers.")
    }
  }

  const hasUvNow = await commandExists("uv")

  // ── 2. esp-mcp (git clone + uv sync) ──────────────────────────
  if (hasUvNow) {
    const espDir = join(MCP_SERVERS_DIR, "esp-mcp")
    const cloned = await gitClone("https://github.com/horw/esp-mcp.git", espDir, "esp-mcp")
    if (cloned) {
      await runCommand(["uv", "python", "install", "3.11"], "Python 3.11")
      const synced = await runCommand(
        ["uv", "sync", "--directory", espDir, "--python", "3.11"],
        "esp-mcp dependencies",
      )
      if (synced) {
        patchSkillMcpConfig(
          "embedded-engineer",
          [
            "mcpConfig:",
            "  esp-mcp:",
            "    type: stdio",
            "    command: uv",
            `    args: ["run", "--directory", "${MCP_SERVERS_DIR}/esp-mcp", "--python", "3.11", "python", "main.py"]`,
            "",
          ].join("\n"),
        )
        results.push({ name: "esp-mcp", status: "installed" })
      } else {
        results.push({ name: "esp-mcp", status: "failed", reason: "uv sync failed" })
      }
    } else {
      results.push({ name: "esp-mcp", status: "failed", reason: "git clone failed" })
    }
  } else {
    results.push({ name: "esp-mcp", status: "skipped", reason: "no uv" })
    logWarn("esp-mcp skipped — install uv, then re-run installer")
  }

  // ── 3. kicad-mcp-server (git clone + npm install + build) ─────
  if (hasNpm) {
    const kicadDir = join(MCP_SERVERS_DIR, "kicad-mcp-server")
    const cloned = await gitClone(
      "https://github.com/mixelpixx/KiCAD-MCP-Server.git",
      kicadDir,
      "kicad-mcp-server",
    )
    if (cloned) {
      const depsOk = await runCommand(["npm", "install"], "kicad-mcp-server deps", {
        cwd: kicadDir,
      })
      if (depsOk) {
        const buildOk = await runCommand(["npm", "run", "build"], "kicad-mcp-server build", {
          cwd: kicadDir,
        })
        if (buildOk) {
          patchSkillMcpConfig(
            "pcb-designer",
            [
              "mcpConfig:",
              "  kicad:",
              "    type: stdio",
              "    command: node",
              `    args: ["${MCP_SERVERS_DIR}/kicad-mcp-server/dist/index.js"]`,
              "",
            ].join("\n"),
          )
          results.push({ name: "kicad-mcp-server", status: "installed" })
        } else {
          results.push({ name: "kicad-mcp-server", status: "failed", reason: "build failed" })
        }
      } else {
        results.push({ name: "kicad-mcp-server", status: "failed", reason: "npm install failed" })
      }
    } else {
      results.push({ name: "kicad-mcp-server", status: "failed", reason: "git clone failed" })
    }
  } else {
    results.push({ name: "kicad-mcp-server", status: "skipped", reason: "no npm" })
    logWarn("kicad-mcp-server skipped — install npm, then re-run installer")
  }

  // ── 4. spicebridge (uv tool install — available on PyPI) ──────
  if (hasUvNow) {
    const ok = await runCommand(["uv", "tool", "install", "spicebridge"], "spicebridge (Python)")
    results.push({ name: "spicebridge", status: ok ? "installed" : "failed" })
  } else {
    results.push({ name: "spicebridge", status: "skipped", reason: "no uv" })
    logWarn("spicebridge skipped — install uv, then run: uv tool install spicebridge")
  }

  // ── 5. @jlcpcb/mcp (git clone + bun build — npm package is broken) ─
  const hasBun = await commandExists("bun")
  if (hasBun) {
    const jlcDir = join(MCP_SERVERS_DIR, "jlc-cli")
    const cloned = await gitClone(
      "https://github.com/l3wi/jlc-cli.git",
      jlcDir,
      "jlc-cli (jlcpcb-mcp)",
    )
    if (cloned) {
      const depsOk = await runCommand(["bun", "install"], "jlc-cli deps", { cwd: jlcDir })
      if (depsOk) {
        const buildOk = await runCommand(["bun", "run", "build"], "jlc-cli build", { cwd: jlcDir })
        if (buildOk) {
          patchSkillMcpConfig(
            "component-sourcer",
            [
              "mcpConfig:",
              "  jlcpcb:",
              "    type: stdio",
              "    command: node",
              `    args: ["${MCP_SERVERS_DIR}/jlc-cli/packages/mcp/dist/index.js"]`,
              "",
            ].join("\n"),
          )
          results.push({ name: "@jlcpcb/mcp", status: "installed" })
        } else {
          results.push({ name: "@jlcpcb/mcp", status: "failed", reason: "bun build failed" })
        }
      } else {
        results.push({ name: "@jlcpcb/mcp", status: "failed", reason: "bun install failed" })
      }
    } else {
      results.push({ name: "@jlcpcb/mcp", status: "failed", reason: "git clone failed" })
    }
  } else {
    results.push({ name: "@jlcpcb/mcp", status: "skipped", reason: "no bun" })
    logWarn("@jlcpcb/mcp skipped — install Bun (bun.sh), then re-run installer")
  }

  // ── 6. mcp-server-gdb (cargo install --locked) ────────────────
  if (hasCargo) {
    const ok = await runCommand(
      ["cargo", "install", "mcp-server-gdb", "--locked"],
      "mcp-server-gdb (Rust — may take a few minutes)",
    )
    results.push({ name: "mcp-server-gdb", status: ok ? "installed" : "failed" })
  } else {
    results.push({ name: "mcp-server-gdb", status: "skipped", reason: "no cargo" })
    logWarn(
      "mcp-server-gdb skipped — install Rust (rustup.rs), then run: cargo install mcp-server-gdb --locked",
    )
  }

  // ── 7. serial-mcp-server (cargo install --locked) ─────────────
  if (hasCargo) {
    const ok = await runCommand(
      ["cargo", "install", "serial-mcp-server", "--locked"],
      "serial-mcp-server (Rust — may take a few minutes)",
    )
    results.push({ name: "serial-mcp-server", status: ok ? "installed" : "failed" })
  } else {
    results.push({ name: "serial-mcp-server", status: "skipped", reason: "no cargo" })
    logWarn(
      "serial-mcp-server skipped — install Rust (rustup.rs), then run: cargo install serial-mcp-server --locked",
    )
  }

  return results
}

// ── Main ─────────────────────────────────────────────────────────

async function main() {
  console.log("\n========================================")
  console.log("  oh-my-embedded installer")
  console.log("  Embedded engineer on steroids")
  console.log("========================================\n")

  const skipMcp = process.argv.includes("--skip-mcp")

  try {
    const assetDir = findAssetDir()

    registerPlugin()
    installSkills(assetDir)
    installCommands(assetDir)
    installAgents(assetDir)

    let mcpResults: McpInstallResult[] = []
    if (!skipMcp) {
      mcpResults = await installMcpServers()
    } else {
      logStep("Skipping MCP server installation (--skip-mcp)")
      log("Run without --skip-mcp to install MCP servers.")
    }

    // ── Summary ────────────────────────────────────────────────
    console.log("\n========================================")
    console.log("  Installation complete!")
    console.log("========================================\n")

    console.log("  Plugin:")
    console.log("    ✓ Registered in opencode.json")
    console.log("    ✓ 6 skills installed")
    console.log("    ✓ 5 commands installed")
    console.log("    ✓ 3 agents installed\n")

    if (mcpResults.length > 0) {
      console.log("  MCP Servers:")
      const installed = mcpResults.filter((r) => r.status === "installed")
      const skipped = mcpResults.filter((r) => r.status === "skipped")
      const failed = mcpResults.filter((r) => r.status === "failed")

      for (const r of installed) {
        console.log(`    ✓ ${r.name}${r.reason ? ` (${r.reason})` : ""}`)
      }
      for (const r of skipped) {
        console.log(`    ⚠ ${r.name} — skipped (${r.reason})`)
      }
      for (const r of failed) {
        console.log(`    ✗ ${r.name} — failed (${r.reason ?? "see above"})`)
      }
      console.log()

      if (skipped.length > 0 || failed.length > 0) {
        console.log("  Some MCP servers couldn't be installed automatically.")
        console.log("  Missing servers will be downloaded on first use if the")
        console.log("  required package manager (uv, npm, cargo) is available.\n")
      }
    }

    console.log("  Next steps:")
    console.log("    1. Restart opencode")
    console.log("    2. Press Tab to switch to @embedded or @hardware")
    console.log("    3. Try: /flash, /debug, /bom, /power-budget, /review-firmware\n")
  } catch (err) {
    console.error(`\nInstallation failed: ${err instanceof Error ? err.message : err}`)
    process.exit(1)
  }
}

main()

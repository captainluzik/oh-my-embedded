#!/usr/bin/env bun

import { existsSync, mkdirSync, cpSync, readFileSync, writeFileSync } from "fs"
import { join, dirname } from "path"

const OPENCODE_CONFIG_DIR = join(
  process.env.HOME ?? process.env.USERPROFILE ?? "~",
  ".config",
  "opencode"
)
const OPENCODE_CONFIG_FILE = join(OPENCODE_CONFIG_DIR, "opencode.json")
const SKILLS_DIR = join(OPENCODE_CONFIG_DIR, "skills")
const COMMANDS_DIR = join(OPENCODE_CONFIG_DIR, "commands")
const AGENTS_DIR = join(OPENCODE_CONFIG_DIR, "agents")

function log(msg: string) {
  console.log(`  ${msg}`)
}

function logStep(msg: string) {
  console.log(`\n> ${msg}`)
}

function ensureDir(dir: string) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}

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
    "Could not find oh-my-embedded assets (skills/, commands/). Is the package installed correctly?"
  )
}

function installSkills(assetDir: string) {
  logStep("Installing skills...")
  ensureDir(SKILLS_DIR)

  const skillsSource = join(assetDir, "skills")
  if (!existsSync(skillsSource)) {
    log("No skills directory found — skipping.")
    return
  }

  const skills = Bun.file(skillsSource)
    ? Array.from(
        new Bun.Glob("*/SKILL.md").scanSync({ cwd: skillsSource })
      ).map((f) => f.split("/")[0])
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

  const commands = Array.from(
    new Bun.Glob("*.md").scanSync({ cwd: commandsSource })
  )

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

  const agents = Array.from(
    new Bun.Glob("*.md").scanSync({ cwd: agentsSource })
  )

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
    writeFileSync(OPENCODE_CONFIG_FILE, JSON.stringify(config, null, 2) + "\n")
    log('Added "oh-my-embedded" to plugin list.')
  } else {
    log("Plugin already registered.")
  }
}

async function main() {
  console.log("\n========================================")
  console.log("  oh-my-embedded installer")
  console.log("  Embedded engineer on steroids")
  console.log("========================================\n")

  try {
    const assetDir = findAssetDir()

    registerPlugin()
    installSkills(assetDir)
    installCommands(assetDir)
    installAgents(assetDir)

    console.log("\n========================================")
    console.log("  Installation complete!")
    console.log("========================================\n")
    console.log("  Agents installed. Press Tab to switch: @embedded, @hardware")
    console.log("  Skills installed. Available via: skill(name='embedded-engineer')")
    console.log("  Commands installed. Use /flash, /debug, /bom in opencode TUI.\n")
    console.log("  MCP servers (esp-mcp, gdb, serial, kicad) will start on-demand")
    console.log("  when you load the corresponding skill.\n")
    console.log("  Restart opencode to activate the plugin.\n")
  } catch (err) {
    console.error(`\nInstallation failed: ${err instanceof Error ? err.message : err}`)
    process.exit(1)
  }
}

main()

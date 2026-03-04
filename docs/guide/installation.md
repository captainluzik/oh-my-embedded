# Installation Guide

## Prerequisites

- [OpenCode](https://opencode.ai) installed and working
- [Bun](https://bun.sh) runtime (OpenCode uses it for plugins)
- At least one LLM provider configured in opencode (`opencode auth login`)

## Step 1: Install the plugin

```bash
bunx oh-my-embedded install
```

The installer will:
1. Add `"oh-my-embedded"` to your `~/.config/opencode/opencode.json` plugin array
2. Copy 6 skills to `~/.config/opencode/skills/`
3. Copy 5 commands to `~/.config/opencode/commands/`
4. Copy 3 agents to `~/.config/opencode/agents/`

### Non-interactive install

```bash
bunx oh-my-embedded install --no-tui
```

### Manual install

If you prefer to do it yourself:

```bash
# 1. Add plugin to opencode config
# Edit ~/.config/opencode/opencode.json:
{
  "plugin": ["oh-my-embedded"]
}

# 2. Restart opencode
```

Skills, commands, and agents will be available from the npm package automatically.

## Step 2: Verify installation

Restart opencode and check:

```
# In opencode TUI:
# Press Tab — you should see @embedded and @hardware agents
# Type /flash — should show the flash command
# Type: "Use embedded-pin-mapper to list all ESP32 GPIOs" — should work
```

## Step 3: Install MCP server dependencies (optional)

MCP servers are started on-demand when you load a skill. Install only what you need:

### For ESP-IDF development (embedded-engineer skill)
```bash
pip install esp-mcp
# Requires: ESP-IDF installed and sourced (. $IDF_PATH/export.sh)
```

### For PlatformIO development
```bash
# PlatformIO CLI must be installed
pip install platformio
```

### For PCB design (pcb-designer skill)
```bash
npm install -g kicad-mcp-server
# Requires: KiCad 7 or 8 installed
```

### For firmware debugging (firmware-debugger skill)
```bash
# GDB MCP server (Rust)
cargo install mcp-server-gdb

# Serial port MCP server (Rust)
cargo install serial-mcp-server

# Requires: debug probe (ST-Link, J-Link, ESP-Prog, or built-in USB JTAG)
# Requires: OpenOCD or J-Link software
```

### For circuit simulation (circuit-simulator skill)
```bash
pip install spicebridge
# Requires: ngspice installed
# macOS: brew install ngspice
# Ubuntu: apt install ngspice
```

### For component sourcing (component-sourcer skill)
```bash
# Auto-installed via npx, no manual install needed
# Optional: Nexar API key for Octopart search (set NEXAR_API_KEY)
```

## Step 4: Understand what you got

### Agents (press Tab to switch)

| Agent | Color | Mode | What it does |
|-------|-------|------|--------------|
| `@embedded` | Green | primary | Firmware engineer. ESP32/STM32, FreeRTOS, peripherals, power. |
| `@hardware` | Orange | primary | Hardware/PCB engineer. Schematics, layout, components, RF. |
| `@review-hw` | Red | subagent | Read-only firmware reviewer. P0-P3 severity. No code changes. |

### Skills (loaded via `skill` tool)

| Skill | MCP Servers | Domain |
|-------|-------------|--------|
| `embedded-engineer` | esp-mcp | ESP-IDF, FreeRTOS, peripherals, WiFi/BLE, deep sleep |
| `embedded-review` | — | Code review: memory safety, ISR, RTOS, C/C++ UB |
| `pcb-designer` | kicad-mcp-server | KiCad PCB design, routing, DRC, JLCPCB |
| `component-sourcer` | @jlcpcb/mcp | Component search, BOM optimization, LCSC catalog |
| `firmware-debugger` | mcp-server-gdb, serial-mcp-server | GDB debugging, JTAG/SWD, serial monitor |
| `circuit-simulator` | spicebridge | ngspice simulation, filters, power supplies |

### Tools (always available, no install needed)

| Tool | What it calculates |
|------|--------------------|
| `embedded-power-calculator` | Battery life, LDO vs DC-DC, current budgets |
| `embedded-impedance-calculator` | RF matching networks, microstrip Z0, LC filters |
| `embedded-resistor-divider` | Voltage dividers with E24 standard values |
| `embedded-pin-mapper` | ESP32 GPIO map, pin conflicts, strapping warnings |
| `embedded-decoupling-advisor` | Decoupling caps per IC (ESP32, STM32, LDO, ADC) |

### Commands (type in TUI)

| Command | What it does |
|---------|--------------|
| `/flash` | Build + flash firmware (auto-detects ESP-IDF or PlatformIO) |
| `/debug` | Start GDB debug session with OpenOCD/J-Link/probe-rs |
| `/bom` | Generate JLCPCB-ready BOM from KiCad project |
| `/power-budget` | Analyze peripherals and calculate power budget |
| `/review-firmware` | Structured firmware code review with P0-P3 severity |

## Troubleshooting

### Plugin not loading
```bash
# Check opencode.json has the plugin
cat ~/.config/opencode/opencode.json | grep oh-my-embedded

# Check plugin is installed
ls ~/.cache/opencode/node_modules/oh-my-embedded/
```

### MCP server not starting
```bash
# Check if the MCP binary is installed
which mcp-server-gdb
which serial-mcp-server
uvx esp-mcp --help
```

### Agents not showing in Tab
```bash
# Check agents are installed
ls ~/.config/opencode/agents/embedded.md
ls ~/.config/opencode/agents/hardware.md
```

## Uninstallation

```bash
# Remove from opencode config
jq '.plugin = [.plugin[] | select(. != "oh-my-embedded")]' \
    ~/.config/opencode/opencode.json > /tmp/oc.json && \
    mv /tmp/oc.json ~/.config/opencode/opencode.json

# Remove skills, commands, agents
rm -rf ~/.config/opencode/skills/{embedded-engineer,embedded-review,pcb-designer,component-sourcer,firmware-debugger,circuit-simulator}
rm -f ~/.config/opencode/commands/{flash,debug,bom,power-budget,review-firmware}.md
rm -f ~/.config/opencode/agents/{embedded,hardware,review-hw}.md
```

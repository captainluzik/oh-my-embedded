<div align="center">

[![GitHub Release](https://img.shields.io/github/v/release/captainluzik/oh-my-embedded?style=flat-square&label=release&color=369eff&labelColor=black)](https://github.com/captainluzik/oh-my-embedded/releases)
[![npm downloads](https://img.shields.io/npm/dm/oh-my-embedded?style=flat-square&label=downloads&color=ff6b35&labelColor=black)](https://www.npmjs.com/package/oh-my-embedded)
[![GitHub Contributors](https://img.shields.io/github/contributors/captainluzik/oh-my-embedded?style=flat-square&label=contributors&color=c4f042&labelColor=black)](https://github.com/captainluzik/oh-my-embedded/graphs/contributors)
[![GitHub Stars](https://img.shields.io/github/stars/captainluzik/oh-my-embedded?style=flat-square&label=stars&color=ffcb47&labelColor=black)](https://github.com/captainluzik/oh-my-embedded/stargazers)
[![GitHub Issues](https://img.shields.io/github/issues/captainluzik/oh-my-embedded?style=flat-square&label=issues&color=ff80eb&labelColor=black)](https://github.com/captainluzik/oh-my-embedded/issues)
[![License MIT](https://img.shields.io/badge/license-MIT-white?style=flat-square&labelColor=black)](LICENSE)

</div>

> [!TIP]
> Embedded systems engineering, straight from your terminal. ESP32, STM32, FreeRTOS, KiCad, RF design, power budgets — all wired into [OpenCode](https://opencode.ai).

# oh-my-embedded

An [OpenCode](https://opencode.ai) plugin for embedded engineers. It brings specialized agents, on-demand skills with MCP server integrations, and always-available calculation tools for the kind of work that doesn't fit neatly into a generic coding assistant.

Works standalone or alongside [oh-my-opencode](https://github.com/code-yeongyu/oh-my-opencode).

## Installation

### For Humans

Copy and paste this prompt to your LLM agent (Claude Code, OpenCode, AmpCode, Cursor, etc.):

```
Install and configure oh-my-embedded by following the instructions here:
https://raw.githubusercontent.com/captainluzik/oh-my-embedded/main/docs/guide/installation.md
```

Or read the [Installation Guide](docs/guide/installation.md) directly — but we recommend letting an agent handle it.

### For LLM Agents

Fetch the installation guide and follow it:

```bash
curl -s https://raw.githubusercontent.com/captainluzik/oh-my-embedded/main/docs/guide/installation.md
```

## What's Inside

### Agents

Press **Tab** in the OpenCode TUI to cycle through agents. `@embedded` and `@hardware` appear alongside your existing agents.

| Agent | Color | Mode | What it does |
|-------|-------|------|--------------|
| `@embedded` | 🟢 Green | primary | Firmware engineer. ESP32/STM32, FreeRTOS, peripherals, WiFi/BLE, deep sleep, OTA, power management |
| `@hardware` | 🟠 Orange | primary | PCB/RF engineer. Schematics, layout, component selection, RF design, impedance matching |
| `@review-hw` | 🔴 Red | subagent | Read-only firmware code reviewer. P0-P3 severity findings, memory safety, ISR pitfalls |

### Skills

Skills load on-demand via the `skill` tool. Each skill carries its own MCP servers — they start when you load the skill and stop when idle.

| Skill | MCP Servers | What it does |
|-------|-------------|--------------|
| `embedded-engineer` | esp-mcp | ESP32/STM32 firmware, FreeRTOS, peripherals, WiFi/BLE, deep sleep, OTA |
| `embedded-review` | — | Firmware code review: memory safety, ISR, RTOS pitfalls, C/C++ UB. P0-P3 severity |
| `pcb-designer` | kicad-mcp-server | KiCad PCB design: schematic, placement, routing, DRC, Gerber, JLCPCB BOM |
| `component-sourcer` | @jlcpcb/mcp | Component search, BOM optimization, JLCPCB Basic Parts, alternatives |
| `firmware-debugger` | mcp-server-gdb, serial-mcp-server | GDB debugging, JTAG/SWD, hard fault analysis, serial monitor |
| `circuit-simulator` | spicebridge | ngspice simulation: power supplies, filters, impedance matching |

### Tools

These tools are always available — no skill loading, no MCP servers, no install needed.

| Tool | What it does |
|------|--------------|
| `embedded-power-calculator` | Battery life estimation, LDO vs DC-DC, per-component current breakdown |
| `embedded-impedance-calculator` | RF L/Pi matching networks, microstrip impedance, Butterworth LC filters |
| `embedded-resistor-divider` | Voltage divider design with E24 standard values, load effect analysis |
| `embedded-pin-mapper` | ESP32 GPIO pin map, conflict detection, strapping pin warnings |
| `embedded-decoupling-advisor` | Per-IC decoupling cap recommendations (ESP32, STM32, LDO, DC-DC, ADC) |

### Commands

| Command | What it does |
|---------|--------------|
| `/flash` | Build + flash firmware (auto-detects ESP-IDF or PlatformIO) |
| `/debug` | Start GDB debug session with OpenOCD/J-Link/probe-rs |
| `/bom` | Generate JLCPCB-ready BOM from KiCad project |
| `/power-budget` | Analyze project peripherals and calculate power budget |
| `/review-firmware` | Run structured firmware code review with P0-P3 severity |

### Auto-Detection

The plugin detects your project type automatically and injects relevant context into every session.

| File | Detected as |
|------|-------------|
| `sdkconfig`, `sdkconfig.defaults` | ESP-IDF |
| `platformio.ini` | PlatformIO |
| `prj.conf`, `west.yml` | Zephyr RTOS |
| `.ioc` | STM32CubeMX |

For ESP-IDF projects, it parses `sdkconfig` and injects: target chip, flash size, PSRAM, WiFi/BLE status, partition table, and ADC2+WiFi conflict warnings.

## Prerequisites

The plugin has no mandatory dependencies. MCP servers install on-demand when you load a skill.

| MCP Server | Install | Used by |
|------------|---------|---------|
| [esp-mcp](https://github.com/horw/esp-mcp) | `pip install esp-mcp` | embedded-engineer |
| [kicad-mcp-server](https://github.com/mixelpixx/KiCAD-MCP-Server) | `npm i -g kicad-mcp-server` | pcb-designer |
| [@jlcpcb/mcp](https://github.com/l3wi/jlc-cli) | auto-installed via npx | component-sourcer |
| [mcp-server-gdb](https://github.com/pansila/mcp_server_gdb) | `cargo install mcp-server-gdb` | firmware-debugger |
| [serial-mcp-server](https://github.com/Adancurusul/serial-mcp-server) | `cargo install serial-mcp-server` | firmware-debugger |
| [spicebridge](https://github.com/clanker-lover/spicebridge) | `pip install spicebridge` | circuit-simulator |

## Usage Examples

### Battery life for a sensor node

```
Use embedded-power-calculator to estimate battery life:
- ESP32 with WiFi, 10% duty cycle (240mA active, 10uA deep sleep)
- BME280 sensor (0.35mA active, 0.1uA sleep, 1% duty cycle)
- LED indicator (20mA, 0.1% duty cycle)
Supply: 3.3V via LDO from 4.2V LiPo, 2000mAh battery
```

### Impedance matching for a 915 MHz antenna

```
Use embedded-impedance-calculator to design an L-match network:
50 Ohm source to 150 Ohm antenna at 915 MHz
```

### Check ESP32 pin assignments for conflicts

```
Use embedded-pin-mapper to check these assignments:
GPIO18 = SPI_CLK, GPIO23 = SPI_MOSI, GPIO19 = SPI_MISO,
GPIO5 = SPI_CS, GPIO21 = I2C_SDA, GPIO22 = I2C_SCL,
GPIO12 = LED, GPIO34 = ADC_INPUT
```

### Full firmware review

```bash
/review-firmware src/
```

## Roadmap

| Feature | Status |
|---------|--------|
| `@embedded` agent (ESP32/STM32, FreeRTOS) | ✅ Done |
| `@hardware` agent (PCB/RF design) | ✅ Done |
| `@review-hw` subagent | ✅ Done |
| 6 skills with MCP server integrations | ✅ Done |
| 5 always-available calculation tools | ✅ Done |
| 5 slash commands | ✅ Done |
| Auto-detection (ESP-IDF, PlatformIO, Zephyr, STM32) | ✅ Done |
| sdkconfig context injection | ✅ Done |
| npm publish | 🔲 Planned |
| TUI installer with model selection | 🔲 Planned |
| STM32CubeMX MCP integration | 🔲 Planned |
| Zephyr RTOS skill | 🔲 Planned |
| RF/antenna design skill (no MCP exists yet) | 🔲 Planned |
| ESP32-S3/C3 pin maps for pin-mapper tool | 🔲 Planned |
| PlatformIO MCP server integration | 🔲 Planned |
| More circuit simulation templates | 🔲 Planned |

## Contributing

This project is early and shaped by whoever shows up. If you work with embedded systems and want better AI tooling, this is the place to build it.

PRs are welcome. New MCP server integrations are especially wanted — if you know of a good one for embedded work that isn't here yet, open an issue or send a PR.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full guide.

### Good First Issues

Not sure where to start? These are concrete, self-contained tasks that don't require deep knowledge of the codebase:

| Task | Difficulty |
|------|------------|
| Add ESP32-S3 pin map to `embedded-pin-mapper` tool | Easy |
| Add ESP32-C3 pin map to `embedded-pin-mapper` tool | Easy |
| Add decoupling cap profiles for RP2040 and nRF52840 | Easy |
| Add impedance calculator presets for common antenna matches | Medium |
| Write unit tests for the calculator tools | Medium |
| Improve error messages in tools (clearer, more actionable) | Easy |

Open an issue if you want to claim one, or just send the PR directly.

## Author's Note

I built this because I kept switching between datasheets, calculators, and a generic AI assistant that didn't know what a strapping pin was. The embedded world has a lot of specialized knowledge that doesn't fit into a general-purpose coding tool.

[oh-my-opencode](https://github.com/code-yeongyu/oh-my-opencode)'s plugin architecture made it possible to build something focused. This is that thing, for embedded engineers.

The embedded community deserves better AI tooling. I don't think one person can build all of it, so I'm putting this out early and hoping others want to shape it too. If you're an embedded engineer who uses AI in your workflow, your feedback and contributions matter more than anything else here.

## Uninstallation

```bash
# Remove the plugin from your opencode.json
cat ~/.config/opencode/opencode.json | jq 'del(.plugin[] | select(. == "oh-my-embedded"))' > tmp.json && mv tmp.json ~/.config/opencode/opencode.json
```

Then delete any copied skills and commands from `~/.config/opencode/skills/` and `~/.config/opencode/commands/`.

## Development

```bash
git clone https://github.com/captainluzik/oh-my-embedded
cd oh-my-embedded
bun install
bun run build
bun run typecheck
```

## License

MIT

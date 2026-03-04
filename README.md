# oh-my-embedded

Embedded systems engineering plugin for [OpenCode](https://opencode.ai). ESP32, FreeRTOS, RF design, PCB layout, component sourcing, power budgets — all from your terminal.

Works standalone or alongside [oh-my-opencode](https://github.com/code-yeongyu/oh-my-opencode).

## What's Inside

### Agents (Tab to switch in TUI)

| Agent | Mode | What it does |
|-------|------|--------------|
| `@embedded` | primary | Firmware engineer — ESP32/STM32, FreeRTOS, peripherals, power management |
| `@hardware` | primary | Hardware/PCB engineer — schematics, layout, components, RF design |
| `@review-hw` | subagent | Read-only firmware code reviewer — P0-P3 severity findings |

Press **Tab** in the opencode TUI to cycle through agents. `@embedded` and `@hardware` appear alongside your existing agents (build, plan, etc.).

### Skills (loaded on-demand via `skill` tool)

| Skill | MCP Servers | What it does |
|-------|-------------|--------------|
| `embedded-engineer` | esp-mcp | ESP32/STM32 firmware, FreeRTOS, peripherals, WiFi/BLE, deep sleep, OTA |
| `embedded-review` | — | Firmware code review: memory safety, ISR, RTOS pitfalls, C/C++ UB. P0-P3 severity. |
| `pcb-designer` | kicad-mcp-server | KiCad PCB design: schematic, placement, routing, DRC, Gerber, JLCPCB BOM |
| `component-sourcer` | @jlcpcb/mcp | Component search, BOM optimization, JLCPCB Basic Parts, alternatives |
| `firmware-debugger` | mcp-server-gdb, serial-mcp-server | GDB debugging, JTAG/SWD, hard fault analysis, serial monitor |
| `circuit-simulator` | spicebridge | ngspice simulation: power supplies, filters, impedance matching |

Each skill carries its own MCP servers — they start on-demand when you load the skill and stop when idle.

### Custom Tools (always available)

| Tool | What it does |
|------|--------------|
| `embedded-power-calculator` | Battery life estimation, LDO vs DC-DC, per-component current breakdown |
| `embedded-impedance-calculator` | RF L/Pi matching networks, microstrip impedance, Butterworth LC filters |
| `embedded-resistor-divider` | Voltage divider design with E24 standard values, load effect |
| `embedded-pin-mapper` | ESP32 GPIO pin map, conflict detection, strapping pin warnings |
| `embedded-decoupling-advisor` | Per-IC decoupling cap recommendations (ESP32, STM32, LDO, DC-DC, ADC) |

### Slash Commands

| Command | What it does |
|---------|--------------|
| `/flash` | Build + flash firmware (auto-detects ESP-IDF or PlatformIO) |
| `/debug` | Start GDB debug session with OpenOCD/J-Link/probe-rs |
| `/bom` | Generate JLCPCB-ready BOM from KiCad project |
| `/power-budget` | Analyze project peripherals and calculate power budget |
| `/review-firmware` | Run structured firmware code review with P0-P3 severity |

### Auto-Detection

The plugin automatically detects embedded projects by looking for:
- `sdkconfig` / `sdkconfig.defaults` → ESP-IDF
- `platformio.ini` → PlatformIO
- `prj.conf` / `west.yml` → Zephyr RTOS
- `.ioc` → STM32CubeMX

For ESP-IDF projects, it parses `sdkconfig` and injects context: target chip, flash size, PSRAM, WiFi/BLE status, partition table, and ADC2+WiFi conflict warnings.

## Installation

```bash
# Install the plugin
bunx oh-my-embedded install
```

This will:
1. Add `"oh-my-embedded"` to your `~/.config/opencode/opencode.json` plugin list
2. Copy skills to `~/.config/opencode/skills/`
3. Copy commands to `~/.config/opencode/commands/`

Or manually add to your `opencode.json`:

```json
{
  "plugin": ["oh-my-embedded"]
}
```

Restart opencode after installation.

## Prerequisites

The plugin itself has no mandatory dependencies. MCP servers are installed on-demand when you load a skill:

| MCP Server | Install | Used by |
|------------|---------|---------|
| [esp-mcp](https://github.com/horw/esp-mcp) | `pip install esp-mcp` | embedded-engineer |
| [kicad-mcp-server](https://github.com/mixelpixx/KiCAD-MCP-Server) | `npm i -g kicad-mcp-server` | pcb-designer |
| [@jlcpcb/mcp](https://github.com/l3wi/jlc-cli) | auto-installed via npx | component-sourcer |
| [mcp-server-gdb](https://github.com/pansila/mcp_server_gdb) | `cargo install mcp-server-gdb` | firmware-debugger |
| [serial-mcp-server](https://github.com/Adancurusul/serial-mcp-server) | `cargo install serial-mcp-server` | firmware-debugger |
| [spicebridge](https://github.com/clanker-lover/spicebridge) | `pip install spicebridge` | circuit-simulator |

## Usage Examples

### Calculate power budget for a battery-powered ESP32 sensor

```
Use the embedded-power-calculator tool to calculate battery life for:
- ESP32 with WiFi, 10% duty cycle (240mA active, 10uA deep sleep)
- BME280 sensor (0.35mA active, 0.1uA sleep, 1% duty cycle)
- LED indicator (20mA, 0.1% duty cycle)
Supply: 3.3V via LDO from 4.2V LiPo, battery 2000mAh
```

### Design an impedance matching network

```
Use embedded-impedance-calculator to design an L-match network:
50 Ohm source to 150 Ohm antenna at 915 MHz
```

### Check ESP32 pin assignments for conflicts

```
Use embedded-pin-mapper to check these pin assignments:
GPIO18 = SPI_CLK, GPIO23 = SPI_MOSI, GPIO19 = SPI_MISO,
GPIO5 = SPI_CS, GPIO21 = I2C_SDA, GPIO22 = I2C_SCL,
GPIO12 = LED, GPIO34 = ADC_INPUT
```

### Review firmware code

```
/review-firmware src/main/
```

### Build and flash

```
/flash
```

## Development

```bash
git clone https://github.com/<your-username>/oh-my-embedded
cd oh-my-embedded
bun install
bun run build
bun run typecheck
```

## License

MIT

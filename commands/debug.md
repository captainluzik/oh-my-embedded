---
description: Start GDB debug session with OpenOCD or probe-rs
---

Set up and launch a GDB debug session for the current embedded project.

## Arguments

`$ARGUMENTS` may contain:
- A target address or symbol to break on (e.g. `app_main`, `0x40080000`).
- A probe type override: `openocd`, `jlink`, or `probe-rs`.
- A config file path for OpenOCD (e.g. `openocd.cfg`).

## Step 1: Detect the debug probe

Check which tools are available:
```bash
which openocd
which JLinkGDBServer
which probe-rs
```

Also check for config files in the project root:
- `openocd.cfg` or any `*.cfg` file referencing a target.
- `.cargo/config.toml` with `runner = "probe-rs"` (Rust/probe-rs projects).

If `$ARGUMENTS` specifies a probe type, use that. Otherwise pick the first available tool.

## Step 2: Find the firmware binary

Look for the ELF file:
- ESP-IDF: `build/<project_name>.elf`
- PlatformIO: `.pio/build/<env>/<project_name>.elf`
- CMake generic: `build/*.elf`
- Cargo/probe-rs: `target/<target-triple>/debug/<binary>`

If multiple ELF files exist, list them and ask the user to confirm which one to use.

## Step 3: Start the GDB server

### OpenOCD

```bash
openocd -f openocd.cfg
```

If no `openocd.cfg` exists, try common board configs:
```bash
# ESP32
openocd -f board/esp32-wrover-kit-3.3v.cfg

# STM32 with ST-Link
openocd -f interface/stlink.cfg -f target/stm32f4x.cfg

# Generic CMSIS-DAP
openocd -f interface/cmsis-dap.cfg -f target/stm32f4x.cfg
```

Run OpenOCD in the background. Default GDB port is `3333`.

### J-Link

```bash
JLinkGDBServer -device <chip> -if SWD -speed 4000 -port 2331
```

Replace `<chip>` with the detected or user-specified target.

### probe-rs

```bash
probe-rs gdb --chip <chip> <elf-file>
```

## Step 4: Connect GDB

Use `arm-none-eabi-gdb`, `xtensa-esp32-elf-gdb`, or `gdb-multiarch` depending on the target architecture.

```bash
arm-none-eabi-gdb <elf-file> \
  -ex "target extended-remote :3333" \
  -ex "monitor reset halt" \
  -ex "load" \
  -ex "monitor reset init"
```

If `$ARGUMENTS` contains a target address or symbol, append:
```
  -ex "break $ARGUMENTS"
  -ex "continue"
```

## Common debug scenarios

**Hard fault investigation:**
Set a breakpoint on `HardFault_Handler` or the fault ISR. After halting, print the stack frame:
```
(gdb) info registers
(gdb) backtrace
(gdb) x/16xw $sp
```

**Inspect a variable at runtime:**
```
(gdb) watch my_variable
(gdb) print my_variable
```

**Reset and re-run without reflashing:**
```
(gdb) monitor reset halt
(gdb) load
(gdb) continue
```

## Troubleshooting

- "Error: unable to open JTAG interface": check USB connection and udev rules (`/etc/udev/rules.d/`).
- "No device found": verify the probe is recognized with `lsusb` or `probe-rs list`.
- GDB can't find symbols: confirm you built with debug info (`-g` flag, or `CMAKE_BUILD_TYPE=Debug`).

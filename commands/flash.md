---
description: Build and flash firmware to target device (ESP-IDF or PlatformIO)
---

Detect the project type and build + flash firmware to the connected device.

## Detection rules

- If `sdkconfig` or `CMakeLists.txt` with `idf_component_register` exists: **ESP-IDF** project.
- If `platformio.ini` exists: **PlatformIO** project.
- If neither is found, tell the user and stop.

## Arguments

`$ARGUMENTS` may contain:
- A serial port (e.g. `/dev/ttyUSB0`, `COM3`) to override auto-detection.
- A board name or target chip (e.g. `esp32s3`, `uno`) to pass to the build system.
- The word `monitor` to start a serial monitor after flashing.

Parse `$ARGUMENTS` before running any commands.

## ESP-IDF workflow

1. Run `idf.py build` in the project root. Show build output. Stop on error.
2. Determine the flash port:
   - If a port was given in `$ARGUMENTS`, use it.
   - Otherwise run `idf.py flash` without `-p` and let ESP-IDF auto-detect.
3. Run `idf.py flash` (append `-p <port>` if a port was specified).
4. If `monitor` was in `$ARGUMENTS`, run `idf.py monitor` (append `-p <port>` if specified).

Example commands:
```bash
idf.py build
idf.py flash -p /dev/ttyUSB0
idf.py monitor -p /dev/ttyUSB0
```

## PlatformIO workflow

1. Run `pio run` to build. Show output. Stop on error.
2. Run `pio run --target upload` to flash.
   - If a port was given in `$ARGUMENTS`, append `--upload-port <port>`.
   - If a board/environment was given, append `-e <env>`.
3. If `monitor` was in `$ARGUMENTS`, run `pio device monitor`.

Example commands:
```bash
pio run
pio run --target upload --upload-port /dev/ttyUSB0
pio device monitor
```

## After flashing

Report:
- Build size (flash + RAM usage if available in build output).
- The port used.
- Whether the monitor was started.

If flashing fails with a "port not found" or "no device" error, suggest:
- Checking USB cable and connection.
- Running `ls /dev/tty*` (Linux/macOS) or checking Device Manager (Windows) to find the port.
- Holding the BOOT button while connecting (ESP32 boards).

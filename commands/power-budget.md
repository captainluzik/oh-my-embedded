---
description: Calculate power budget for the current embedded project
---

Analyze the project source files and hardware configuration to produce a power budget: estimated current draw per subsystem, total consumption, and a battery or supply recommendation.

## Arguments

`$ARGUMENTS` may contain:
- A battery capacity in mAh (e.g. `2000mAh`, `3000`) to calculate runtime.
- A supply voltage (e.g. `3.3V`, `5V`) to override the detected value.
- The keyword `sleep` to include deep-sleep / low-power mode estimates.

## Step 1: Detect supply voltage

Check in order:
1. `sdkconfig` for `CONFIG_ESP_DEFAULT_CPU_FREQ_MHZ` and power-related keys.
2. `platformio.ini` for `board_build.f_cpu` or `board` name.
3. Schematic files (`*.kicad_sch`) for a VCC or 3V3 power symbol.
4. Source files for voltage regulator part numbers (e.g. AMS1117-3.3, AP2112K).

If `$ARGUMENTS` specifies a voltage, use that. Otherwise state the detected voltage or default to 3.3V.

## Step 2: Identify active peripherals

Scan source files (`.c`, `.cpp`, `.h`, `main/`, `src/`, `components/`) for:

| Pattern to look for | Peripheral |
|---------------------|------------|
| `wifi_init`, `esp_wifi_start`, `WiFi.begin` | Wi-Fi radio |
| `bluetooth`, `esp_bt_`, `BLEDevice` | Bluetooth/BLE |
| `i2c_master`, `Wire.begin` | I2C bus |
| `spi_bus_initialize`, `SPI.begin` | SPI bus |
| `uart_driver_install`, `Serial.begin` | UART |
| `adc_oneshot`, `analogRead` | ADC |
| `ledc_`, `analogWrite`, `PWM` | PWM / LED driver |
| `gpio_set_level`, `digitalWrite` | GPIO outputs |
| `esp_sleep_enable`, `LowPower.` | Sleep modes |
| Display driver names (SSD1306, ILI9341, ST7789) | Display |
| Sensor names (BME280, MPU6050, DS18B20) | Sensors |
| Motor driver names (DRV8833, L298N, TMC2209) | Motor drivers |

List every peripheral found.

## Step 3: Estimate current draw

Use these reference values (typical, at 3.3V unless noted):

| Peripheral | Active current | Sleep/idle current |
|------------|---------------|-------------------|
| ESP32 (CPU active, 240MHz) | 80 mA | - |
| ESP32 deep sleep | - | 0.01 mA |
| ESP32 Wi-Fi TX | +170 mA peak, ~80 mA avg | - |
| ESP32 Bluetooth active | +30 mA | - |
| STM32F1 (72MHz) | 36 mA | - |
| STM32 stop mode | - | 0.5 mA |
| SSD1306 OLED (128x64) | 15 mA | 0.5 mA |
| ILI9341 TFT (backlight on) | 40 mA | 1 mA |
| BME280 sensor | 0.7 mA (forced mode) | 0.001 mA |
| MPU6050 IMU | 3.9 mA | 0.005 mA |
| DS18B20 temperature | 1.5 mA (conversion) | 0.001 mA |
| Generic I2C device | 1 mA | - |
| GPIO output (LED, 3.3V, 330R) | 10 mA per LED | - |
| DRV8833 motor driver | 1.2 A peak (motor dependent) | 1 mA |

For any peripheral not in this table, note it as "unknown" and ask the user to provide a datasheet value.

## Step 4: Calculate totals

Sum the active current for all identified peripherals. If `sleep` was in `$ARGUMENTS`, also sum the sleep-mode current.

If a battery capacity was given in `$ARGUMENTS`:
- **Active runtime** = capacity (mAh) / active current (mA)
- **Sleep runtime** = capacity (mAh) / sleep current (mA)
- If the firmware alternates between active and sleep (e.g. wake every 10s, active for 1s), calculate a duty-cycle weighted average.

## Step 5: Recommend power supply

Based on peak current draw:
- Under 500 mA: LDO regulator (AMS1117, AP2112K) is fine.
- 500 mA to 2 A: use a buck converter (MP2307, TPS54331) for efficiency.
- Over 2 A: dedicated power module or multiple regulators per rail.

For battery-powered designs:
- Recommend a LiPo cell if runtime math shows it's viable.
- Flag if the peak current exceeds typical LiPo discharge limits for small cells.
- Suggest a TP4056 or MCP73831 for single-cell LiPo charging.

## Output format

Present the results as a table followed by a short recommendation paragraph:

```
Power Budget Summary
====================
Supply voltage : 3.3V

Peripheral          | Active (mA) | Sleep (mA)
--------------------|-------------|----------
ESP32 CPU           |          80 |      0.01
ESP32 Wi-Fi (avg)   |          80 |         -
SSD1306 OLED        |          15 |      0.50
BME280 sensor       |           1 |         -
--------------------|-------------|----------
TOTAL               |         176 |      0.51

Battery runtime (2000 mAh):
  Active only : ~11.4 hours
  Sleep only  : ~163 days
  Duty cycle (1s active / 9s sleep): ~55 hours

Recommendation: ...
```

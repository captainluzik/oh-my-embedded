import { tool } from "@opencode-ai/plugin"

export const powerCalculator = tool({
  description:
    "Calculate power budget for embedded systems. Estimates battery life, total current draw, regulator efficiency, and sleep/active power modes. Supports LDO vs DC-DC comparison.",
  args: {
    components: tool.schema
      .string()
      .describe(
        'JSON array of components with their current draw. Format: [{"name": "ESP32", "active_mA": 240, "sleep_mA": 0.01, "duty_cycle": 0.1}, ...]'
      ),
    supply_voltage: tool.schema
      .number()
      .describe("Supply voltage in volts (e.g., 3.3, 5.0)"),
    battery_mAh: tool.schema
      .number()
      .optional()
      .describe("Battery capacity in mAh. If provided, calculates estimated battery life."),
    regulator_type: tool.schema
      .string()
      .optional()
      .describe('Regulator type: "ldo" or "dcdc". Default: "ldo". Affects efficiency calculation.'),
    input_voltage: tool.schema
      .number()
      .optional()
      .describe("Input voltage before regulator in volts. Required for regulator efficiency calc."),
  },
  async execute(args) {
    const components = JSON.parse(args.components) as Array<{
      name: string
      active_mA: number
      sleep_mA: number
      duty_cycle: number
    }>

    const regulatorType = args.regulator_type ?? "ldo"
    const inputVoltage = args.input_voltage ?? args.supply_voltage
    const supplyVoltage = args.supply_voltage

    // Calculate per-component average current
    const componentBreakdown = components.map((c) => {
      const avgCurrent = c.active_mA * c.duty_cycle + c.sleep_mA * (1 - c.duty_cycle)
      return {
        name: c.name,
        active_mA: c.active_mA,
        sleep_mA: c.sleep_mA,
        duty_cycle_pct: (c.duty_cycle * 100).toFixed(1),
        average_mA: Number(avgCurrent.toFixed(3)),
      }
    })

    const totalActiveCurrent = components.reduce((sum, c) => sum + c.active_mA, 0)
    const totalSleepCurrent = components.reduce((sum, c) => sum + c.sleep_mA, 0)
    const totalAverageCurrent = componentBreakdown.reduce((sum, c) => sum + c.average_mA, 0)

    // Regulator efficiency
    let efficiency = 1.0
    if (regulatorType === "ldo") {
      efficiency = inputVoltage > 0 ? supplyVoltage / inputVoltage : 1.0
    } else {
      // Typical DC-DC efficiency 85-95%
      efficiency = 0.9
    }

    const inputCurrentAvg = totalAverageCurrent / efficiency
    const totalPowerW = (inputVoltage * inputCurrentAvg) / 1000

    // Battery life calculation
    let batteryLife: string | null = null
    if (args.battery_mAh) {
      const hoursTotal = args.battery_mAh / inputCurrentAvg
      const days = Math.floor(hoursTotal / 24)
      const hours = Math.floor(hoursTotal % 24)
      batteryLife = days > 0 ? `${days}d ${hours}h (${hoursTotal.toFixed(1)}h total)` : `${hours}h ${Math.round((hoursTotal % 1) * 60)}min`
    }

    const result = {
      summary: {
        total_active_current_mA: Number(totalActiveCurrent.toFixed(2)),
        total_sleep_current_mA: Number(totalSleepCurrent.toFixed(3)),
        total_average_current_mA: Number(totalAverageCurrent.toFixed(3)),
        regulator_type: regulatorType.toUpperCase(),
        regulator_efficiency_pct: Number((efficiency * 100).toFixed(1)),
        input_current_avg_mA: Number(inputCurrentAvg.toFixed(3)),
        total_power_W: Number(totalPowerW.toFixed(4)),
        ...(batteryLife && {
          battery_capacity_mAh: args.battery_mAh,
          estimated_battery_life: batteryLife,
        }),
      },
      components: componentBreakdown,
      recommendations: generatePowerRecommendations(
        totalActiveCurrent,
        totalSleepCurrent,
        regulatorType,
        efficiency,
        inputVoltage,
        supplyVoltage
      ),
    }

    return JSON.stringify(result, null, 2)
  },
})

function generatePowerRecommendations(
  activeCurrent: number,
  sleepCurrent: number,
  regulatorType: string,
  efficiency: number,
  inputVoltage: number,
  supplyVoltage: number
): string[] {
  const recs: string[] = []

  if (regulatorType === "ldo" && efficiency < 0.7) {
    const waste = ((1 - efficiency) * 100).toFixed(0)
    recs.push(
      `LDO wastes ${waste}% of energy (Vin=${inputVoltage}V → Vout=${supplyVoltage}V). Consider DC-DC converter for ~90% efficiency.`
    )
  }

  if (sleepCurrent > 1.0) {
    recs.push(
      `Sleep current ${sleepCurrent.toFixed(2)}mA is high. Check for: pullup resistors on unused GPIOs, LEDs without MOSFET switches, always-on sensors.`
    )
  }

  if (activeCurrent > 500) {
    recs.push(
      `Active current ${activeCurrent.toFixed(0)}mA is substantial. Ensure supply rail can handle peak with decoupling (100uF bulk + 100nF per IC).`
    )
  }

  if (regulatorType === "ldo" && activeCurrent > 300) {
    const pdiss = ((inputVoltage - supplyVoltage) * activeCurrent) / 1000
    recs.push(
      `LDO thermal dissipation: ${pdiss.toFixed(2)}W. ${pdiss > 0.5 ? "NEEDS heatsink or switch to DC-DC." : "Acceptable for SOT-223/DPAK package."}`
    )
  }

  return recs
}

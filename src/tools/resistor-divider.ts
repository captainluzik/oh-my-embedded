import { tool } from "@opencode-ai/plugin"

// E24 series standard resistor values (multiplied by decades)
const E24_BASE = [
  1.0, 1.1, 1.2, 1.3, 1.5, 1.6, 1.8, 2.0, 2.2, 2.4, 2.7, 3.0, 3.3, 3.6, 3.9, 4.3, 4.7, 5.1,
  5.6, 6.2, 6.8, 7.5, 8.2, 9.1,
]

function nearestE24(value: number): number {
  const decades = [1, 10, 100, 1e3, 10e3, 100e3, 1e6, 10e6]
  let best = 0
  let bestDiff = Infinity

  for (const decade of decades) {
    for (const base of E24_BASE) {
      const candidate = base * decade
      const diff = Math.abs(candidate - value) / value
      if (diff < bestDiff) {
        bestDiff = diff
        best = candidate
      }
    }
  }
  return best
}

function formatResistor(ohms: number): string {
  if (ohms >= 1e6) return `${(ohms / 1e6).toFixed(1)}MΩ`
  if (ohms >= 1e3) return `${(ohms / 1e3).toFixed(1)}kΩ`
  return `${ohms.toFixed(1)}Ω`
}

export const resistorDivider = tool({
  description:
    "Design resistor voltage dividers with E24 standard values. Supports forward (Vin→Vout) and reverse (find R values) calculations. Includes current draw and power dissipation.",
  args: {
    mode: tool.schema
      .string()
      .describe(
        '"forward" = given R1, R2, Vin → calculate Vout. "design" = given Vin, Vout → find optimal R1, R2 from E24 series.'
      ),
    vin: tool.schema.number().describe("Input voltage in volts"),
    vout: tool.schema
      .number()
      .optional()
      .describe("Desired output voltage (required for design mode)"),
    r1: tool.schema.number().optional().describe("Upper resistor in ohms (for forward mode)"),
    r2: tool.schema.number().optional().describe("Lower resistor in ohms (for forward mode)"),
    max_current_uA: tool.schema
      .number()
      .optional()
      .describe("Maximum allowed divider current in µA. Default: 100µA. Lower = better for battery."),
    load_impedance: tool.schema
      .number()
      .optional()
      .describe("Load impedance in ohms (e.g., ADC input impedance). Affects output voltage accuracy."),
  },
  async execute(args) {
    if (args.mode === "forward") {
      return JSON.stringify(forwardCalc(args), null, 2)
    }
    return JSON.stringify(designCalc(args), null, 2)
  },
})

function forwardCalc(args: {
  vin: number
  r1?: number
  r2?: number
  load_impedance?: number
}) {
  const r1 = args.r1 ?? 10000
  const r2 = args.r2 ?? 10000
  const vin = args.vin

  const r2Eff = args.load_impedance ? (r2 * args.load_impedance) / (r2 + args.load_impedance) : r2
  const vout = vin * (r2Eff / (r1 + r2Eff))
  const current = vin / (r1 + r2)
  const powerR1 = current * current * r1
  const powerR2 = current * current * r2

  return {
    input: { vin, r1: formatResistor(r1), r2: formatResistor(r2) },
    vout: Number(vout.toFixed(4)),
    divider_current_uA: Number((current * 1e6).toFixed(2)),
    power_r1_uW: Number((powerR1 * 1e6).toFixed(2)),
    power_r2_uW: Number((powerR2 * 1e6).toFixed(2)),
    ...(args.load_impedance && {
      load_effect: {
        r2_effective: formatResistor(r2Eff),
        vout_no_load: Number((vin * (r2 / (r1 + r2))).toFixed(4)),
        vout_with_load: Number(vout.toFixed(4)),
        error_pct: Number(
          (
            ((vin * (r2 / (r1 + r2)) - vout) / (vin * (r2 / (r1 + r2)))) *
            100
          ).toFixed(2)
        ),
      },
    }),
  }
}

function designCalc(args: {
  vin: number
  vout?: number
  max_current_uA?: number
}) {
  const vin = args.vin
  const vout = args.vout ?? vin / 2
  const maxCurrent = (args.max_current_uA ?? 100) * 1e-6
  const ratio = vout / vin

  // Minimum total resistance from max current
  const rTotalMin = vin / maxCurrent

  // Find best E24 pair
  let bestR1 = 0
  let bestR2 = 0
  let bestError = Infinity

  const decades = [1, 10, 100, 1e3, 10e3, 100e3, 1e6]

  for (const d1 of decades) {
    for (const b1 of E24_BASE) {
      const r2Candidate = b1 * d1
      // Calculate ideal R1
      const r1Ideal = r2Candidate * (1 / ratio - 1)
      const r1Nearest = nearestE24(r1Ideal)

      const total = r1Nearest + r2Candidate
      if (total < rTotalMin * 0.5) continue // Too much current
      if (total > rTotalMin * 100) continue // Unnecessarily high

      const actualRatio = r2Candidate / (r1Nearest + r2Candidate)
      const error = Math.abs(actualRatio - ratio) / ratio

      if (error < bestError) {
        bestError = error
        bestR1 = r1Nearest
        bestR2 = r2Candidate
      }
    }
  }

  const actualVout = vin * (bestR2 / (bestR1 + bestR2))
  const current = vin / (bestR1 + bestR2)

  return {
    target: { vin, vout_desired: vout, ratio: Number(ratio.toFixed(4)) },
    result: {
      R1: formatResistor(bestR1),
      R1_ohms: bestR1,
      R2: formatResistor(bestR2),
      R2_ohms: bestR2,
      vout_actual: Number(actualVout.toFixed(4)),
      error_mV: Number(((actualVout - vout) * 1000).toFixed(2)),
      error_pct: Number((bestError * 100).toFixed(3)),
      divider_current_uA: Number((current * 1e6).toFixed(2)),
    },
    recommendations: [
      `Use 1% tolerance resistors for ${bestError * 100 < 0.5 ? "good" : "acceptable"} accuracy.`,
      current * 1e6 < 10
        ? "Very low current — ensure ADC input impedance is >> R1+R2."
        : "Current draw acceptable for most applications.",
    ],
  }
}

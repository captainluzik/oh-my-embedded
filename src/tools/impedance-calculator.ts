import { tool } from "@opencode-ai/plugin"

export const impedanceCalculator = tool({
  description:
    "Calculate RF impedance matching networks, transmission line impedance, and LC filter parameters. Supports L-network, Pi-network, and microstrip calculations.",
  args: {
    calculation: tool.schema
      .string()
      .describe(
        'Type of calculation: "l_match" (L-network matching), "pi_match" (Pi-network), "microstrip" (trace impedance), "lc_filter" (low/high/bandpass filter)'
      ),
    params: tool.schema
      .string()
      .describe(
        'JSON parameters depending on calculation type. ' +
          'l_match: {"z_source": 50, "z_load": 150, "freq_MHz": 915} | ' +
          'pi_match: {"z_source": 50, "z_load": 50, "q_factor": 5, "freq_MHz": 2400} | ' +
          'microstrip: {"width_mm": 1.2, "height_mm": 1.6, "er": 4.4, "thickness_um": 35} | ' +
          'lc_filter: {"type": "lowpass", "cutoff_MHz": 100, "z0": 50, "order": 3}'
      ),
  },
  async execute(args) {
    const params = JSON.parse(args.params)

    switch (args.calculation) {
      case "l_match":
        return JSON.stringify(calcLMatch(params), null, 2)
      case "pi_match":
        return JSON.stringify(calcPiMatch(params), null, 2)
      case "microstrip":
        return JSON.stringify(calcMicrostrip(params), null, 2)
      case "lc_filter":
        return JSON.stringify(calcLcFilter(params), null, 2)
      default:
        return `Unknown calculation type: ${args.calculation}. Supported: l_match, pi_match, microstrip, lc_filter`
    }
  },
})

function calcLMatch(p: { z_source: number; z_load: number; freq_MHz: number }) {
  const rs = Math.min(p.z_source, p.z_load)
  const rl = Math.max(p.z_source, p.z_load)
  const q = Math.sqrt(rl / rs - 1)
  const omega = 2 * Math.PI * p.freq_MHz * 1e6

  // High-pass L-network
  const xL = q * rs
  const xC = rl / q
  const L_nH = (xL / omega) * 1e9
  const C_pF = (1 / (omega * xC)) * 1e12

  // Low-pass L-network
  const xL_lp = rl / q
  const xC_lp = q * rs
  const L_lp_nH = (xL_lp / omega) * 1e9
  const C_lp_pF = (1 / (omega * xC_lp)) * 1e12

  return {
    input: { z_source: p.z_source, z_load: p.z_load, freq_MHz: p.freq_MHz },
    q_factor: Number(q.toFixed(2)),
    bandwidth_MHz: Number((p.freq_MHz / q).toFixed(1)),
    highpass_network: {
      topology: p.z_source < p.z_load ? "Series C → Shunt L" : "Shunt L → Series C",
      L_nH: Number(L_nH.toFixed(2)),
      C_pF: Number(C_pF.toFixed(2)),
    },
    lowpass_network: {
      topology: p.z_source < p.z_load ? "Series L → Shunt C" : "Shunt C → Series L",
      L_nH: Number(L_lp_nH.toFixed(2)),
      C_pF: Number(C_lp_pF.toFixed(2)),
    },
    note: "Use lowpass topology for harmonic rejection. Use E24 nearest standard values.",
  }
}

function calcPiMatch(p: { z_source: number; z_load: number; q_factor: number; freq_MHz: number }) {
  const omega = 2 * Math.PI * p.freq_MHz * 1e6
  const q = p.q_factor
  const rVirt = p.z_source / (1 + q * q)

  const q2 = Math.sqrt(p.z_load / rVirt - 1)

  const c1_pF = (q / (omega * p.z_source)) * 1e12
  const c2_pF = (q2 / (omega * p.z_load)) * 1e12
  const lTotal = (rVirt * (q + q2)) / omega * 1e9

  return {
    input: p,
    topology: "Shunt C1 → Series L → Shunt C2",
    C1_pF: Number(c1_pF.toFixed(2)),
    L_nH: Number(lTotal.toFixed(2)),
    C2_pF: Number(c2_pF.toFixed(2)),
    virtual_impedance_ohm: Number(rVirt.toFixed(2)),
    note: "Pi-network provides more harmonic attenuation than L-match. Good for PA output matching.",
  }
}

function calcMicrostrip(p: { width_mm: number; height_mm: number; er: number; thickness_um: number }) {
  const w = p.width_mm
  const h = p.height_mm
  const er = p.er
  const t = p.thickness_um / 1000 // convert to mm

  // Effective width (accounting for trace thickness)
  const wEff = w + (t / Math.PI) * (1 + Math.log((2 * h) / t))
  const ratio = wEff / h

  let z0: number
  let eEff: number

  if (ratio <= 1) {
    eEff = (er + 1) / 2 + ((er - 1) / 2) * (1 / Math.sqrt(1 + 12 / ratio))
    z0 = (60 / Math.sqrt(eEff)) * Math.log(8 / ratio + ratio / 4)
  } else {
    eEff = (er + 1) / 2 + ((er - 1) / 2) * (1 / Math.sqrt(1 + 12 / ratio))
    z0 = (120 * Math.PI) / (Math.sqrt(eEff) * (ratio + 1.393 + 0.667 * Math.log(ratio + 1.444)))
  }

  // Velocity factor
  const vf = 1 / Math.sqrt(eEff)
  // Wavelength at 1 GHz
  const lambda_1GHz_mm = (300 / 1) * vf

  return {
    input: p,
    impedance_ohm: Number(z0.toFixed(2)),
    effective_er: Number(eEff.toFixed(3)),
    velocity_factor: Number(vf.toFixed(3)),
    wavelength_1GHz_mm: Number(lambda_1GHz_mm.toFixed(1)),
    quarter_wave_915MHz_mm: Number(((lambda_1GHz_mm * 1000) / (915 * 4)).toFixed(2)),
    quarter_wave_2400MHz_mm: Number(((lambda_1GHz_mm * 1000) / (2400 * 4)).toFixed(2)),
    recommendations: z0 > 45 && z0 < 55
      ? "Good 50Ω match for RF traces."
      : `Impedance is ${z0.toFixed(1)}Ω — adjust trace width for 50Ω. ${z0 > 50 ? "Increase" : "Decrease"} width.`,
  }
}

function calcLcFilter(p: { type: string; cutoff_MHz: number; z0: number; order: number }) {
  const omega = 2 * Math.PI * p.cutoff_MHz * 1e6
  const z0 = p.z0

  // Butterworth prototype g-values (normalized)
  const gValues: Record<number, number[]> = {
    1: [1.0],
    2: [1.4142, 1.4142],
    3: [1.0, 2.0, 1.0],
    4: [0.7654, 1.8478, 1.8478, 0.7654],
    5: [0.618, 1.618, 2.0, 1.618, 0.618],
  }

  const g = gValues[p.order]
  if (!g) {
    return { error: `Order ${p.order} not supported. Use 1-5.` }
  }

  const elements = g.map((gVal, i) => {
    if (p.type === "lowpass") {
      if (i % 2 === 0) {
        // Series inductor
        const L = (gVal * z0) / omega
        return { type: "L (series)", value_nH: Number((L * 1e9).toFixed(2)) }
      }
      // Shunt capacitor
      const C = gVal / (omega * z0)
      return { type: "C (shunt)", value_pF: Number((C * 1e12).toFixed(2)) }
    }
    if (i % 2 === 0) {
      // Series capacitor
      const C = 1 / (omega * gVal * z0)
      return { type: "C (series)", value_pF: Number((C * 1e12).toFixed(2)) }
    }
    // Shunt inductor
    const L = z0 / (omega * gVal)
    return { type: "L (shunt)", value_nH: Number((L * 1e9).toFixed(2)) }
  })

  return {
    input: p,
    filter_type: `Butterworth ${p.type}`,
    order: p.order,
    elements,
    note: "Values are ideal Butterworth. Use nearest E24 standard values. Add 5% margin for component tolerances.",
  }
}

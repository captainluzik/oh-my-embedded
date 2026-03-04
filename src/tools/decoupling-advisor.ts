import { tool } from "@opencode-ai/plugin"

interface ICProfile {
  name: string
  category: string
  vcc_pins: number
  recommended_bulk_uF: number
  recommended_bypass_nF: number
  bypass_per_pin: boolean
  extra_caps?: string
  notes?: string
}

const KNOWN_ICS: Record<string, ICProfile> = {
  esp32: {
    name: "ESP32",
    category: "MCU + WiFi/BT",
    vcc_pins: 4,
    recommended_bulk_uF: 22,
    recommended_bypass_nF: 100,
    bypass_per_pin: true,
    extra_caps: "10uF tantalum on 3.3V rail near module",
    notes: "WiFi TX bursts draw 300-500mA peaks. Ensure low-ESR bulk cap.",
  },
  "esp32-s3": {
    name: "ESP32-S3",
    category: "MCU + WiFi/BT",
    vcc_pins: 5,
    recommended_bulk_uF: 22,
    recommended_bypass_nF: 100,
    bypass_per_pin: true,
    extra_caps: "10uF MLCC (X5R/X7R) + 100uF tantalum bulk",
    notes: "USB-OTG adds transient load. Add 4.7uF near USB VBUS.",
  },
  stm32f4: {
    name: "STM32F4xx",
    category: "MCU",
    vcc_pins: 5,
    recommended_bulk_uF: 4.7,
    recommended_bypass_nF: 100,
    bypass_per_pin: true,
    extra_caps: "1uF on VDDA, 4.7uF + 1uF on VCAP pins",
    notes: "VCAP pins require specific values per datasheet. Do NOT omit.",
  },
  ldo: {
    name: "Generic LDO",
    category: "Power",
    vcc_pins: 1,
    recommended_bulk_uF: 10,
    recommended_bypass_nF: 100,
    bypass_per_pin: false,
    extra_caps: "Input: 10uF, Output: 10uF minimum. Check datasheet for stability requirements.",
    notes: "Some LDOs require ESR in specific range for stability. Tantalum or X5R MLCC recommended.",
  },
  dcdc: {
    name: "Generic DC-DC Buck",
    category: "Power",
    vcc_pins: 1,
    recommended_bulk_uF: 22,
    recommended_bypass_nF: 100,
    bypass_per_pin: false,
    extra_caps: "Input: 22uF low-ESR, Output: 22uF low-ESR. Follow datasheet exactly for inductor and caps.",
    notes: "DC-DC converter caps are CRITICAL for operation. Wrong values cause oscillation or failure.",
  },
  opamp: {
    name: "Generic Op-Amp",
    category: "Analog",
    vcc_pins: 2,
    recommended_bulk_uF: 10,
    recommended_bypass_nF: 100,
    bypass_per_pin: true,
    notes: "Place 100nF as close as possible to each supply pin. For high-speed op-amps, add 10pF in parallel.",
  },
  adc_external: {
    name: "External ADC (ADS1115/MCP3008)",
    category: "Analog",
    vcc_pins: 2,
    recommended_bulk_uF: 10,
    recommended_bypass_nF: 100,
    bypass_per_pin: true,
    extra_caps: "100nF + 10uF on AVDD. Ferrite bead between digital and analog supply.",
    notes: "Separate analog and digital ground planes. Star-ground at ADC.",
  },
}

export const decouplingAdvisor = tool({
  description:
    "Recommend decoupling capacitor placement and values for ICs in embedded designs. Covers ESP32, STM32, LDOs, DC-DC converters, ADCs, and op-amps. Includes PCB layout guidelines.",
  args: {
    ic_type: tool.schema
      .string()
      .describe(
        'IC type: "esp32", "esp32-s3", "stm32f4", "ldo", "dcdc", "opamp", "adc_external", or "custom"'
      ),
    custom_vcc_pins: tool.schema
      .number()
      .optional()
      .describe("Number of VCC pins (for custom IC type)"),
    operating_freq_MHz: tool.schema
      .number()
      .optional()
      .describe("Operating frequency in MHz. Higher freq = more critical bypass placement."),
    switching_freq_MHz: tool.schema
      .number()
      .optional()
      .describe("Switching frequency for DC-DC converters in MHz."),
    board_layers: tool.schema
      .number()
      .optional()
      .describe("Number of PCB layers (2, 4, 6). Affects ground plane recommendations."),
  },
  async execute(args) {
    const profile = KNOWN_ICS[args.ic_type]
    if (!profile && args.ic_type !== "custom") {
      return JSON.stringify(
        {
          error: `Unknown IC type: ${args.ic_type}`,
          available: Object.keys(KNOWN_ICS),
        },
        null,
        2
      )
    }

    const vccPins = profile?.vcc_pins ?? args.custom_vcc_pins ?? 1
    const freqMHz = args.operating_freq_MHz ?? 160

    const bom: Array<{ value: string; quantity: number; type: string; purpose: string }> = []

    // Bypass caps: 100nF per VCC pin
    const bypassPerPin = profile?.bypass_per_pin ?? true
    bom.push({
      value: `${profile?.recommended_bypass_nF ?? 100}nF`,
      quantity: bypassPerPin ? vccPins : 1,
      type: "MLCC C0G/X7R 0402 or 0603",
      purpose: "High-frequency bypass per VCC pin",
    })

    // Bulk cap
    bom.push({
      value: `${profile?.recommended_bulk_uF ?? 10}uF`,
      quantity: 1,
      type: "MLCC X5R/X7R 0805 or 1206",
      purpose: "Bulk decoupling for transient current demand",
    })

    // High frequency: add 10pF or 1nF
    if (freqMHz > 200) {
      bom.push({
        value: "10pF",
        quantity: vccPins,
        type: "MLCC C0G 0402",
        purpose: "Ultra-high-frequency bypass (>200MHz harmonics)",
      })
    }

    // Extra caps from profile
    if (profile?.extra_caps) {
      bom.push({
        value: profile.extra_caps,
        quantity: 1,
        type: "See description",
        purpose: "IC-specific requirement",
      })
    }

    const layers = args.board_layers ?? 2
    const layoutRules = [
      "Place bypass caps on SAME LAYER as IC, within 3mm of VCC pin.",
      "Route cap to VCC pin directly, then to ground plane via shortest path.",
      "Use wide traces (>0.3mm) or direct pad-to-pad routing for bypass caps.",
      layers >= 4
        ? "Use dedicated ground plane (layer 2). Via directly under bypass cap pad to ground plane."
        : "On 2-layer board: use ground fill on bottom layer. Keep ground return path short.",
      "Do NOT route signal traces between IC and its bypass caps.",
      "Place bulk cap within 10mm of IC. Bulk cap is less placement-critical than bypass.",
    ]

    if (args.ic_type === "dcdc" || args.ic_type === "ldo") {
      layoutRules.push(
        "Input cap MUST be close to regulator input pin.",
        "Output cap MUST be close to regulator output pin.",
        "Keep input and output current loops as small as possible."
      )
    }

    return JSON.stringify(
      {
        ic: profile?.name ?? "Custom IC",
        category: profile?.category ?? "Unknown",
        vcc_pins: vccPins,
        operating_freq_MHz: freqMHz,
        bom,
        layout_rules: layoutRules,
        ...(profile?.notes && { notes: profile.notes }),
        general_tips: [
          "Always use X7R or C0G dielectric. Avoid Y5V (loses capacitance with voltage/temp).",
          "MLCC capacitance drops with DC bias. A '10uF' 0402 at 3.3V may be only 4uF effective.",
          "For critical analog circuits, use C0G caps (no piezoelectric noise).",
          "Check self-resonant frequency (SRF) of bypass caps — must be above operating frequency.",
        ],
      },
      null,
      2
    )
  },
})

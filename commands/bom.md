---
description: Generate or analyze Bill of Materials from KiCad project
---

Extract a Bill of Materials from the KiCad schematic in the current project and output it in a structured format.

## Arguments

`$ARGUMENTS` may contain:
- An output format: `csv` (default), `json`, or `markdown`.
- An output file path (e.g. `bom.csv`, `hardware/bom.json`).
- The keyword `jlcpcb` to format the CSV specifically for JLCPCB SMT assembly.

## Step 1: Find the schematic

Search the project directory for KiCad schematic files:
```
*.kicad_sch
```

If multiple `.kicad_sch` files exist, prefer the top-level one (usually matches the project directory name or contains the most component references). List all found files and state which one you're using.

## Step 2: Parse components

Read the `.kicad_sch` file. It's a text-based S-expression format. Extract every `(symbol ...)` block that has a reference starting with a letter (R, C, U, J, Q, L, D, etc.) and is not a power symbol or graphical annotation.

For each component, collect:
- **Reference** (e.g. `R1`, `C4`, `U2`)
- **Value** (e.g. `10k`, `100nF`, `STM32F103C8T6`)
- **Footprint** (e.g. `Resistor_SMD:R_0402`)
- **LCSC part number** if present in the `LCSC` or `lcsc` property field.
- **Manufacturer part number** if present in `MPN` or `Manufacturer_Part_Number` fields.
- **Datasheet** URL if present.

## Step 3: Group and deduplicate

Group components by identical (Value + Footprint). Within each group:
- List all references together (e.g. `R1, R3, R7`).
- Count the quantity.
- Show the LCSC/MPN if available.

Sort groups by reference prefix, then by value.

## Step 4: Output the BOM

### Standard CSV (default)

```
Reference,Value,Footprint,Quantity,LCSC,MPN,Datasheet
"R1, R3, R7",10k,Resistor_SMD:R_0402,3,C25804,,
"C1, C2",100nF,Capacitor_SMD:C_0402,2,C307331,,
"U1",STM32F103C8T6,Package_QFP:LQFP-48_7x7mm,1,,STM32F103C8T6,https://...
```

### JLCPCB CSV format

JLCPCB requires specific column names for their SMT assembly service:

```
Comment,Designator,Footprint,LCSC Part #
10k,"R1, R3, R7",Resistor_SMD:R_0402,C25804
100nF,"C1, C2",Capacitor_SMD:C_0402,C307331
```

Note: Components without an LCSC part number will be included but flagged with a comment that they need manual sourcing.

### JSON format

```json
[
  {
    "references": ["R1", "R3", "R7"],
    "value": "10k",
    "footprint": "Resistor_SMD:R_0402",
    "quantity": 3,
    "lcsc": "C25804",
    "mpn": null
  }
]
```

### Markdown format

| References | Value | Footprint | Qty | LCSC |
|------------|-------|-----------|-----|------|
| R1, R3, R7 | 10k | R_0402 | 3 | C25804 |

## Step 5: Write output

If an output file path was given in `$ARGUMENTS`, write the BOM to that file. Otherwise print it directly in the chat.

## Summary

After outputting the BOM, print a short summary:
- Total unique component types.
- Total component count.
- How many components are missing LCSC part numbers (relevant for JLCPCB assembly).
- Any DNP (Do Not Populate) components found, listed separately.

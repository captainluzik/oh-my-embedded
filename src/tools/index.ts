import { powerCalculator } from "./power-calculator"
import { impedanceCalculator } from "./impedance-calculator"
import { resistorDivider } from "./resistor-divider"
import { pinMapper } from "./pin-mapper"
import { decouplingAdvisor } from "./decoupling-advisor"

export function createTools() {
  return {
    "embedded-power-calculator": powerCalculator,
    "embedded-impedance-calculator": impedanceCalculator,
    "embedded-resistor-divider": resistorDivider,
    "embedded-pin-mapper": pinMapper,
    "embedded-decoupling-advisor": decouplingAdvisor,
  }
}

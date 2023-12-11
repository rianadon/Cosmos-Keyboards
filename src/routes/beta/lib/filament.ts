const VOLUME_MM2_TO_FILAMENT_M = 0.00042545
const LENGTH_M_TO_WEIGHT_G = 3 // A very coarse estimate
const WEIGHT_G_TO_COST_USD = 25 / 1000 // Again, an estimate
export const SUPPORTS_DENSITY = 0.3

export interface FilamentEstimate {
  length: number
  cost: number
  fractionKeyboard: number
  keyboard: {
    length: number
    cost: number
  }
}

export function filamentCost(volume: number) {
  const length = volume * VOLUME_MM2_TO_FILAMENT_M
  const cost = length * LENGTH_M_TO_WEIGHT_G * WEIGHT_G_TO_COST_USD
  return { length, cost }
}

export function estimateFilament(volume?: number, supportVolume?: number): FilamentEstimate | undefined {
  if (!volume || !supportVolume) return

  const estimatedVolume = volume + supportVolume * SUPPORTS_DENSITY

  const { length, cost } = filamentCost(estimatedVolume)
  const keyboard = filamentCost(volume)

  const fractionKeyboard = volume / (volume + supportVolume * SUPPORTS_DENSITY)
  return { length, cost, keyboard, fractionKeyboard }
}

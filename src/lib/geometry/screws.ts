import type { Cuttleform } from '$lib/worker/config'
import { PLATE_HEIGHT, screwInsertDimensions } from '$lib/worker/model'

const INCH = 25.4 // Multiplication factor for in -> mm

interface Screw {
  mounting: Record<Cuttleform['screwType'], {
    diameter: number
    height: number
    taper?: number
  }>
  /** Clearance hole size */
  plateDiameter: number
  countersunkDiameter: number
  countersunkAngle: number
}

export const SCREWS: Record<Cuttleform['screwSize'], Screw> = {
  M3: {
    mounting: {
      'screw insert': { diameter: 4.3, height: 5 },
      'tapered screw insert': { diameter: 5, height: 4.6, taper: 8 },
      'expanding screw insert': { diameter: 4, height: 4.8 },
      'tapped hole': { diameter: 2.5, height: 4.8 },
    },
    plateDiameter: 3.4,
    countersunkDiameter: 6.3,
    countersunkAngle: 90,
  },
  M4: {
    mounting: {
      'screw insert': { diameter: 5.6, height: 5.5 },
      'tapered screw insert': { diameter: 5.6, height: 5.5, taper: 8 },
      'expanding screw insert': { diameter: 5.6, height: 6.4 },
      'tapped hole': { diameter: 3.3, height: 6.4 },
    },
    plateDiameter: 4.5,
    countersunkDiameter: 9.4,
    countersunkAngle: 90,
  },
  '#4-40': {
    mounting: {
      'screw insert': { diameter: 0.159 * INCH, height: 0.165 * INCH },
      'tapered screw insert': { diameter: 0.153 * INCH, height: 0.165 * INCH, taper: 8 },
      'expanding screw insert': { diameter: 0.156 * INCH, height: 0.188 * INCH },
      'tapped hole': { diameter: 0.089 * INCH, height: 0.188 * INCH },
    },
    plateDiameter: 0.1285 * INCH,
    countersunkDiameter: 0.28125 * INCH,
    countersunkAngle: 82,
  },
  '#6-32': {
    mounting: {
      'screw insert': { diameter: 0.191 * INCH, height: 0.18 * INCH },
      'tapered screw insert': { diameter: 0.199 * INCH, height: 0.18 * INCH, taper: 8 },
      'expanding screw insert': { diameter: 0.188 * INCH, height: 0.25 * INCH },
      'tapped hole': { diameter: 0.107 * INCH, height: 0.25 * INCH },
    },
    plateDiameter: 0.1495 * INCH,
    countersunkDiameter: 0.34375 * INCH,
    countersunkAngle: 82,
  },
}

const COMMON_IMPERIAL = [
  [3, 16],
  [1, 4],
  [5, 16],
  [3, 8],
  [1, 2],
  [5, 8],
].reverse()

const COMMON_METRIC = [5, 6, 8, 10, 12, 16, 20].reverse()

export function closestScrewHeight(c: Cuttleform, height: number, min = -Infinity, max = Infinity) {
  if (c.screwSize == 'M3' || c.screwSize == 'M4') {
    const chosen = COMMON_METRIC.find(s => s < height) || 0
    if (chosen < min) return height + 'mm'
    return chosen + ' mm'
  }
  for (const [a, b] of COMMON_IMPERIAL) {
    const chosen = a / b * 25.4
    if (chosen < height) {
      if (chosen < min) return height / 25.4 + '"'
      return a + '/' + b + '"'
    }
  }
  return '0"'
}

export function screwInsertHeight(c: Cuttleform) {
  return closestScrewHeight(c, PLATE_HEIGHT + screwInsertDimensions(c).height * .75)
}

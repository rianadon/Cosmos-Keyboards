import { Vector } from '$lib/worker/modeling/transformation'

// LiPo pouch cells are named by their nominal dimensions: TTWWLL, where TT is the
// thickness in tenths of a millimeter, WW the width and LL the length in millimeters.
// Real cells vary slightly from nominal, so use a custom size when a datasheet disagrees.

export const BATTERY_SIDE_CLEARANCE = 0.3 // Gap between the cell and the tray walls, on each side
export const BATTERY_SWELL_CLEARANCE = 1 // Extra room above the cell, since LiPo pouches swell with age
export const BATTERY_FLOOR_THICKNESS = 1.2 // Thickness of the tray floor
export const BATTERY_WALL_THICKNESS = 1.2 // Thickness of the tray side walls
export const BATTERY_WALL_HEIGHT_FRACTION = 0.5 // Tray wall height as a fraction of the cell thickness
export const BATTERY_EAR_THICKNESS = 2.5 // Thickness of the ears that screw a separate tray to the case. Fits an M3/M4 countersunk head.
export const BATTERY_BRIDGE_DEPTH = 5 // Furthest the fused tray reaches back to meet a curved or stepped case wall

export interface BatteryDimensions {
  /** Size along the long edge of the cell (mm). */
  length: number
  /** Size along the short edge of the cell (mm). */
  width: number
  /** Thickness of the cell (mm). */
  thickness: number
}

interface BatteryProperties extends BatteryDimensions {
  name: string
}

export const BATTERY_PROPERTIES = {
  'lipo-301230': { name: 'LiPo 301230', thickness: 3, width: 12, length: 30 },
  'lipo-402030': { name: 'LiPo 402030', thickness: 4, width: 20, length: 30 },
  'lipo-502030': { name: 'LiPo 502030', thickness: 5, width: 20, length: 30 },
  'lipo-503035': { name: 'LiPo 503035', thickness: 5, width: 30, length: 35 },
  'lipo-603040': { name: 'LiPo 603040', thickness: 6, width: 30, length: 40 },
} satisfies Record<string, BatteryProperties>

export type BatteryPreset = keyof typeof BATTERY_PROPERTIES
export type Battery = BatteryPreset | { custom: BatteryDimensions }

export function batteryDimensions(battery: Battery): BatteryDimensions {
  if (typeof battery == 'string') {
    const props = BATTERY_PROPERTIES[battery]
    if (!props) throw new Error(`Unknown battery preset "${battery}"`)
    return props
  }
  const { length, width, thickness } = battery.custom
  if (!(length > 0 && width > 0 && thickness > 0)) throw new Error('Battery dimensions must all be positive')
  return battery.custom
}

/**
 * Size of the pocket the cell sits in. X is the width, Y the length, Z the thickness.
 * When alongWall is set the cell lies with its long edge against the wall, so X is the length and Y the width.
 */
export function batteryTrayInnerSize(battery: Battery, alongWall = false): Vector {
  const { length, width, thickness } = batteryDimensions(battery)
  const across = width + 2 * BATTERY_SIDE_CLEARANCE
  const deep = length + 2 * BATTERY_SIDE_CLEARANCE
  return new Vector(alongWall ? deep : across, alongWall ? across : deep, thickness + BATTERY_SWELL_CLEARANCE)
}

/** Height of the tray walls, measured from the bottom of the floor. */
export function batteryTrayWallHeight(battery: Battery): number {
  return BATTERY_FLOOR_THICKNESS + batteryDimensions(battery).thickness * BATTERY_WALL_HEIGHT_FRACTION
}

/**
 * Bounds of the tray in its local frame. Follows the microcontroller holder convention:
 * the edge that attaches to the case wall touches Y=0, the tray extends towards -Y,
 * and the bottom of the floor sits on the XY plane. See batteryTrayInnerSize for alongWall.
 */
export function localBatteryBounds(battery: Battery, alongWall = false) {
  const inner = batteryTrayInnerSize(battery, alongWall)
  const outerX = inner.x + 2 * BATTERY_WALL_THICKNESS
  const outerY = inner.y + 2 * BATTERY_WALL_THICKNESS
  return {
    minx: -outerX / 2,
    maxx: outerX / 2,
    miny: -outerY,
    maxy: 0,
    minz: 0,
    maxz: BATTERY_FLOOR_THICKNESS + inner.z,
  }
}

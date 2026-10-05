import { expect, test } from 'bun:test'
import {
  BATTERY_FLOOR_THICKNESS,
  BATTERY_PROPERTIES,
  BATTERY_SIDE_CLEARANCE,
  BATTERY_SWELL_CLEARANCE,
  BATTERY_WALL_THICKNESS,
  batteryDimensions,
  type BatteryPreset,
  batteryTrayInnerSize,
  batteryTrayWallHeight,
  localBatteryBounds,
} from './batteries'

test('Preset names match their nominal dimensions', () => {
  for (const [key, props] of Object.entries(BATTERY_PROPERTIES)) {
    const [, t, w, l] = key.match(/^lipo-(\d{2})(\d{2})(\d{2})$/)!
    expect(props.thickness).toBe(Number(t) / 10)
    expect(props.width).toBe(Number(w))
    expect(props.length).toBe(Number(l))
  }
})

test('Custom dimensions are used as given', () => {
  const custom = { length: 50, width: 25, thickness: 7 }
  expect(batteryDimensions({ custom })).toEqual(custom)
})

test('Invalid batteries are rejected', () => {
  expect(() => batteryDimensions('lipo-000000' as BatteryPreset)).toThrow()
  expect(() => batteryDimensions({ custom: { length: 30, width: 0, thickness: 5 } })).toThrow()
  expect(() => batteryDimensions({ custom: { length: NaN, width: 20, thickness: 5 } })).toThrow()
})

test('Tray leaves clearance around the cell and room to swell', () => {
  const inner = batteryTrayInnerSize('lipo-502030')
  expect(inner.x).toBeCloseTo(20 + 2 * BATTERY_SIDE_CLEARANCE)
  expect(inner.y).toBeCloseTo(30 + 2 * BATTERY_SIDE_CLEARANCE)
  expect(inner.z).toBeCloseTo(5 + BATTERY_SWELL_CLEARANCE)
  expect(batteryTrayWallHeight('lipo-502030')).toBeCloseTo(BATTERY_FLOOR_THICKNESS + 2.5)
})

test('Local bounds attach at Y=0 and are centered in X', () => {
  const bnd = localBatteryBounds('lipo-502030')
  const inner = batteryTrayInnerSize('lipo-502030')
  expect(bnd.maxy).toBe(0)
  expect(bnd.miny).toBeCloseTo(-(inner.y + 2 * BATTERY_WALL_THICKNESS))
  expect(bnd.minx).toBeCloseTo(-bnd.maxx)
  expect(bnd.maxx - bnd.minx).toBeCloseTo(inner.x + 2 * BATTERY_WALL_THICKNESS)
  expect(bnd.minz).toBe(0)
  expect(bnd.maxz).toBeCloseTo(BATTERY_FLOOR_THICKNESS + inner.z)
})

test('Along the wall, the tray swaps its length and width', () => {
  const across = localBatteryBounds('lipo-603040')
  const along = localBatteryBounds('lipo-603040', true)
  expect(along.maxx - along.minx).toBeCloseTo(across.maxy - across.miny)
  expect(along.maxy - along.miny).toBeCloseTo(across.maxx - across.minx)
  expect(along.maxy).toBe(0)
  expect(along.maxz).toBeCloseTo(across.maxz)
})

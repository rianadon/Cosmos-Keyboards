import { describe, expect, test } from 'bun:test'
import { CuttleKey } from '../../../target/cosmosStructs'
import { minPinsNeeded } from './check'
import { Cuttleform } from './config'

const minPins = (...parts: (CuttleKey['type'] | CuttleKey)[]) =>
  minPinsNeeded({
    keys: parts.map(p => typeof p == 'string' ? { type: p } : p),
  } as Cuttleform)

describe('Min Pins', () => {
  test('No pins needed for empty keyboard', () => {
    expect(minPins()).toBe(0)
  })

  test('SPI Display needs 3 pins', () => {
    expect(minPins('oled-160x68-1.08in-niceview')).toBe(3)
  })

  test('I2C Display needs 3 pins', () => {
    expect(minPins('oled-128x32-0.91in-dfrobot')).toBe(2)
  })

  test('Two I2C Devices share the I2C bus', () => {
    expect(minPins('oled-128x32-0.91in-dfrobot', 'trackpad-azoteq')).toBe(2)
  })

  test('Two SPI Displays share the SPI bus', () => {
    expect(minPins('oled-160x68-1.08in-niceview', 'oled-160x68-1.08in-niceview')).toBe(4)
  })

  test('SPI Display and trackball share the SPI bus', () => {
    const trackball = { type: 'trackball', variant: { sensor: 'Joe (QMK)', size: '34mm', bearings: 'Ball' } } as CuttleKey
    expect(minPins('oled-160x68-1.08in-niceview', trackball)).toBe(5)
  })

  test('Keys use optimal matrix size', () => {
    expect(minPins('mx-pcb', 'mx-pcb', 'mx-pcb', 'mx-pcb')).toBe(4)
    expect(minPins('mx-pcb', 'mx-pcb', 'mx-pcb', 'mx-pcb', 'mx-pcb')).toBe(5)
    expect(minPins('mx-pcb', 'mx-pcb', 'mx-pcb', 'mx-pcb', 'mx-pcb', 'mx-pcb')).toBe(5)
    expect(minPins('mx-pcb', 'mx-pcb', 'mx-pcb', 'mx-pcb', 'mx-pcb', 'mx-pcb', 'mx-pcb')).toBe(6)
    expect(minPins('mx-pcb', 'mx-pcb', 'mx-pcb', 'mx-pcb', 'mx-pcb', 'mx-pcb', 'mx-pcb', 'mx-pcb')).toBe(6)
    expect(minPins('mx-pcb', 'mx-pcb', 'mx-pcb', 'mx-pcb', 'mx-pcb', 'mx-pcb', 'mx-pcb', 'mx-pcb', 'mx-pcb')).toBe(6)
  })

  test('Combine everything', () => {
    // 2 matrix pins (2 rows + 1 col = 3 pins) + 3 pins for SPI + 2 pins for encoder
    expect(minPins('mx-pcb', 'oled-160x68-1.08in-niceview', 'evqwgd001')).toBe(8)
  })
})

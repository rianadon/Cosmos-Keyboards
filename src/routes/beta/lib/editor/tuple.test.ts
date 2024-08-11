import { describe, expect, test } from 'bun:test'
import { ZXYtoZYX, ZYXtoZXY } from './tuple'

const cases: [number, number, number][] = []
for (let x = -80; x < 80; x += 10) {
  for (let y = -80; y < 80; y += 10) {
    for (let z = -80; z < 80; z += 10) {
      cases.push([x, y, z])
    }
  }
}

// describe('tuple', () => {
//   test.each(cases)('(%p, %p, %p) successfully converts', (x, y, z) => {
//     const [a, b, c] = ZXYtoZYX(...ZYXtoZXY(x * 45, y * 45, z * 45))
//     expect(a / 45).toBeCloseTo(x, 5)
//     expect(b / 45).toBeCloseTo(y, 5)
//     expect(c / 45).toBeCloseTo(z, 5)
//   })
// })

test('tuple conversion works', () => {
  for (const [x, y, z] of cases) {
    const [a, b, c] = ZXYtoZYX(...ZYXtoZXY(x * 45, y * 45, z * 45))
    expect(a / 45).toBeCloseTo(x, 5)
    expect(b / 45).toBeCloseTo(y, 5)
    expect(c / 45).toBeCloseTo(z, 5)
  }
})

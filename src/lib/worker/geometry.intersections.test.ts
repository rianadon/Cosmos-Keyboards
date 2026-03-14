import { describe, expect, test } from 'bun:test'
import { intersectLineCylinderTs } from './geometry.intersections'
import { Vector } from './modeling/transformation'

describe('Cylinder intersection', () => {
  test('2D Case 1', () =>
    expect(
      [...intersectLineCylinderTs(new Vector(-5, 0, 0), new Vector(1, 0, 0), new Vector(0, 0, 0), new Vector(0, 0, 10), 1)],
    ).toEqual([4, 6]))

  test('2D Case 2', () =>
    expect(
      [...intersectLineCylinderTs(new Vector(-5, 0, 0), new Vector(1, 0, 0), new Vector(0, 0, 10), new Vector(0, 0, 20), 1)],
    ).toEqual([]))

  test('3D line same axis as cylinder', () =>
    expect(
      [...intersectLineCylinderTs(new Vector(-5, 0, 0), new Vector(1, 0, 0), new Vector(1, 0, 0), new Vector(2, 0, 0), 1)],
    ).toEqual([]))

  test('3D line', () =>
    expect(
      [...intersectLineCylinderTs(new Vector(-5, 0, 0), new Vector(1, 0, 0), new Vector(-10, -10, 0), new Vector(10, 10, 0), 1)],
    ).toEqual([5 - Math.SQRT2, 5 + Math.SQRT2]))
})

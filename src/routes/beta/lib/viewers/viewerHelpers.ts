import { boundingBox, boundingSize } from '$lib/loaders/geometry'
import type { Cuttleform, CuttleKey } from '$lib/worker/config'
import { getRowColumn } from '$lib/worker/config.cosmos'
import type { WallCriticalPoints } from '$lib/worker/geometry'
import type { Vector } from '$lib/worker/modeling/transformation'
import type Trsf from '$lib/worker/modeling/transformation'
import { DefaultMap, objEntries, objEntriesNotNull } from '$lib/worker/util'
import { wallBezier } from '@pro/rounded'
import * as THREE from 'three'
import type { FullGeometry } from './viewer3dHelpers'

export function rectangle(x: number, y: number, size = 1) {
  const shape = new THREE.Shape()
  shape.moveTo(x - size, y - size)
  shape.lineTo(x - size, y + size)
  shape.lineTo(x + size, y + size)
  shape.lineTo(x + size, y - size)
  return new THREE.ShapeGeometry(shape)
}

export function drawWall(wallPts: [number, number][]) {
  const shape = new THREE.Shape()
  shape.moveTo(wallPts[0][0], wallPts[0][1])
  for (const p of wallPts) {
    shape.lineTo(p[0], p[1])
  }
  shape.lineTo(wallPts[0][0], wallPts[0][1])
  return new THREE.ShapeGeometry(shape)
}

export function drawPath(wallPts: [number, number][], width = 0.2) {
  const shapes: THREE.Shape[] = []
  for (let i = 0; i < wallPts.length - 1; i++) {
    const p0 = wallPts[i]
    const p1 = wallPts[i + 1]
    const shape = new THREE.Shape()

    let normal = [p0[1] - p1[1], p1[0] - p0[0]]
    const len = Math.sqrt(normal[0] * normal[0] + normal[1] * normal[1])
    normal = [normal[0] / len * width, normal[1] / len * width]
    shape.moveTo(p0[0] + normal[0], p0[1] + normal[1])
    shape.lineTo(p1[0] + normal[0], p1[1] + normal[1])
    shape.lineTo(p1[0] - normal[0], p1[1] - normal[1])
    shape.lineTo(p0[0] - normal[0], p0[1] - normal[1])
    shapes.push(shape)
  }

  return new THREE.ShapeGeometry(shapes)
}

export function drawLinedWall(wallPts: [number, number][], width = 0.2) {
  const shapes = wallPts.map((p0, i) => {
    const p1 = wallPts[(i + 1) % wallPts.length]
    const shape = new THREE.Shape()

    let normal = [p0[1] - p1[1], p1[0] - p0[0]]
    const len = Math.sqrt(normal[0] * normal[0] + normal[1] * normal[1])
    normal = [normal[0] / len * width, normal[1] / len * width]
    shape.moveTo(p0[0] + normal[0], p0[1] + normal[1])
    shape.lineTo(p1[0] + normal[0], p1[1] + normal[1])
    shape.lineTo(p1[0] - normal[0], p1[1] - normal[1])
    shape.lineTo(p0[0] - normal[0], p0[1] - normal[1])
    return shape
  })

  return new THREE.ShapeGeometry(shapes)
}

function drawBezier(p0: [number, number], p1: [number, number], p2: [number, number], p3: [number, number], width = 0.2) {
  const shape = new THREE.Shape()
  let normal = [p0[1] - p3[1], p3[0] - p0[0]]
  const len = Math.sqrt(normal[0] * normal[0] + normal[1] * normal[1])
  normal = [normal[0] / len * width, normal[1] / len * width]
  shape.moveTo(p0[0] + normal[0], p0[1] + normal[1])
  // shape.lineTo(p3[0] + normal[0], p3[1] + normal[1])
  shape.bezierCurveTo(p1[0] + normal[0], p1[1] + normal[1], p2[0] + normal[0], p2[1] + normal[1], p3[0] + normal[0], p3[1] + normal[1])
  shape.lineTo(p3[0] - normal[0], p3[1] - normal[1])
  shape.bezierCurveTo(p2[0] - normal[0], p2[1] - normal[1], p1[0] - normal[0], p1[1] - normal[1], p0[0] - normal[0], p0[1] - normal[1])
  // shape.lineTo(p0[0] - normal[0], p0[1] - normal[1])
  return shape
}

export function drawBezierWall(conf: Cuttleform, walls: Trsf[], wallCs: WallCriticalPoints[], worldZ: Vector, bottomZ: number, width = 0.2) {
  const shapes = walls.map((a, i) => {
    const b = walls[(i + 1) % walls.length]
    const c = walls[(i + 2) % walls.length]
    const d = walls[(i + 3) % walls.length]
    const wb = wallCs[(i + 1) % walls.length]
    const wc = wallCs[(i + 2) % walls.length]
    const [p0, p1, p2, p3] = wallBezier(conf, a, b, c, d, wb, wc, worldZ, bottomZ).map(p => p.xy())
    return drawBezier(p0, p1, p2, p3, width)
  })
  return new THREE.ShapeGeometry(shapes)
}

export function drawRectangle(x: number, y: number, w: number, h: number) {
  const shape = new THREE.Shape()
  shape.moveTo(x, y)
  shape.lineTo(x + w, y)
  shape.lineTo(x + w, y + h)
  shape.lineTo(x, y + h)
  return new THREE.ShapeGeometry(shape)
}

export function drawLinedRectangle(x: number, y: number, w: number, h: number, width = 0.2) {
  const shape = new THREE.Shape()
  shape.moveTo(x - width, y - width)
  shape.lineTo(x + w + width, y - width)
  shape.lineTo(x + w + width, y + h + width)
  shape.lineTo(x - width, y + h + width)

  const hole = new THREE.Path()
  hole.moveTo(x + width, y + width)
  hole.lineTo(x + w - width, y + width)
  hole.lineTo(x + w - width, y + h - width)
  hole.lineTo(x + width, y + h - width)
  shape.holes = [hole]
  return new THREE.ShapeGeometry(shape)
}

export function drawLinedRectangleOutside(x: number, y: number, w: number, h: number, width = 0.2) {
  const shape = new THREE.Shape()
  shape.moveTo(x - width, y - width)
  shape.lineTo(x + w + width, y - width)
  shape.lineTo(x + w + width, y + h + width)
  shape.lineTo(x - width, y + h + width)

  const hole = new THREE.Path()
  hole.moveTo(x, y)
  hole.lineTo(x + w, y)
  hole.lineTo(x + w, y + h)
  hole.lineTo(x, y + h)
  shape.holes = [hole]
  return new THREE.ShapeGeometry(shape)
}

export function makeBox(cx: number, cy: number, cz: number, w: number, h: number, d: number) {
  return new THREE.BoxGeometry(w, h, d).translate(cx, cy, cz)
}

type Full<T> = { left?: T; right?: T; unibody?: T }

const SEPARATION = 20
export function fullSizes(geo: Full<THREE.BufferGeometry[]>) {
  if (geo.unibody) {
    const size = boundingSize(geo.unibody.map((g) => g))
    return { left: size, both: size, right: size }
  } else {
    const leftBox = boundingBox(
      geo.left!.map((x) => ({ mesh: x, matrix: new THREE.Matrix4().makeScale(-1, 1, 1) })),
    )
    const rightBox = boundingBox(geo.right!.map((g) => g))
    const leftSize = leftBox.getSize(new THREE.Vector3())
    const rightSize = rightBox.getSize(new THREE.Vector3())
    const bothSize = leftBox.union(rightBox).getSize(new THREE.Vector3())
    bothSize.x += SEPARATION - (rightBox.min.x - leftBox.max.x)
    return { left: leftSize, both: bothSize, right: rightSize }
  }
}

type ModifiedKey = { key: CuttleKey; offsetX: number }

function sortKeysFn(a: ModifiedKey, b: ModifiedKey) {
  const aPos = getRowColumn(a.key.position)
  const bPos = getRowColumn(b.key.position)
  const dy = bPos.row - aPos.row

  if (dy > 0.5) return -1
  if (dy < -0.5) return 1
  return aPos.column + a.offsetX - bPos.column - b.offsetX
}

export function sortKeysLogically(keys: ModifiedKey[]) {
  const clusterGroups = new DefaultMap<string, ModifiedKey[]>(() => [])
  for (const k of keys) clusterGroups.get(k.key.cluster).push(k)
  return clusterGroups.values().flatMap(keys => keys.sort(sortKeysFn)).toArray()
}

export function logicalKeys(geo: FullGeometry): CuttleKey[] {
  return sortKeysLogically(
    objEntriesNotNull(geo).flatMap(
      ([kbd, g]) => g.c.keys.map(k => ({ key: k, offsetX: kbd == 'right' ? 1000 : 0 })),
    ),
  ).map(k => k.key)
}

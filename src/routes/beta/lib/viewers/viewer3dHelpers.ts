import { adjacentKeycapLetter, UNIFORM } from '$lib/geometry/keycaps'
import type { Geometry } from '$lib/worker/config'
import { type CosmosCluster, type CosmosKey, type CosmosKeyboard, cosmosKeyPosition, nthKey } from '$lib/worker/config.cosmos'
import { Vector } from '$lib/worker/modeling/transformation'
import type { ShapeMesh } from 'replicad'
import type { Homing, Profile } from 'target/cosmosStructs'
import { Matrix4 } from 'three'

export type KeyboardMeshes = {
  wristBuf?: ShapeMesh
  secondWristBuf?: ShapeMesh
  plateTopBuf?: ShapeMesh
  plateBotBuf?: ShapeMesh
  webBuf?: ShapeMesh
  keyBufs?: { mesh: ShapeMesh; flip: boolean; matrix: Matrix4; mass: number }[]
  wallBuf?: ShapeMesh
  screwBaseBuf?: ShapeMesh
  screwPlateBuf?: ShapeMesh
  holderBuf?: ShapeMesh
  supportGeometries?: ShapeMesh[]
}

type Full<T> = { left?: T; right?: T; unibody?: T }

export type FullKeyboardMeshes = Full<KeyboardMeshes>
export type FullGeometry = Full<Geometry>

/** Returns the midpoint of the range of some numbers. */
function mid(x: (number | undefined)[]) {
  const f = x.filter((v) => typeof v !== 'undefined') as number[]
  if (!f.length) return undefined
  return (Math.max(...f) + Math.min(...f)) / 2
}

/** Returns the center of the transformation tool when selecting a key, column, or cluster. */
export function transformationCenter(
  n: number,
  kbd: CosmosKeyboard,
  mode: 'key' | 'column' | 'cluster',
  zeroPosition = false,
) {
  let { key, column, cluster } = nthKey(kbd, n)
  if (mode != 'key' || zeroPosition) key = { ...key, position: 0n, rotation: 0n } // key position is almost always zeroed
  if (mode == 'cluster' || (mode == 'column' && zeroPosition)) {
    column = { ...column, position: 0n, rotation: 0n }
  }
  if (mode == 'cluster' && zeroPosition) cluster = { ...cluster, position: 0n, rotation: 0n }

  if (mode == 'column') {
    key = {
      ...key,
      row: 0,
      column: mid(column.keys.map((k) => k.column || column.column)),
    }
  }
  if (mode == 'cluster') {
    key = {
      ...key,
      row: 0,
      column: 0,
    }
  }
  return cosmosKeyPosition(key, column, cluster, kbd)
}

/** Returns the key adjacent to the n^th key, given some row/column offset. */
function adjacentKey(kbd: CosmosKeyboard, n: number, dx: number, dy: number) {
  const { key, column, cluster } = nthKey(kbd, n)
  const k: CosmosKey = {
    ...key,
    column: (key.column ?? cluster.column ?? column.column!) + dx,
    row: key.row! + dy,
  }
  const pos = cosmosKeyPosition(k, column, cluster, kbd).evaluate({ flat: false })
  return { dx, dy, pos }
}

/** Returns the key adjacent to the column of the n^th key. In other words,
 * this is where the new column buttons are placed. */
function midColumnKey(kbd: CosmosKeyboard, n: number, dx: number) {
  const { key, column, cluster } = nthKey(kbd, n)
  const startIndex = n - column.keys.indexOf(key)
  const dy = (column.keys[column.keys.length - 1].row! - column.keys[0].row!) / 2
  return adjacentKey(kbd, startIndex, dx, dy)
}

/** Returns the minimum angle to separate two keys on a row on the sphere */
function sphereAngle(column: CosmosCluster, cluster: CosmosCluster, kb: CosmosKeyboard, key: CosmosKey) {
  if (!key.row) return 0
  const spacing = column.curvature.verticalSpacing || cluster.curvature.verticalSpacing || kb.curvature.verticalSpacing
  const angle = 2 * Math.atan(10 / (key.row * spacing - 10))
  const deg = angle * 180 / Math.PI
  return Math.ceil(deg)
}

/** Returns the adjacent positions to a key/column/cluster. */
export function adjacentPositions(
  geo: Geometry | null,
  n: number | null,
  protoConfig: CosmosKeyboard,
  mode: 'key' | 'column' | 'cluster',
) {
  if (n == null || !geo || mode == 'cluster') return []
  const { cluster, column, key } = nthKey(protoConfig, n)
  const side = cluster.side
  const mirror = new Vector(!protoConfig.unibody && side == 'left' ? -1 : 1, 1, 1)
  const positions = geo.keyHolesTrsfs.map((t) => t.origin().multiply(mirror))
  const dx = column.type == 'matrix' ? 1 : sphereAngle(column, cluster, protoConfig, key)
  console.log('dx', dx)
  return (
    mode == 'key'
      ? [
        adjacentKey(protoConfig, n, dx, 0),
        adjacentKey(protoConfig, n, 0, 1),
        adjacentKey(protoConfig, n, -dx, 0),
        adjacentKey(protoConfig, n, 0, -1),
      ]
      : [midColumnKey(protoConfig, n, 1), midColumnKey(protoConfig, n, -1)]
  )
    .filter((a) => !positions.some((b) => a.pos.origin().distanceTo(b) < 15))
    .map(({ dx, dy, pos }) => ({ dx, dy, pos: pos.Matrix4() }))
}

export function addKeyInPlace(keeb: CosmosKeyboard, n: number, dx: number, dy: number): CosmosKey | undefined {
  const { key, column, cluster } = nthKey(keeb, n)
  const col = key.column || column.column
  if (typeof col == 'undefined') return undefined
  const columnCluster = cluster.clusters.find((c) => c.column == col + dx)
  const oldRow = key.profile.row
  let newKey: CosmosKey = {
    profile: {
      letter: adjacentKeycapLetter(key.profile.letter, dx, dy),
      row: typeof oldRow != 'undefined' ? Math.max(0, Math.min(4, oldRow + dy)) : undefined,
      home: null,
    },
    partType: {},
    position: undefined,
    rotation: undefined,
    row: key.row,
  }

  if (dx == 0) {
    newKey = {
      ...newKey,
      position: key.position,
      rotation: key.rotation,
      row: key.row! + dy,
    }
    column.keys.splice(column.keys.indexOf(key) + (dy == 1 ? 1 : 0), 0, newKey)
  } else if (columnCluster) {
    columnCluster.keys.push(newKey)
  } else {
    cluster.clusters.push({
      type: column.type,
      name: cluster.name,
      side: cluster.side,
      partType: {},
      clusters: [],
      curvature: {},
      profile: undefined,
      position: column.position,
      rotation: column.rotation,
      column: col + dx,
      keys: [newKey],
    })
  }
  return newKey
}

export function addColumnInPlace(keeb: CosmosKeyboard, n: number, dx: number): CosmosKey | undefined {
  const { column, cluster } = nthKey(keeb, n)
  const col = column.column
  if (typeof col == 'undefined') return undefined
  const newKeys = column.keys.map(k => ({
    ...JSON.parse(JSON.stringify({ ...k, position: undefined, rotation: undefined })),
    position: k.position,
    rotation: k.rotation,
    profile: {
      ...k.profile,
      letter: adjacentKeycapLetter(k.profile.letter, dx, 0),
    },
  }))
  cluster.clusters.push({
    type: cluster.type,
    name: cluster.name,
    side: cluster.side,
    partType: {},
    clusters: [],
    curvature: {},
    profile: undefined,
    position: column.position,
    rotation: column.rotation,
    column: col + dx,
    keys: newKeys,
  })
  return newKeys[0]
}

export function keyProp(keeb: CosmosKeyboard, n: number | null, prop: keyof CosmosKey & keyof CosmosCluster) {
  if (!n) return ''
  const { key, column, cluster } = nthKey(keeb, n)
  if (typeof key[prop] != 'undefined') return key[prop]
  return column[prop] + ' (col)'
}

export function profileName(p: Profile, full = false) {
  if (p == 'cherry') return 'Cherry'
  if (p == 'choc') return full ? 'Choc (Kailh)' : 'Choc'
  if (p == null) return 'null'
  let name = p.toUpperCase()
  if (full && UNIFORM.includes(p)) name += ' (Uniform)'
  return name
}
export function formatProfile(keeb: CosmosKeyboard, n: number | null) {
  if (!n) return ''
  const { key, column, cluster } = nthKey(keeb, n)
  if (key.profile.profile) return profileName(key.profile.profile)
  if (column.profile) return profileName(column.profile) + ' (col)'
  if (cluster.profile) return profileName(cluster.profile) + ' (clr)'
  return profileName(keeb.profile) + ' (kb)'
}
/** Sorts profiles so that choc goes last. Poor choc. */
export function sortProfiles(a: Profile, b: Profile) {
  const val = (v: Profile) => {
    if (v == 'choc') return 100
    if (UNIFORM.includes(v)) return 0
    return 1
  }
  return val(a) - val(b)
}

export function formatHoming(key: CosmosKey) {
  if (!key.profile.home) return ''
  return key.profile.home[0].toUpperCase() + key.profile.home.substring(1)
}

export function kbdOffset(kbd: 'left' | 'right' | 'unibody') {
  return 0
  // if (kbd == 'left') return -90
  // if (kbd == 'right') return 90
  // return 0
}

export function flipMatrixX(mat: Matrix4) {
  const [a, e, i, m, b, f, j, n, c, g, k, o, d, h, l, p] = mat.elements
  return new Matrix4(a, -b, -c, -d, -e, f, g, h, -i, j, k, l, -m, n, o, p)
}

export function shouldFlipKey(side: 'left' | 'right' | 'both', clickedKey: number | null, keyboard: CosmosKeyboard) {
  if (clickedKey == null) return false
  const { cluster } = nthKey(keyboard, clickedKey)
  return side == 'left' && cluster.side == 'right'
}

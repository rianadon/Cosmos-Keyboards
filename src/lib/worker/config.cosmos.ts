import ETrsf, { mirror } from '$lib/worker/modeling/transformation-ext'
// import { deserialize } from 'src/routes/beta/lib/serialize'
import { Matrix4, Vector3 } from 'three'
import { type ClusterName, type ClusterSide, type ClusterType, type Connector, decodeClusterFlags, encodeClusterFlags, type ScrewFlags } from '../../../target/cosmosStructs'
import type { Curvature } from '../../../target/proto/cosmos'
import { type AnyShell, type Cuttleform, type CuttleKey, type CuttleKeycapKey, decodeTuple, encodeTuple, type FullCuttleform, type Keycap, matrixToRPY, tupleToRot, tupleToXYZ } from './config'
import { decodePartType, encodePartType } from './config.serialize'
import Trsf from './modeling/transformation'
import { DefaultMap, TallyMap } from './util'

export interface PartType {
  type?: CuttleKey['type']
  aspect?: number
}

export interface Profile {
  profile?: Keycap['profile'] // 4 bits
  row?: number // 3 bits
  letter?: string // 7 bits
  home: Exclude<Keycap['home'], undefined> | null // 3 bits
}

type CosmosCurvature = Curvature

export type CosmosCluster = {
  name: ClusterName
  side: ClusterSide
  type: ClusterType
  curvature: CosmosCurvature
  profile: Keycap['profile'] | undefined
  partType: PartType
  clusters: CosmosCluster[]
  keys: CosmosKey[]
  position: bigint | undefined
  rotation: bigint | undefined
  column?: number
}
export type CosmosKey = {
  profile: Profile
  partType: PartType
  row?: number
  column?: number
  position: bigint | undefined
  rotation: bigint | undefined
  sizeA?: number
  sizeB?: number
}
export type CosmosKeyboard =
  & {
    curvature: Required<CosmosCurvature>
    profile: Keycap['profile']
    partType: PartType
    wallShrouding: number
    wallThickness: number
    keyBasis: Keycap['profile']
    screwIndices: number[]
    microcontroller: Cuttleform['microcontroller'] | null
    fastenMicrocontroller: boolean
    clusters: CosmosCluster[]
    verticalClearance: number
    rounded: Cuttleform['rounded']
    webMinThicknessFactor: number
    shell: AnyShell
    wristRestEnable: boolean
    wristRestProps: Exclude<Cuttleform['wristRest'], undefined>
    wristRestPosition: bigint
  }
  & ScrewFlags
  & Connector

/**
 * List of parts that are used with physical keys.
 * All of these have configurable key aspect ratios.
 */
export const PARTS_WITH_KEYCAPS = [
  'mx-better',
  'mx-pcb',
  'mx-hotswap',
  'alps',
  'choc',
  'choc-hotswap',
  'old-mx',
  'old-box',
  'old-mx-hotswap',
  'old-mx-hotswap',
  'old-mx-snap-in-hotswap',
  'blank',
]

function toCosmosClusters(keys: CuttleKey[], side: 'left' | 'right', globalProfile: Profile, globalPartType: PartType, globalCurvature: Curvature, wrOriginInv: Trsf) {
  const clusters: CosmosCluster[] = []

  for (const [trsf, trsfGrp] of collectByTransformBy(keys).entries()) {
    const clusterCurvature = dominantCurvature(trsfGrp)
    const clusterProfile = dominantProfile(trsfGrp) ?? globalProfile
    const clusterPartType = decodePartType(dominantPartType(trsfGrp) ?? encodePartType(globalPartType))
    const clusterType = decodeClusterFlags(dominantClusterType(trsfGrp, side))
    const clusterTrsf = new Trsf().fromMatrix(trsf.split(',').map(Number))
    const clusterTrsfInv = clusterTrsf.inverted()
    const cluster: CosmosCluster = {
      ...clusterType,
      clusters: [],
      keys: [],
      partType: {
        type: diff(clusterPartType.type, globalPartType.type),
        aspect: diff(clusterPartType.aspect, globalPartType.aspect),
      },
      curvature: diffCurvature(clusterCurvature, globalCurvature),
      profile: diff(clusterProfile, globalProfile),
      ...toPosRotation(clusterTrsf.premultiplied(wrOriginInv).Matrix4()),
    }
    clusters.push(cluster)
    for (const [col, colGrp] of collectByColumn(trsfGrp)) {
      const columnCurvature = dominantCurvature(colGrp)
      const columnProfile = dominantProfile(colGrp) ?? clusterProfile
      const columnPartType = decodePartType(dominantPartType(colGrp) ?? encodePartType(clusterPartType))
      const columnStagger = dominantStagger(colGrp)
      const columnType = decodeClusterFlags(dominantClusterType(colGrp, side))
      const columnTrsf = new Trsf().fromMatrix(columnStagger.split(',').map(Number))
      const columnTrsfInv = columnTrsf.inverted()
      const column: CosmosCluster = {
        ...columnType,
        clusters: [],
        keys: [],
        partType: {
          type: diff(columnPartType.type, clusterPartType.type),
          aspect: diff(columnPartType.aspect, clusterPartType.aspect),
        },
        column: col,
        curvature: diffCurvature(columnCurvature, clusterCurvature),
        profile: diff(columnProfile, clusterProfile ?? globalProfile),
        ...toPosRotation(columnTrsf.Matrix4()),
      }
      cluster.clusters.push(column)
      for (const colKey of colGrp) {
        let keyRow = 0
        const matOp = colKey.position.history.find(h => h.name == 'placeOnMatrix')
        const sphereOp = colKey.position.history.find(h => h.name == 'placeOnSphere')

        let matsphTrsf = new Trsf()
        if (matOp) {
          // @ts-check
          const opts: any = 'merged' in matOp.args[0] ? matOp.args[0].merged : matOp.args[0]
          keyRow = opts.row
          matsphTrsf = new ETrsf([matOp]).evaluate({ flat: false }, new Trsf())
        } else if (sphereOp) {
          // @ts-ignore
          const opts: any = 'merged' in sphereOp.args[0] ? sphereOp.args[0].merged : sphereOp.args[0]
          keyRow = opts.row
          matsphTrsf = new ETrsf([sphereOp]).evaluate({ flat: false }, new Trsf())
        }

        const trsf = new ETrsf(colKey.position.history).evaluate({ flat: false }, new Trsf())
          .premultiply(clusterTrsfInv)
          .premultiply(columnTrsfInv)
          .premultiply(matsphTrsf.invert())

        const keyType = decodePartType(encodePartType(colKey))
        const keycap = 'keycap' in colKey ? colKey.keycap : undefined
        column.keys.push({
          partType: {
            type: diff(keyType.type, columnPartType.type),
            aspect: diff(keyType.aspect, columnPartType.aspect),
          },
          profile: {
            profile: diff(keycap?.profile, columnProfile ?? clusterProfile ?? globalProfile),
            letter: keycap?.letter,
            row: keycap?.row ?? 5,
            home: keycap?.home ?? null,
          },
          row: keyRow,
          sizeA: undefined,
          sizeB: undefined,
          ...toPosRotation(trsf.Matrix4()),
        })
      }
    }
  }
  return clusters
}

export function toCosmosConfig(conf: Cuttleform): CosmosKeyboard {
  const globalCurvature = dominantCurvature(conf.keys)
  const globalProfile = dominantProfile(conf.keys) ?? 'xda'
  const globalPartType = decodePartType(dominantPartType(conf.keys) ?? encodePartType({ type: 'mx-better', aspect: 1 }))
  const wrOriginInv = conf.wristRestOrigin.evaluate({ flat: false }, new Trsf()).invert()

  const keyboard: CosmosKeyboard = {
    curvature: globalCurvature,
    profile: globalProfile,
    partType: globalPartType,
    wallShrouding: conf.wallShrouding,
    wallThickness: conf.wallThickness,
    webMinThicknessFactor: conf.webMinThicknessFactor,
    keyBasis: conf.keyBasis,
    connector: conf.connector,
    connectorSizeUSB: conf.connectorSizeUSB,
    screwIndices: conf.screwIndices,
    screwSize: conf.screwSize,
    screwType: conf.screwType,
    screwCountersink: conf.screwCountersink,
    clearScrews: conf.clearScrews,
    microcontroller: conf.microcontroller,
    fastenMicrocontroller: conf.fastenMicrocontroller,
    verticalClearance: conf.verticalClearance,
    rounded: conf.rounded,
    shell: conf.shell,
    wristRestEnable: !!conf.wristRest,
    wristRestProps: conf.wristRest || {
      angle: 10,
      slope: 5,
      maxWidth: 100,
      tenting: 6,
    },
    wristRestPosition: encodeTuple([100, -1000, 0]),
    clusters: [
      ...toCosmosClusters(conf.keys, 'right', globalProfile, globalPartType, globalCurvature, wrOriginInv),
      // ...toCosmosClusters(mirror(conf.keys).slice(conf.keys.length), 'left', globalProfile, globalPartType, globalCurvature, wrOriginInv),
    ],
  }
  return keyboard
}

function dominantCurvature(keys: CuttleKey[]) {
  const horizontalSpacings = new TallyMap<number>()
  const verticalSpacings = new TallyMap<number>()
  const rowCurvatures = new TallyMap<number>()
  const columnCurvatures = new TallyMap<number>()
  const arcs = new TallyMap<number>()

  for (const key of keys) {
    for (const h of key.position.history) {
      if (h.name == 'placeOnMatrix') {
        const opts: any = 'merged' in h.args[0] ? h.args[0].merged : h.args[0]
        horizontalSpacings.incr(opts.spacingOfColumns)
        verticalSpacings.incr(opts.spacingOfRows)
        rowCurvatures.incr(opts.curvatureOfRow)
        columnCurvatures.incr(opts.curvatureOfColumn)
        arcs.incr(opts.arc || 0)
      }
    }
  }
  return {
    horizontalSpacing: horizontalSpacings.max(),
    verticalSpacing: verticalSpacings.max(),
    curvatureA: rowCurvatures.max(),
    curvatureB: columnCurvatures.max(),
    arc: arcs.max(),
  }
}

function sideFromCosmosConfig(c: CosmosKeyboard, side: 'left' | 'right'): Cuttleform {
  const wrPos = decodeTuple(c.wristRestPosition)
  const conf: Cuttleform = {
    wallThickness: c.wallThickness,
    wallShrouding: c.wallShrouding,
    webThickness: 0,
    webMinThicknessFactor: c.webMinThicknessFactor,
    verticalClearance: c.verticalClearance,
    keyBasis: c.keyBasis,
    keys: [],
    screwIndices: c.screwIndices,
    screwCountersink: c.screwCountersink,
    screwSize: c.screwSize,
    screwType: c.screwType,
    clearScrews: c.clearScrews,
    rounded: JSON.parse(JSON.stringify(c.rounded)),
    connector: c.connector,
    connectorSizeUSB: c.connectorSizeUSB,
    connectorIndex: -1,
    microcontroller: c.microcontroller,
    fastenMicrocontroller: c.fastenMicrocontroller,
    wristRest: c.wristRestEnable ? { ...c.wristRestProps } : undefined,
    wristRestOrigin: new ETrsf().translate(wrPos[0] / 10, wrPos[1] / 10, wrPos[2] / 10),
    shell: c.shell,
  }
  for (const clusterA of c.clusters.filter(c => c.side == side)) {
    for (const clusterB of clusterA.clusters) {
      for (const key of clusterB.keys) {
        const cuttleKey: CuttleKey = {
          type: key.partType.type || clusterB.partType.type || clusterA.partType.type || c.partType.type,
          aspect: key.partType.aspect || clusterB.partType.aspect || clusterA.partType.aspect || c.partType.aspect,
          cluster: clusterB.name || clusterA.name,
          position: cosmosKeyPosition(key, clusterB, clusterA, c),
        } as any
        if (PARTS_WITH_KEYCAPS.includes(cuttleKey.type)) {
          ;(cuttleKey as CuttleKeycapKey).keycap = {
            letter: key.profile.letter,
            home: key.profile.home ?? undefined,
            row: key.profile.row!,
            profile: key.profile.profile || clusterB.profile || clusterA.profile || c.profile,
          }
        } else {
          cuttleKey.aspect = 1
        }
        if (cuttleKey.type == 'blank') cuttleKey.size = { width: key.sizeA!, height: key.sizeB! }
        conf.keys.push(cuttleKey)
      }
    }
  }
  return conf.keys.length ? conf : undefined
}

export function fromCosmosConfig(c: CosmosKeyboard): FullCuttleform {
  return {
    left: sideFromCosmosConfig(c, 'left'),
    right: sideFromCosmosConfig(c, 'right'),
  }
}

export function cosmosKeyPosition(key: CosmosKey, column: CosmosCluster, cluster: CosmosCluster, keeb: CosmosKeyboard): ETrsf {
  const clusterTrsf = rotationPositionETrsf(cluster)
  const columnTrsf = rotationPositionETrsf(column)
  const trsf = rotationPositionETrsf(key) || new ETrsf()

  const col = key.column ?? column.column ?? cluster.column
  const row = key.row
  if (typeof row !== 'undefined' && typeof col !== 'undefined') {
    // console.log(JSON.stringify(clusterTrsf), JSON.stringify(columnTrsf))
    const curvature = { ...trimUndefined(keeb.curvature), ...trimUndefined(cluster.curvature), ...trimUndefined(column.curvature) } as Required<Curvature>

    if (cluster.type == 'matrix') {
      trsf.placeOnMatrix({
        column: col,
        row: row,
        spacingOfColumns: curvature.horizontalSpacing,
        spacingOfRows: curvature.verticalSpacing,
        curvatureOfRow: curvature.curvatureA,
        curvatureOfColumn: curvature.curvatureB,
        arc: curvature.arc,
      })
    }
  }
  if (columnTrsf) trsf.transformBy(columnTrsf)
  if (clusterTrsf) trsf.transformBy(clusterTrsf)

  if (cluster.side == 'left') trsf.mirror([1, 0, 0])
  return trsf
}

function rotationPositionETrsf(c: CosmosCluster | CosmosKey) {
  if (!c.position && !c.rotation) return undefined
  const trsf = new ETrsf()
  if (c.rotation) {
    const rot = tupleToRot(c.rotation)
    trsf.rotate(rot.alpha, [0, 0, 0], [1, 0, 0])
      .rotate(rot.beta, [0, 0, 0], [0, 1, 0])
      .rotate(rot.gamma, [0, 0, 0], [0, 0, 1])
  }
  if (c.position) trsf.translate(tupleToXYZ(c.position))
  return trsf
}

function dominantProfile(keys: CuttleKey[]) {
  const profiles = new TallyMap<Keycap['profile']>()
  keys.forEach(k => 'keycap' in k && k.keycap && profiles.incr(k.keycap.profile))
  return profiles.max()
}

function dominantPartType(keys: CuttleKey[]) {
  const types = new TallyMap<number>()
  keys.forEach(k => types.incr(encodePartType(k)))
  return types.max()
}

function dominantStagger(keys: CuttleKey[]) {
  const trsfs = new TallyMap<string>()
  for (const key of keys) {
    let hist = key.position.history
    let ind = hist.findIndex(h => h.name == 'placeOnMatrix' || h.name == 'placeOnSphere')
    if (ind >= 0) hist = hist.slice(ind + 1)
    ind = hist.findIndex(h => h.name == 'transformBy')
    if (ind >= 0) hist = hist.slice(0, ind)
    const trsf = new ETrsf(hist).evaluate({ flat: false }, new Trsf())
    const mat = trsf.matrix().join(',')
    trsfs.incr(mat)
  }
  const max = trsfs.max()
  // Only return if at least 2 keys share the same stagger
  if (!max || trsfs.get(max) <= 1) return new Trsf().matrix().join(',')
  return max
}

function dominantClusterType(keys: CuttleKey[], side: 'right' | 'left') {
  const clusterNames = new TallyMap<ClusterName>()
  const clusterTypes = new TallyMap<ClusterType>()
  for (const key of keys) {
    clusterNames.incr(key.cluster as ClusterName)
    if (key.position.history.find(h => h.name == 'placeOnMatrix')) clusterTypes.incr('matrix')
    if (key.position.history.find(h => h.name == 'placeOnSphere')) clusterTypes.incr('sphere')
  }
  return encodeClusterFlags({ type: clusterTypes.max() ?? 'matrix', name: clusterNames.max() ?? 'fingers', side })
}

function collectByTransformBy(keys: CuttleKey[]) {
  const trsfs = new DefaultMap<string, CuttleKey[]>(() => [])
  for (const key of keys) {
    const transformBy = key.position.history.find(h => h.name == 'transformBy')
    if (transformBy) {
      // @ts-ignore
      const trsf = new ETrsf(transformBy.args[0].history)
      const mat = trsf.evaluate({ flat: false }, new Trsf()).matrix().join(',')
      trsfs.get(mat).push(key)
    } else {
      trsfs.get('').push(key)
    }
  }
  return trsfs
}

function collectByColumn(keys: CuttleKey[]) {
  const matrices = new DefaultMap<number, CuttleKey[]>(() => [])
  const spheres = new DefaultMap<number, CuttleKey[]>(() => [])
  const rest: CuttleKey[] = []
  for (const key of keys) {
    const matOp = key.position.history.find(h => h.name == 'placeOnMatrix')
    const sphereOp = key.position.history.find(h => h.name == 'placeOnSphere')
    if (matOp) {
      // @ts-ignore
      const opts: any = 'merged' in matOp.args[0] ? matOp.args[0].merged : matOp.args[0]
      matrices.get(opts.column).push(key)
    } else if (sphereOp) {
      // @ts-ignore
      const opts: any = 'merged' in sphereOp.args[0] ? sphereOp.args[0].merged : sphereOp.args[0]
      spheres.get(opts.angle).push(key)
    } else {
      rest.push(key)
    }
  }
  const results: [number, CuttleKey[]][] = [...matrices.entries(), ...spheres.entries()]
  if (rest.length) results.push([0, rest])
  return results
}

export function toPosRotation(m: Matrix4) {
  const translation = new Vector3().setFromMatrixPosition(m)
  const rpy = matrixToRPY(m)
  const pos = encodeTuple([Math.round(translation.x * 10), Math.round(translation.y * 10), Math.round(translation.z * 10)])
  const rot = encodeTuple([Math.round(rpy[0] * 45), Math.round(rpy[1] * 45), Math.round(rpy[2] * 45)])
  return {
    position: pos != 0n ? pos : undefined,
    rotation: rot != 0n ? rot : undefined,
  }
}

function diffCurvature(c: Curvature, parent: Curvature): Curvature {
  const trimmed = { ...c }
  for (const key of Object.keys(c) as (keyof Curvature)[]) {
    if (parent[key] == trimmed[key]) delete trimmed[key]
    if (typeof trimmed[key] == 'undefined') delete trimmed[key]
  }
  return trimmed
}
function diff<T>(n: T, parent: T) {
  if (n == parent) return undefined
  return n
}

function trimUndefined<T extends object>(a: T) {
  for (const key of Object.keys(a) as (keyof T)[]) {
    if (typeof a[key] === 'undefined') delete a[key]
  }
  return a
}

export function nthKey(conf: CosmosKeyboard, n: number) {
  let i = 0
  for (const cluster of conf.clusters) {
    for (const column of cluster.clusters) {
      for (const key of column.keys) {
        if (i == n) return { key, cluster, column }
        i++
      }
    }
  }
  throw new Error(`Key ${n} not in bounds`)
}

export function indexOfKey(conf: CosmosKeyboard, test: CosmosKey): number | null {
  let i = 0
  for (const cluster of conf.clusters) {
    for (const column of cluster.clusters) {
      for (const key of column.keys) {
        if (key == test) return i
        i++
      }
    }
  }
  return null
}

export function nthPartType(conf: CosmosKeyboard, n: number, mode: 'key' | 'column' | 'cluster') {
  const { key, column, cluster } = nthKey(conf, n)
  let type = cluster.partType.type || conf.partType.type!
  if (mode == 'cluster') return type
  type = column.partType.type || type
  if (mode == 'column') return type
  return key.partType.type || type
}

export function nthPartAspect(conf: CosmosKeyboard, n: number, mode: 'key' | 'column' | 'cluster') {
  const { key, column, cluster } = nthKey(conf, n)
  let type = cluster.partType.aspect ?? conf.partType.aspect!
  if (mode == 'cluster') return type
  type = column.partType.aspect ?? type
  if (mode == 'column') return type
  return key.partType.aspect ?? type
}

export function nthProfile(conf: CosmosKeyboard, n: number, mode: 'key' | 'column' | 'cluster') {
  const { key, column, cluster } = nthKey(conf, n)
  let prof = cluster.profile ?? conf.profile
  if (mode == 'cluster') return prof
  prof = column.profile ?? prof
  if (mode == 'column') return prof
  return key.profile.profile ?? prof
}

export function nthCurvature(conf: CosmosKeyboard, n: number, elem: keyof Curvature, mode: 'column' | 'cluster' | 'kb') {
  const { column, cluster } = nthKey(conf, n)
  let curv = conf.curvature[elem]
  if (mode == 'kb') return curv
  curv = cluster.curvature[elem] ?? curv
  if (mode == 'cluster') return curv
  curv = column.curvature[elem] ?? curv
  if (mode == 'column') return curv
}

export function isNthLastColumn(conf: CosmosKeyboard, n: number) {
  const { column, cluster } = nthKey(conf, n)
  return cluster.clusters.every(c => column.column! >= c.column!)
}

export function isNthFirstColumn(conf: CosmosKeyboard, n: number) {
  const { column, cluster } = nthKey(conf, n)
  return cluster.clusters.every(c => column.column! <= c.column!)
}

/** Find the index of the nth key after filtering all keys to a certain side */
export function nthIndex(conf: CosmosKeyboard, side: 'right' | 'left' | 'unibody', n: number) {
  if (side == 'unibody') return n
  let i = 0
  let j = 0
  for (const cluster of conf.clusters) {
    for (const column of cluster.clusters) {
      for (const key of column.keys) {
        if (cluster.side == side) {
          if (j == n) return i
          j++
        }
        i++
      }
    }
  }
  return null
}

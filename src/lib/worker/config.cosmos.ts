import ETrsf, { Constant, fullMirrorETrsf, type MatrixOptions, mirror } from '$lib/worker/modeling/transformation-ext'
// import { deserialize } from 'src/routes/beta/lib/serialize'
import { flippedKey } from '$lib/geometry/keycaps'
import { PART_INFO, socketSize } from '$lib/geometry/socketsParts'
import { type ClusterName, type ClusterSide, type ClusterType, type Connector, decodeClusterFlags, encodeClusterFlags, type ScrewFlags } from '$target/cosmosStructs'
import type { Curvature } from '$target/proto/cosmos'
import { Matrix4, Vector3 } from 'three'
import {
  type AnyShell,
  curvature,
  type Cuttleform,
  type CuttleKey,
  type CuttleKeycapKey,
  decodeTuple,
  encodeTuple,
  type FullCuttleform,
  type Keycap,
  matrixToRPY,
  tupleToRot,
  tupleToXYZ,
} from './config'
import { decodePartType, encodePartType, KEYBOARD_DEFAULTS } from './config.serialize'
import Trsf from './modeling/transformation'
import { capitalize, DefaultMap, objEntries, objKeys, sum, TallyMap, trimUndefined } from './util'

export type CustomConnector = {
  preset?: undefined
  width: number
  height: number
  x: number
  y: number
  radius: number
}
export type ConnectorMaybeCustom = {
  preset: 'usb'
  size: 'slim' | 'average' | 'big'
} | {
  preset: 'trrs'
} | CustomConnector

export interface PartType {
  type?: CuttleKey['type']
  aspect?: number
  variant?: number
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
    microcontrollerAngle: number
    fastenMicrocontroller: boolean
    clusters: CosmosCluster[]
    verticalClearance: number
    rounded: Cuttleform['rounded']
    webMinThicknessFactor: number
    shell: AnyShell
    wristRestEnable: boolean
    unibody: boolean
    wristRestProps: Exclude<Cuttleform['wristRest'], undefined>
    wristRestPosition: bigint
    connectorIndex: number
  }
  & ScrewFlags
  & Connector

export const ROUND_PARTS = objKeys(PART_INFO).filter(p => 'radius' in socketSize({ type: p, variant: {} } as any))
export const PARTS_WITH_KEYCAPS = objKeys(PART_INFO).filter(p => PART_INFO[p].keycap)

function getRowColumn(t: ETrsf) {
  let row = 0
  let column = 0
  let type: ClusterType | undefined = undefined
  for (const h of t.history) {
    if (h.name == 'placeOnMatrix') {
      const opts: any = 'merged' in h.args[0] ? h.args[0].merged : h.args[0]
      row = opts.row
      column = opts.column
      type = 'matrix'
    } else if (h.name == 'placeOnSphere') {
      const opts: any = 'merged' in h.args[0] ? h.args[0].merged : h.args[0]
      row = opts.row
      column = opts.angle
      type = 'sphere'
    } else if (h.name == 'placeColumn') {
      const opts: any = 'merged' in h.args[0] ? h.args[0].merged : h.args[0]
      column = opts.column
      type = 'matrix'
    } else if (h.name == 'placeRow') {
      const opts: any = 'merged' in h.args[0] ? h.args[0].merged : h.args[0]
      row = opts.row
      type = 'matrix'
    }
  }
  return { row, column, type }
}

export function sortClusters(clusters: CosmosCluster[]) {
  const val = (c: CosmosCluster) => {
    let v = 0
    if (c.side == 'left') v += 10
    if (c.name == 'thumbs') v += 1
    return v
  }
  return clusters.sort((a, b) => val(a) - val(b))
}

function toCosmosClusters(keys: CuttleKey[], side: 'left' | 'right', globalProfile: Profile, globalPartType: PartType, globalCurvature: Curvature, wrOriginInv: Trsf) {
  const clusters: CosmosCluster[] = []

  for (const [name, trsfGrp] of collectByClusterName(keys).entries()) {
    const clusterCurvature = dominantCurvature(trsfGrp)
    const clusterProfile = dominantProfile(trsfGrp) ?? globalProfile
    const clusterPartType = decodePartType(dominantPartType(trsfGrp) ?? encodePartType(globalPartType))
    const clusterType = decodeClusterFlags(dominantClusterType(trsfGrp, side))
    const clusterTrsf = getTransformBy(trsfGrp[0])!
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
      let columnTrsf = new Trsf().fromMatrix(columnStagger.split(',').map(Number))
      if (columnStagger.startsWith('!')) {
        columnTrsf = new Trsf().fromMatrix(columnStagger.slice(1).split(',').map(Number))
        columnTrsf = rotateColumnStagger(columnTrsf, col, columnCurvature)
      }
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
        const { row: keyRow } = getRowColumn(colKey.position)
        const trsfSoFar = cosmosKeyPosition(
          { row: keyRow } as any,
          column,
          { ...cluster, ...toPosRotation(clusterTrsf.Matrix4()) }, // Override cluster position to be independent of wrOriginInv
          { partType: globalPartType, profile: globalProfile.profile, curvature: globalCurvature, clusters } as any,
        ).evaluate({ flat: false })
        const trsf = new ETrsf(colKey.position.history).evaluate({ flat: false }).premultiplied(trsfSoFar.invert())

        const keyType = decodePartType(encodePartType(colKey))
        const keycap = 'keycap' in colKey ? colKey.keycap : undefined

        let size = { sizeA: undefined as number | undefined, sizeB: undefined as number | undefined }
        if (colKey.type == 'blank') size = { sizeA: colKey.size.width, sizeB: colKey.size.height }
        if (ROUND_PARTS.includes(colKey.type)) size = { sizeA: undefined, sizeB: (colKey as any).size.sides }

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
          sizeA: size.sizeA,
          sizeB: size.sizeB,
          ...toPosRotation(trsf.Matrix4()),
        })
      }
    }
  }
  const defaultCluster = {
    type: 'matrix' as const,
    side: side,
    curvature: {},
    profile: undefined,
    partType: {},
    clusters: [],
    keys: [],
    position: undefined,
    rotation: undefined,
  }
  if (!clusters.find(c => c.name == 'fingers')) clusters.push({ ...defaultCluster, name: 'fingers' })
  if (!clusters.find(c => c.name == 'thumbs')) clusters.push({ ...defaultCluster, name: 'thumbs' })
  return clusters
}

export function stringifyCluster(cluster: CosmosCluster | undefined) {
  if (!cluster) return ''
  return JSON.stringify({
    ...cluster,
    clusters: cluster.clusters.map(col => ({
      ...col,
      keys: col.keys.map(k => ({
        ...k,
        position: '' + k.position,
        rotation: '' + k.rotation,
      })),
      position: '' + col.position,
      rotation: '' + col.rotation,
    })),
    position: '' + cluster.position,
    rotation: '' + cluster.rotation,
  })
}

export function toFullCosmosConfig(conf: FullCuttleform, flipLeft = false): CosmosKeyboard {
  let kbd: CosmosKeyboard | undefined = undefined
  for (const [side, config] of objEntries(conf)) {
    if (!kbd) kbd = toCosmosConfig(config!, side, false, flipLeft)
    else kbd.clusters.push(...toCosmosConfig(config!, side, false, flipLeft).clusters)
  }
  if (!kbd) throw new Error('No configuration for keyboard')

  // If the clusters are exactly mirrored, make them mirrored in the configuration
  // This halves the URL size and gives better editing experience
  const rightFingers = kbd.clusters.find(c => c.side == 'right' && c.name == 'fingers')
  const leftFingers = kbd.clusters.find(c => c.side == 'left' && c.name == 'fingers')
  if (rightFingers && leftFingers && stringifyCluster(mirrorCluster(rightFingers)) == stringifyCluster(leftFingers)) {
    kbd.clusters.splice(kbd.clusters.indexOf(leftFingers), 1)
  }
  const rightThumbs = kbd.clusters.find(c => c.side == 'right' && c.name == 'thumbs')
  const leftThumbs = kbd.clusters.find(c => c.side == 'left' && c.name == 'thumbs')
  if (rightThumbs && leftThumbs && stringifyCluster(mirrorCluster(rightThumbs)) == stringifyCluster(leftThumbs)) {
    kbd.clusters.splice(kbd.clusters.indexOf(leftThumbs), 1)
  }
  sortClusters(kbd.clusters)
  return kbd
}

export function toCosmosConfig(conf: Cuttleform, side: 'left' | 'right' | 'unibody', overrideWristRest: boolean, flipLeft = false): CosmosKeyboard {
  const globalCurvature = dominantCurvature(conf.keys)
  const globalProfile = dominantProfile(conf.keys) ?? 'xda'
  const globalPartType = decodePartType(dominantPartType(conf.keys) ?? encodePartType({ type: 'mx-better', aspect: 1 }))
  const wrOrigin = new ETrsf(conf.wristRestOrigin.history).evaluate({ flat: false }, new Trsf())
  const wrOriginInv = overrideWristRest ? wrOrigin.inverted() : new Trsf()
  const flippedWrOriginInv = overrideWristRest ? fullMirrorETrsf(conf.wristRestOrigin).evaluate({ flat: false }).invert() : new Trsf()

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
    microcontrollerAngle: conf.microcontrollerAngle,
    fastenMicrocontroller: conf.fastenMicrocontroller,
    verticalClearance: conf.verticalClearance,
    rounded: conf.rounded,
    shell: conf.shell,
    wristRestEnable: !!conf.wristRest,
    connectorIndex: conf.connectorIndex,
    unibody: side == 'unibody',
    wristRestProps: conf.wristRest || {
      angle: 0,
      taper: 10,
      slope: 5,
      maxWidth: 100,
      tenting: 6,
      extension: 8,
    },
    wristRestPosition: overrideWristRest ? KEYBOARD_DEFAULTS.wristRestPosition! : encodeTuple(wrOrigin.xyz().map(t => Math.round(t * 10))),
    clusters: side == 'unibody'
      ? [
        ...toCosmosClusters(filterUnibodySide(conf.keys, 'right'), 'right', globalProfile, globalPartType, globalCurvature, wrOriginInv),
        ...toCosmosClusters(filterUnibodySide(conf.keys, 'left'), 'left', globalProfile, globalPartType, globalCurvature, flippedWrOriginInv),
      ]
      : toCosmosClusters(conf.keys, side, globalProfile, globalPartType, globalCurvature, wrOriginInv),
  }
  if (flipLeft && side == 'left') keyboard.clusters = keyboard.clusters.map(c => mirrorCluster(c, false))
  sortClusters(keyboard.clusters)
  return keyboard
}

/** Estimate which side of the keyboard a key is on */
function filterUnibodySide(keys: CuttleKey[], side: 'left' | 'right') {
  const xs = keys.map(k => k.position.evaluate({ flat: false }).origin().x)
  const center = sum(xs) / xs.length
  return keys.filter((k, i) => side == 'left' ? (xs[i] < center) : (xs[i] > center))
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
      } else if (h.name == 'placeOnSphere') {
        const opts: any = 'merged' in h.args[0] ? h.args[0].merged : h.args[0]
        verticalSpacings.incr(opts.spacing)
        columnCurvatures.incr(opts.curvature)
      } else if (h.name == 'placeRow') {
        const opts: any = 'merged' in h.args[0] ? h.args[0].merged : h.args[0]
        verticalSpacings.incr(opts.spacingOfRows)
        columnCurvatures.incr(opts.curvatureOfColumn)
        arcs.incr(opts.arc || 0)
      } else if (h.name == 'placeColumn') {
        const opts: any = 'merged' in h.args[0] ? h.args[0].merged : h.args[0]
        horizontalSpacings.incr(opts.spacingOfColumns)
        rowCurvatures.incr(opts.curvatureOfRow)
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

export function sideFromCosmosConfig(c: CosmosKeyboard, side: 'left' | 'right' | 'unibody', flipLeft = true): Cuttleform | undefined {
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
    connectorIndex: c.connectorIndex,
    microcontroller: c.microcontroller,
    microcontrollerAngle: c.microcontrollerAngle,
    fastenMicrocontroller: c.fastenMicrocontroller,
    wristRest: c.wristRestEnable ? { ...c.wristRestProps } : undefined,
    wristRestOrigin: new ETrsf().translate(wrPos[0] / 10, wrPos[1] / 10, wrPos[2] / 10),
    shell: c.shell,
  }
  const clusters: CosmosCluster[] = c.clusters.filter(c => side == 'unibody' || c.side == side)
  if (side == 'left' && !c.clusters.find(c => c.side == 'left' && c.name == 'fingers')) clusters.unshift(mirrorCluster(c.clusters.find(c => c.side == 'right' && c.name == 'fingers')!))
  if (side == 'unibody' && !c.clusters.find(c => c.side == 'left' && c.name == 'fingers')) clusters.splice(2, 0, mirrorCluster(c.clusters.find(c => c.side == 'right' && c.name == 'fingers')!))
  if (side != 'right' && !c.clusters.find(c => c.side == 'left' && c.name == 'thumbs')) clusters.push(mirrorCluster(c.clusters.find(c => c.side == 'right' && c.name == 'thumbs')!))
  // console.log('CLUSTERS', clusters)
  for (const clusterA of clusters) {
    for (const clusterB of clusterA.clusters) {
      for (const key of clusterB.keys) {
        const cuttleKey: CuttleKey = {
          type: key.partType.type || clusterB.partType.type || clusterA.partType.type || c.partType.type,
          aspect: key.partType.aspect || clusterB.partType.aspect || clusterA.partType.aspect || c.partType.aspect,
          cluster: clusterB.name || clusterA.name,
          position: cosmosKeyPosition(key, clusterB, clusterA, c, flipLeft),
        } as any
        cuttleKey.variant = decodeVariant(cuttleKey.type, key.partType.variant ?? clusterB.partType.variant ?? clusterA.partType.variant ?? c.partType.variant!)
        if (PART_INFO[cuttleKey.type].keycap) {
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
        // @ts-ignore
        if (ROUND_PARTS.includes(cuttleKey.type)) cuttleKey.size = { sides: key.sizeB }
        conf.keys.push(cuttleKey)
      }
    }
  }
  return conf.keys.length ? conf : undefined
}

export function fromCosmosConfig(c: CosmosKeyboard, flipLeft = true): FullCuttleform {
  return c.unibody
    ? {
      unibody: sideFromCosmosConfig(c, 'unibody', flipLeft),
    }
    : {
      left: sideFromCosmosConfig(c, 'left', flipLeft),
      right: sideFromCosmosConfig(c, 'right', flipLeft),
    }
}

export function decodeVariant(type: CuttleKey['type'], variant: number): Record<string, any> | undefined {
  if (type == 'trackpad-cirque') {
    return {
      size: ['23mm', '35mm', '40mm'][variant] || '23mm',
    }
  } else if (type == 'trackball') {
    const size = variant & 0x7
    const bearings = (variant >> 3) & 0x3
    const sensor = (variant >> 5) & 0x3
    return {
      size: ['34mm', '25mm'][size] || '34mm',
      bearings: ['Roller', 'Ball'][bearings] || 'Roller',
      sensor: ['Joe'][sensor] || 'Joe',
    }
  }
  return undefined
}

export function encodeVariant(type: CuttleKey['type'], variant: Record<string, any>) {
  if (type == 'trackpad-cirque') {
    return ['23mm', '35mm', '40mm'].indexOf(variant.size)
  } else if (type == 'trackball') {
    const size = ['34mm', '25mm'].indexOf(variant.size)
    const bearings = ['Roller', 'Ball'].indexOf(variant.bearings)
    const sensor = ['Joe'].indexOf(variant.sensor)
    return size + (bearings << 3) + (sensor << 5)
  }
  return undefined
}

// /** Determines how much the thumb cluster shifts when the thumb origin is moved from  */
// function clusterFlatAdjustment(cluster: CosmosCluster, keeb: CosmosKeyboard) {

// }

/** Calculate the cluster trsf, accounting for the fact that everything rotates in flat mode by fingers key rotation */
export function calcClusterTrsf(cluster: CosmosCluster, keeb: CosmosKeyboard) {
  if (cluster.name == 'fingers') return rotationPositionETrsf(cluster, false)

  const fingerCluster = keeb.clusters.find(c => c.side == cluster.side && c.name == 'fingers') || mirrorCluster(keeb.clusters.find(c => c.name == 'fingers')!)
  const fingerPos = rotationPositionETrsf(fingerCluster, false) || new ETrsf()
  const fingerPosInv = rotationPositionInvETrsf(fingerCluster) || new ETrsf()
  return (rotationPositionETrsf(cluster) || new ETrsf()).transformBy(fingerPosInv).transformBy(fingerPos)
}

export function cosmosKeyPosition(key: CosmosKey, column: CosmosCluster, cluster: CosmosCluster, keeb: CosmosKeyboard, flipLeft = false): ETrsf {
  const clusterTrsf = calcClusterTrsf(cluster, keeb)
  const columnTrsf = rotationPositionETrsf(column)
  const trsf = rotationPositionETrsf(key) || new ETrsf()

  const col = key.column ?? column.column ?? cluster.column
  const row = key.row
  let placeOnColumn = true
  if (typeof row !== 'undefined' && typeof col !== 'undefined') {
    // console.log(JSON.stringify(clusterTrsf), JSON.stringify(columnTrsf))
    const curvature = { ...trimUndefined(keeb.curvature), ...trimUndefined(cluster.curvature), ...trimUndefined(column.curvature) } as Required<Curvature>

    if (column.type == 'matrix') {
      if (columnTrsf) {
        placeOnColumn = false
        trsf.placeRow({
          row: row,
          spacingOfRows: curvature.verticalSpacing,
          curvatureOfColumn: curvature.curvatureB,
          arc: curvature.arc,
          columnForArc: col,
        }).transformBy(columnTrsf)
          .placeColumn({
            column: col,
            spacingOfColumns: curvature.horizontalSpacing,
            curvatureOfRow: curvature.curvatureA,
          })
      } else {
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
    } else if (column.type == 'sphere') {
      trsf.placeOnSphere({
        row: row,
        angle: col,
        spacing: curvature.verticalSpacing,
        curvature: curvature.curvatureB,
      })
    }
  }
  const clusterName = cluster.side + capitalize(cluster.name) + 'Plane'

  if (columnTrsf && placeOnColumn) trsf.transformBy(columnTrsf)
  if (clusterTrsf) trsf.transformBy(new Constant(clusterName, clusterTrsf.history))

  if (flipLeft && cluster.side == 'left' && !keeb.unibody) trsf.mirror([1, 0, 0])
  return trsf
}

export function rotationPositionETrsf(c: CosmosCluster | CosmosKey, inFlat = true) {
  if (!c.position && !c.rotation) return undefined
  const trsf = new ETrsf()
  if (c.rotation) {
    const rot = tupleToRot(c.rotation)
    trsf.rotate(rot.alpha, [0, 0, 0], [1, 0, 0], inFlat)
      .rotate(rot.beta, [0, 0, 0], [0, 1, 0], inFlat)
      .rotate(rot.gamma, [0, 0, 0], [0, 0, 1], inFlat)
  }
  if (c.position) trsf.translate(tupleToXYZ(c.position))
  return trsf
}

export function rotationPositionInvETrsf(c: CosmosCluster | CosmosKey, inFlat = true) {
  if (!c.position && !c.rotation) return undefined
  const trsf = new ETrsf()
  if (c.position) trsf.translate(tupleToXYZ(c.position).map(x => -x) as any)
  if (c.rotation) {
    const rot = tupleToRot(c.rotation)
    trsf
      .rotate(-rot.gamma, [0, 0, 0], [0, 0, 1], inFlat)
      .rotate(-rot.beta, [0, 0, 0], [0, 1, 0], inFlat)
      .rotate(-rot.alpha, [0, 0, 0], [1, 0, 0], inFlat)
  }
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

/** An ! in front of the stagger indicates it is in world frame, not column frame */
function dominantStagger(keys: CuttleKey[]) {
  const trsfs = new TallyMap<string>()
  for (const key of keys) {
    let hist = key.position.history
    if (hist.find(h => h.name == 'placeColumn') && hist.find(h => h.name == 'placeRow')) {
      const start = hist.findIndex(h => h.name == 'placeRow')
      const end = hist.findIndex(h => h.name == 'placeColumn')
      hist = hist.slice(start + 1, end)
      const trsf = new ETrsf(hist).evaluate({ flat: false }, new Trsf())
      const mat = trsf.matrix().join(',')
      trsfs.incr(mat)
    } else {
      let ind = hist.findIndex(h => h.name == 'placeOnMatrix' || h.name == 'placeOnSphere')
      if (ind >= 0) hist = hist.slice(ind + 1)
      ind = hist.findIndex(h => h.name == 'transformBy')
      if (ind >= 0) hist = hist.slice(0, ind)
      const trsf = new ETrsf(hist).evaluate({ flat: false }, new Trsf())
      const mat = '!' + trsf.matrix().join(',')
      trsfs.incr(mat)
    }
  }
  const max = trsfs.max()
  // Only return if at least 2 keys share the same stagger
  if (!max || trsfs.get(max) <= 1) return new Trsf().matrix().join(',')
  return max
}

/**
 * In older versions of Cosmos, column stagger was applied in the world frame (Z always points up).
 * In newer versions, column stagger is applied after the row curvature is applied (i.e. column is rotated into place)
 * This function accounts for that difference (i.e. takes a world frame stagger and rotates it into column frame)
 */
function rotateColumnStagger(stagger: Trsf, col: number, curvature: Curvature) {
  if (!col) return stagger
  const columnRotation = new ETrsf().placeColumn({
    column: col,
    spacingOfColumns: curvature.horizontalSpacing!,
    curvatureOfRow: curvature.curvatureA!,
  }).evaluate({ flat: false })

  return stagger.premultiplied(columnRotation.inverted()).multiply(columnRotation)
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

function getTransformBy(key: CuttleKey) {
  const transformBy = key.position.history.findLast(h => h.name == 'transformBy')
  if (transformBy) {
    // @ts-ignore
    const trsf = new ETrsf(transformBy.args[0].history)
    return trsf.evaluate({ flat: false })
  }
}

function collectByTransformBy(keys: CuttleKey[]) {
  const trsfs = new DefaultMap<string, CuttleKey[]>(() => [])
  for (const key of keys) {
    trsfs.get(getTransformBy(key)?.matrix().join(',') ?? '').push(key)
  }

  return trsfs
}

function collectByClusterName(keys: CuttleKey[]) {
  const names = new DefaultMap<ClusterName, CuttleKey[]>(() => [])
  for (const key of keys) {
    const cluster = key.cluster == 'thumbs' ? key.cluster : 'fingers'
    names.get(cluster).push(key)
  }
  return names
}

function collectByColumn(keys: CuttleKey[]) {
  const matrices = new DefaultMap<number, CuttleKey[]>(() => [])
  const spheres = new DefaultMap<number, CuttleKey[]>(() => [])
  const rest: CuttleKey[] = []
  for (const key of keys) {
    const { type, column } = getRowColumn(key.position)
    if (type == 'matrix') matrices.get(column).push(key)
    else if (type == 'sphere') spheres.get(column).push(key)
    else rest.push(key)
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
  return nthKey(conf, 0)
  // throw new Error(`Key ${n} not in bounds`)
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

export function nthPartVariant(conf: CosmosKeyboard, n: number) {
  const { key, column, cluster } = nthKey(conf, n)
  const type = key.partType.type || column.partType.type || cluster.partType.type || conf.partType.type!
  const variant = key.partType.variant ?? column.partType.variant ?? cluster.partType.variant ?? conf.partType.variant!
  return decodeVariant(type, variant) ?? {}
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

function nKeysInCluster(cl: CosmosCluster) {
  return sum(cl.clusters.map(c => c.keys.length))
}

/** Find the index of the nth key after filtering all keys to a certain side */
export function nthIndex(conf: CosmosKeyboard, side: 'right' | 'left' | 'unibody', cuttleInd: number) {
  if (!conf) return null
  const rightFingerCluster = conf.clusters.find(c => c.name == 'fingers' && c.side == 'right')!
  const rightThumbCluster = conf.clusters.find(c => c.name == 'thumbs' && c.side == 'right')!

  const nRightKeys = nKeysInCluster(rightFingerCluster) + nKeysInCluster(rightThumbCluster)
  const offset = side == 'right' ? 0 : nRightKeys
  const fingerCluster = conf.clusters.find(c => c.name == 'fingers' && c.side == side)
  const thumbCluster = conf.clusters.find(c => c.name == 'thumbs' && c.side == side)

  const nFingerKeys = nKeysInCluster(fingerCluster || rightFingerCluster)

  if (side == 'unibody') {
    if (cuttleInd < nRightKeys) return cuttleInd
    const leftFingerCluster = conf.clusters.find(c => c.name == 'fingers' && c.side == 'left')
    const leftThumbCluster = conf.clusters.find(c => c.name == 'thumbs' && c.side == 'left')
    const nFingerKeys = nKeysInCluster(leftFingerCluster || rightFingerCluster)

    if (leftFingerCluster && leftThumbCluster) return cuttleInd
    if (!leftFingerCluster && !leftThumbCluster) return cuttleInd - nRightKeys
    if (!leftFingerCluster && leftThumbCluster) return cuttleInd - (cuttleInd < nRightKeys + nFingerKeys ? nRightKeys : nFingerKeys)
    if (cuttleInd < nRightKeys + nFingerKeys) return cuttleInd
    return cuttleInd - nFingerKeys + nKeysInCluster(rightFingerCluster) - nRightKeys
  }

  if (cuttleInd < nFingerKeys) {
    // Finger cluster
    if (fingerCluster) return cuttleInd + offset
    return cuttleInd
  } else {
    // Thumb cluster
    if (fingerCluster && thumbCluster) return cuttleInd + offset
    if (!fingerCluster && !thumbCluster) return cuttleInd
    if (!fingerCluster && thumbCluster) return cuttleInd - nFingerKeys + offset
    return cuttleInd - nFingerKeys + nKeysInCluster(rightFingerCluster)
  }
}

function mirrorPositionTuple(t: bigint | undefined) {
  if (!t) return t
  const [x, y, z] = decodeTuple(t)
  return encodeTuple([-x, y, z])
}

function mirrorRotationTuple(t: bigint | undefined) {
  if (!t) return t
  const [x, y, z] = decodeTuple(t)
  return encodeTuple([x, -y, -z])
}

export function mirrorCluster(clr: CosmosCluster, flipLetters = true): CosmosCluster {
  return {
    ...clr,
    curvature: { ...clr.curvature },
    partType: { ...clr.partType },
    side: 'left',
    position: mirrorPositionTuple(clr.position),
    rotation: mirrorRotationTuple(clr.rotation),
    clusters: clr.clusters.map(c => ({
      ...c,
      curvature: { ...c.curvature },
      partType: { ...c.partType },
      side: 'left',
      position: mirrorPositionTuple(c.position),
      rotation: mirrorRotationTuple(c.rotation),
      column: typeof c.column != 'undefined' ? -c.column : undefined,
      keys: c.keys.map(k => ({
        ...k,
        profile: { ...k.profile, letter: flipLetters ? flippedKey(k.profile.letter) : k.profile.letter },
        partType: { ...k.partType },
        column: typeof k.column != 'undefined' ? -k.column : undefined,
        position: mirrorPositionTuple(k.position),
        rotation: mirrorRotationTuple(k.rotation),
      })),
    })),
  }
}

export function clusterName(cluster: CosmosCluster | null | undefined) {
  if (!cluster) return '-'
  if (cluster.name == 'fingers') return 'Fingers'
  return 'Thumb'
}

export function calculateSplay(column: CosmosCluster, cluster: CosmosCluster) {
  const prevColumnIndex = cluster.clusters.indexOf(column) - 1
  const rotationZ = decodeTuple(column.rotation ?? 0n)[2] / 45
  const mul = cluster.side == 'left' ? 1 : -1

  if (prevColumnIndex < 0) return mul * rotationZ
  const prevZ = decodeTuple(cluster.clusters[prevColumnIndex].rotation ?? 0n)[2] / 45
  return mul * (rotationZ - prevZ)
}

export function nthSplay(conf: CosmosKeyboard, n: number) {
  const { column, cluster } = nthKey(conf, n)
  return calculateSplay(column, cluster)
}

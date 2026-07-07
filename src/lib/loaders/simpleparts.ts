import { PART_INFO } from '$lib/geometry/socketsParts'
import type { CuttleKey } from '$lib/worker/config'
import Trsf from '$lib/worker/modeling/transformation'
import type { TrackballVariant } from '$target/cosmosStructs'
import { BufferAttribute, BufferGeometry, CylinderGeometry, IcosahedronGeometry, Matrix4, Triangle, Vector3 } from 'three'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import sockets from '../../../target/sockets-simple.json'
import { ITriangle, TriType } from './simplekeys'

function socket(name: keyof typeof sockets, flip = false, translateZ = 0) {
  const loader = new STLLoader()
  const data = Uint8Array.from(atob((sockets as any)[name]), c => c.charCodeAt(0))
  const part = loader.parse(data.buffer as ArrayBuffer)
  if (flip) part.rotateZ(Math.PI)
  if (translateZ) part.translate(0, 0, translateZ)
  return part
}

export function simplePartGeos(type: CuttleKey['type'], variant: Record<string, any>): BufferGeometry[] {
  const info = PART_INFO[type]
  const f = 'flipPart' in info && info.flipPart?.(variant)
  if (type == 'mx-pcb') return [socket('mx', f), socket('amoeba-king', f), socket('mx-hotswap', f, -0.65)]
  if (type == 'mx-pcb-plum') return [socket('mx', f), socket('plum-twist', f), socket('mx-hotswap', f)]
  if (type == 'mx-pumpkin') return [socket('mx', f), socket('mx-pumpkin', !f), socket('mx-hotswap', f, -0.55)]
  if (type == 'mx-skree') return [socket('mx', f), socket('mx-hotswap', f)]
  if (type == 'mx-hotswap') return [socket('mx', f), socket('mx-hotswap', f)]
  if (type == 'mx-klavgen') return [socket('mx', f), socket('mx-klavgen', f)]
  if (type == 'choc-v1-hotswap' || type == 'choc-v2-hotswap') return [socket('choc', f), socket('choc-hotswap', f)]
  if (type == 'choc-pumpkin') return [socket('choc', f), socket('mx-pumpkin', f, 2.6), socket('choc-hotswap', f, -0.5)]
  if (type == 'choc-v1-amoeba-hillside') return [socket('choc', f), socket('choc-amoeba', f)]
  if (type.startsWith('mx') || type.startsWith('old-mx')) return [socket('mx', f)]
  if (type.startsWith('choc') || type.startsWith('old-choc')) return [socket('choc', f)]
  if (type == 'ec11') return [socket('ec11')]
  if (type == 'evqwgd001') return [socket('evqwgd001')]
  if (type == 'thqwgd001') return [socket('thqwgd001')]
  if (type == 'encoder-alps-rkjxt1f42001') return [socket('rkjxt1f42001')]
  if (type == 'trackball') return trackballPart(variant as TrackballVariant)
  if (type == 'trackball-splitball') return splitballPart()
  if (type == 'joystick-joycon-adafruit') return [socket('joycon-adafruit')]
  if (type == 'joystick-ps2-40x45') return [socket('ps2')]
  if (type == 'joystick-joycon-nintendo') return [socket('joycon-nintendo')]
  if (type == 'meh01') return [socket('meh01')]
  return []
}

export function simpleSocketGeos(type: CuttleKey['type'], variant: Record<string, any>): BufferGeometry[] {
  const info = PART_INFO[type]
  const f = 'flipPart' in info && info.flipPart?.(variant)
  if (type == 'mx-pcb-plum') return [socket('socket-mx-plum', f)]
  if (type == 'ec11') return [socket('socket-ec11', f)]
  if (type == 'joystick-ps2-40x45') return [socket('socket-ps2', f)]
  if (type == 'trackball') return trackballSocket(variant as TrackballVariant)
  return []
}

function botIcosahredron(radius: number, detail: number) {
  const geometry = new IcosahedronGeometry(radius, detail).toNonIndexed()
  const position = geometry.getAttribute('position').array
  const normal = geometry.getAttribute('normal').array
  const filteredPos: number[] = []
  const filteredNorm: number[] = []
  for (let i = 0; i < position.length; i += 9) {
    if (position[i + 2] < 0 || position[i + 5] < 0 || position[i + 8] < 0) {
      filteredPos.push(...position.slice(i, i + 9))
      filteredNorm.push(...normal.slice(i, i + 9))
    }
  }
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(filteredPos), 3))
  geometry.setAttribute('normal', new BufferAttribute(new Float32Array(filteredNorm), 3))
  return geometry
}

const trackballBearingTrsfs = (radius: number) =>
  [90, 210, 330].map(angle =>
    new Trsf()
      .translate(-radius - 3, 0, 0)
      .rotate(-13, [0, 0, 0], [0, 1, 0])
      .rotate(angle)
      .translate(0, 0, -4)
      .Matrix4()
  )

function trackballPart(variant: TrackballVariant): BufferGeometry[] {
  const radius = parseFloat(variant.size) / 2
  // Add extra 0.5mm of space around the trackball so it has room to freely spin
  const parts = [new IcosahedronGeometry(radius + 0.5, 2).toNonIndexed().translate(0, 0, -4)]
  const bearingTrsfs = trackballBearingTrsfs(radius)
  if (variant.bearings == 'BTU (7.5mm)') {
    bearingTrsfs.forEach(b => parts.push(new CylinderGeometry(3.75, 3.75, 6, 8).rotateZ(Math.PI / 2).applyMatrix4(b).toNonIndexed()))
  }
  if (variant.bearings == 'BTU (9mm)') {
    bearingTrsfs.forEach(b => parts.push(new CylinderGeometry(4.5, 4.5, 8, 8).rotateZ(Math.PI / 2).applyMatrix4(b).toNonIndexed()))
  }

  return parts
}

function splitballPart(): BufferGeometry[] {
  // The cup is part of the part (not the socket), so it's modeled here:
  // the 34mm ball (+0.5mm so it can freely spin) and the cup's outer shell.
  // The ball center sits at the socket origin.
  return [
    new IcosahedronGeometry(17.5, 2).toNonIndexed(),
    botIcosahredron(21, 2), // 17mm ball + 1mm gap + 3mm cup wall
  ]
}

function trackballSocket(variant: TrackballVariant): BufferGeometry[] {
  const radius = parseFloat(variant.size) / 2
  const parts = [botIcosahredron(radius + 4, 2).translate(0, 0, -4)] // 1mm gap, 3mm wall
  const bearingTrsfs = trackballBearingTrsfs(radius)
  if (variant.bearings == 'Roller') {
    bearingTrsfs.forEach(b => parts.push(new CylinderGeometry(4.3, 4.3, 4.5, 8).applyMatrix4(b).toNonIndexed()))
    bearingTrsfs.forEach(b => parts.push(new CylinderGeometry(2.35, 2.35, 8.4, 8).applyMatrix4(b).toNonIndexed()))
  }
  return parts
}

export function simpleTris(geos: BufferGeometry[], position: Matrix4, type: TriType, index: number) {
  return geos.flatMap(geo => {
    if (geo.index) throw new Error('Indexed geometry not supported')
    const positions = geo.attributes.position as BufferAttribute
    const triangles: Triangle[] = []
    for (let i = 0; i < positions.array.length; i += 9) {
      triangles.push(
        new ITriangle(
          new Vector3().fromArray(positions.array, i).applyMatrix4(position),
          new Vector3().fromArray(positions.array, i + 3).applyMatrix4(position),
          new Vector3().fromArray(positions.array, i + 6).applyMatrix4(position),
          type,
          index,
        ),
      )
    }
    return triangles
  })
}

import { fromGeometry } from '$lib/loaders/geometry'
import { range } from '$lib/worker/util'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { type Shape3D, Sketcher } from 'replicad'
import { Mesh } from 'three'
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js'
import { setup } from './node-model'
import { ProcessPool } from './processPool'

const targetDir = fileURLToPath(new URL('../../target', import.meta.url))
const assetsDir = fileURLToPath(new URL('../../src/assets', import.meta.url))

type Point = [number, number]

function AmoebaPCB() {
  const cornerPoints: Point[] = [
    [5.85, 9.6],
    [7.1, 8.35],
    [8.35, 8.35],
    [8.35, 5.6],
    [9.6, 4.35],
  ]
  const cornerPointsR = [...cornerPoints].reverse()
  const points: Point[] = [
    ...cornerPoints,
    ...cornerPointsR.map(([x, y]) => [x, -y] as Point),
    ...cornerPoints.map(([x, y]) => [-x, -y] as Point),
    ...cornerPointsR.map(([x, y]) => [-x, y] as Point),
  ]
  const sketcher = new Sketcher('XY', -6.6).movePointerTo(points[0])
  points.slice(1).forEach(p => sketcher.lineTo(p))
  return sketcher.close().extrude(1.9)
}

function PlumTwist() {
  const N_POINTS = 12
  const radius = 17.9 / 2
  const points: Point[] = range(0, N_POINTS).map(i => [
    radius * Math.cos(i * 2 * Math.PI / N_POINTS),
    radius * Math.sin(i * 2 * Math.PI / N_POINTS),
  ])
  const sketcher = new Sketcher('XY', -5.95).movePointerTo(points[0])
  points.slice(1).forEach(p => sketcher.lineTo(p))
  return sketcher.close().extrude(1.2)
}

function AmoebaChoc() {
  const points: Point[] = [
    [-6.85, 8],
    [6.85, 8],
    [6.85, -8],
    [-6.85, -8],
  ]
  const sketcher = new Sketcher('XY', -3.8).movePointerTo(points[0])
  points.slice(1).forEach(p => sketcher.lineTo(p))
  return sketcher.close().extrude(1.2)
}

function genPCB(id: string, fn: () => Shape3D) {
  return async () => {
    const model = fn()
    const mesh = model.mesh({ tolerance: 0.1, angularTolerance: 10 })
    const geometry = fromGeometry(mesh)
    const exporter = new STLExporter()
    const binary = exporter.parse(new Mesh(geometry), { binary: true }) as any
    // await writeFile(join(targetDir, 'pcb.stl'), binary)
    return { key: id, result: Buffer.from(binary.buffer).toString('base64') }
  }
}

function genPart(key: string, name: string) {
  return async () => {
    const binary = await readFile(join(assetsDir, name))
    return { key: key, result: binary.toString('base64') }
  }
}

async function genKeys() {
  await setup()

  const pool = new ProcessPool()
  if (pool.isWorker) await setup()

  pool.add('MX Amoeba', genPCB('amoeba-king', AmoebaPCB))
  pool.add('Plum Twist', genPCB('plum-twist', PlumTwist))
  pool.add('Plum Twist Socket', genPart('socket-mx-plum', 'socket-mx-plum-simple.stl'))
  pool.add('Choc Amoeba', genPCB('choc-amoeba', AmoebaChoc))
  pool.add('MX', genPart('mx', 'switch-mx-simple.stl'))
  pool.add('MX Hotswap', genPart('mx-hotswap', 'switch-mx-hotswap-simple.stl'))
  pool.add('MX Pumpkin', genPart('mx-pumpkin', 'switch-mx-pumpkin-simple.stl'))
  pool.add('Klavgen', genPart('mx-klavgen', 'switch-mx-klavgen-simple.stl'))
  pool.add('Choc', genPart('choc', 'switch-choc-simple.stl'))
  pool.add('Choc Hotswap', genPart('choc-hotswap', 'switch-choc-hotswap-simple.stl'))
  pool.add('EC11', genPart('ec11', 'switch-ec11-simple.stl'))
  pool.add('EC11 Socket', genPart('socket-ec11', 'socket-ec11-simple.stl'))
  pool.add('EVQWGD001', genPart('evqwgd001', 'switch-evqwgd001-simple.stl'))
  pool.add('THQWGD001', genPart('thqwgd001', 'switch-thqwgd001-simple.stl'))
  pool.add('MEH01', genPart('meh01', 'switch-meh01-simple.stl'))
  pool.add('RKJXT1F42001', genPart('rkjxt1f42001', 'switch-rkjxt1f42001-simple.stl'))
  pool.add('Joycon Adafruit', genPart('joycon-adafruit', 'switch-joycon-adafruit-simple.stl'))
  pool.add('PS2', genPart('ps2', 'switch-ps2-simple.stl'))
  pool.add('PS2 Socket', genPart('socket-ps2', 'socket-ps2-simple.stl'))
  pool.add('Joycon Nintendo', genPart('joycon-nintendo', 'switch-joycon-nintendo-simple.stl'))
  await pool.run()

  const filename = join(targetDir, `sockets-simple.json`)
  await writeFile(filename, JSON.stringify(pool.results))
}

genKeys()

import { fromGeometry } from '$lib/loaders/geometry'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Sketcher } from 'replicad'
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

async function genPCB() {
  const model = AmoebaPCB()
  const mesh = model.mesh({ tolerance: 0.1, angularTolerance: 10 })
  const geometry = fromGeometry(mesh)
  const exporter = new STLExporter()
  const binary = exporter.parse(new Mesh(geometry), { binary: true }) as any
  // await writeFile(join(targetDir, 'pcb.stl'), binary)
  return { key: 'amoeba-king', result: Buffer.from(binary.buffer).toString('base64') }
}

async function genMX() {
  const binary = await readFile(join(assetsDir, 'switch-mx-simple.stl'))
  return { key: 'mx', result: binary.toString('base64') }
}

async function genChoc() {
  const binary = await readFile(join(assetsDir, 'switch-choc-simple.stl'))
  return { key: 'choc', result: binary.toString('base64') }
}

async function genKeys() {
  await setup()
  await genPCB()

  const pool = new ProcessPool()
  if (pool.isWorker) await setup()

  pool.add('PCB', genPCB)
  pool.add('MX', genMX)
  pool.add('Choc', genChoc)
  await pool.run()

  const filename = join(targetDir, `sockets-simple.json`)
  await writeFile(filename, JSON.stringify(pool.results))
}

genKeys()

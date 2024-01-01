import { fork } from 'child_process'
import { mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join, resolve } from 'path'
import { Mesh } from 'three'
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js'
import { fileURLToPath } from 'url'
import { copyToFS, loadManifold, loadOpenSCAD, parseString } from './openscad2'
import { PromisePool } from './promisePool'

const targetDir = fileURLToPath(new URL('../../target', import.meta.url))

const UNIFORM = ['dsa', 'xda', 'choc']

const header = `
include <KeyV2/includes.scad>
$support_type = "disable";
$stem_type = "disable";
$stem_support_type = "disable";
$shape_facets = 1;

module overrides() {
  // $key_shape_type = "square";
  $dish_type = "disable";
  $height_slices = 1; // min($height_slices, 2);
  union() {
    translate([0, 0, -3.5]) linear_extrude(height = 3.5) projection(cut = true) hull() children();
    hull() children();
  }
}
`
type SMap = Record<string, string>
const blobs: SMap = {}

const US = [1, 1.25, 1.5, 2]
const ROWS = [0, 1, 2, 3, 4, 5]

async function genKey(config: { profile: string; u: number; row?: number }) {
  const [openscad, _] = await Promise.all([loadOpenSCAD(), loadManifold()])
  copyToFS(openscad, resolve(targetDir, 'KeyV2'), 'KeyV2')

  const exporter = new STLExporter()
  const row = config.profile == 'dsa' ? 3 : config.row

  const name = UNIFORM.includes(config.profile)
    ? config.profile + '-' + config.u
    : config.profile + '-' + config.row + '-' + config.u
  openscad.FS.writeFile(name + '.scad', header + `u(${config.u}) ${config.profile}_row(${row}) overrides() key();`)
  openscad.callMain([name + '.scad', '-o', name + '.csg'])
  const csg = openscad.FS.readFile(name + '.csg', { encoding: 'utf8' })
  const geometry = await parseString(csg)

  const binary = exporter.parse(new Mesh(geometry), { binary: true })
  // @ts-ignore
  const bstring = Buffer.from(binary.buffer).toString('base64')
  process.send({ name, bstring })
}

async function genKeys() {
  const folder = await mkdtemp(join(tmpdir(), 'keycaps'))

  const pool = new PromisePool()
  const profiles = [
    ...US.map(u => ({ profile: 'dsa', u })),
    ...US.map(u => ({ profile: 'xda', u })),
    ...US.map(u => ({ profile: 'choc', u })),
    ...US.flatMap(u => ROWS.map(r => ({ profile: 'mt3', u, row: r }))),
    ...US.flatMap(u => ROWS.map(r => ({ profile: 'oem', u, row: r }))),
    ...US.flatMap(u => ROWS.map(r => ({ profile: 'sa', u, row: r }))),
    ...US.flatMap(u => ROWS.map(r => ({ profile: 'cherry', u, row: r }))),
  ]

  profiles.forEach(p => {
    const name = `${p.u}u${'row' in p ? ` r${p.row}` : ''} ${p.profile}`
    pool.add(name, () => {
      const child = fork(fileURLToPath(import.meta.url), [JSON.stringify(p)])
      child.on('message', ({ name, bstring }: SMap) => blobs[name] = bstring)
      return new Promise((resolve, reject) => {
        child.addListener('error', reject)
        child.addListener('exit', resolve)
      })
    })
  })

  await pool.run()

  const filename = join(targetDir, `keys-simple.json`)
  await writeFile(filename, JSON.stringify(blobs))
  await rm(folder, { recursive: true })
}

if (process.argv[2]?.startsWith('{')) {
  genKey(JSON.parse(process.argv[2]))
} else {
  genKeys()
}

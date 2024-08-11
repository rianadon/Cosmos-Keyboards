import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Mesh } from 'three'
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js'
import { pseudoFiles, pseudoMirror, psuedoKeyId } from './keycapsPseudoHelper'
import { copyToFS, loadManifold, loadOpenSCAD, parseString } from './openscad2'
import { ProcessPool } from './processPool'

const targetDir = fileURLToPath(new URL('../../target', import.meta.url))

const UNIFORM = ['dsa', 'xda', 'choc', 'ma']

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
    translate([0, 0, $stem_inset-3.5]) linear_extrude(height = 3.5) projection(cut = true) translate([0, 0, -$stem_inset]) hull() children();
    hull() children();
  }
}
`

const pseudo_header = `
module x() {
  union() {
    translate([0, 0, -3.5]) linear_extrude(height = 3.5) projection(cut = true) hull() children();
    hull() children();
  }
}
`

const US = [1, 1.25, 1.5, 2]
const ROWS = [0, 1, 2, 3, 4, 5]

async function genKey(config: { profile: string; u: number; row?: number }) {
  const openscad = await loadOpenSCAD()
  const exporter = new STLExporter()
  const row = config.profile == 'dsa' ? 3 : config.row

  const name = UNIFORM.includes(config.profile)
    ? config.profile + '-' + config.u
    : config.profile + '-' + config.row + '-' + config.u
  if (pseudoFiles[config.profile]) {
    copyToFS(openscad, resolve(targetDir, 'PseudoProfiles'))
    const base = await readFile(join(targetDir, 'PseudoProfiles', pseudoFiles[config.profile]), { encoding: 'utf-8' })
    const scadContents = base
      .replace(/keyID\s*=\s*\d+/, 'keyID = ' + psuedoKeyId(config.u, config.row!))
      .replace('mirror([0,0,0])', pseudo_header + 'x()' + pseudoMirror(config.u, config.row!))
      .replace(/Stem\s*= true/, 'Stem = false')
      .replace(/Dish\s*= true/, 'Dish = false')
      .replace(/fn\s*= \d+/, 'fn = 2')
      .replace(/layers\s*= \d+/, 'layers = 3')
      .replace(/stepsize\s*= \d+/, 'stepsize = 1')
      .replace(/step\s*= \d+/, 'step = 60')
    openscad.FS.writeFile(name + '.scad', scadContents)
  } else {
    copyToFS(openscad, resolve(targetDir, 'KeyV2'), 'KeyV2')
    openscad.FS.writeFile(name + '.scad', header + `u(${config.u}) ${config.profile}_row(${row}) overrides() key();`)
  }
  openscad.callMain([name + '.scad', '-o', name + '.csg'])
  const csg = openscad.FS.readFile(name + '.csg', { encoding: 'utf8' })
  const geometry = await parseString(csg)

  const binary = exporter.parse(new Mesh(geometry), { binary: true })
  // @ts-ignore
  return { key: name, result: Buffer.from(binary.buffer).toString('base64') }
}

async function genKeys() {
  const folder = await mkdtemp(join(tmpdir(), 'keycaps'))

  const pool = new ProcessPool()
  if (pool.isWorker) await loadManifold()

  const profiles = [
    ...US.map(u => ({ profile: 'dsa', u })),
    ...US.map(u => ({ profile: 'xda', u })),
    ...US.map(u => ({ profile: 'choc', u })),
    ...US.map(u => ({ profile: 'ma', u })),
    ...US.flatMap(u => ROWS.map(r => ({ profile: 'mt3', u, row: r }))),
    ...US.flatMap(u => ROWS.map(r => ({ profile: 'oem', u, row: r }))),
    ...US.flatMap(u => ROWS.map(r => ({ profile: 'sa', u, row: r }))),
    ...US.flatMap(u => ROWS.map(r => ({ profile: 'cherry', u, row: r }))),
    ...US.flatMap(u => ROWS.map(r => ({ profile: 'des', u, row: r }))),
  ]

  profiles.forEach(p => {
    const name = `${p.u}u${'row' in p ? ` r${p.row}` : ''} ${p.profile}`
    pool.add(name, () => genKey(p))
  })

  await pool.run()

  const filename = join(targetDir, `keys-simple.json`)
  await writeFile(filename, JSON.stringify(pool.results))
  await rm(folder, { recursive: true })
}

genKeys()

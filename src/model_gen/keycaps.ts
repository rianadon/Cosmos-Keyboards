import { execFile } from 'child_process'
import { mkdtemp, readFile, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { fileURLToPath } from 'url'
import { promisify } from 'util'
import { exportGLTF } from './exportGLTF'
import { pseudoFiles, pseudoMirror, psuedoKeyId } from './keycapsPseudoHelper'
import { PromisePool } from './promisePool'

const targetDir = fileURLToPath(new URL('../../target', import.meta.url))

const header = `
include <${join(targetDir, 'KeyV2', 'includes.scad')}>
$support_type = "disable";
$stem_support_type = "disable";
`

const US = [1, 1.25, 1.5, 2]
const ROWS = [0, 1, 2, 3, 4, 5]

const UNIFORM = ['dsa', 'xda', 'choc', 'ma']

async function genKey(config: { profile: string; u: number; row?: number }, folder: string) {
  const row = config.profile == 'dsa' ? 3 : config.row

  const name = UNIFORM.includes(config.profile)
    ? config.profile + '-' + config.u
    : config.profile + '-' + config.row + '-' + config.u
  const scadName = join(folder, name + '.scad')
  const stlName = join(folder, name + '.stl')

  if (pseudoFiles[config.profile]) {
    const base = await readFile(join(targetDir, 'PseudoProfiles', pseudoFiles[config.profile]), { encoding: 'utf-8' })
    const scadContents = base
      .replace(/keyID\s*=\s*\d+/, 'keyID = ' + psuedoKeyId(config.u, config.row!))
      .replace(/use </g, `use <${targetDir}/PseudoProfiles/`)
      .replace('mirror([0,0,0])', pseudoMirror(config.u, config.row!))
    await writeFile(scadName, scadContents)
  } else {
    const stemFn = config.profile == 'choc' ? '$stem_type = "choc";' : ''
    const keyFn = `${config.profile}_row(${row})`
    await writeFile(scadName, header + `${stemFn} u(${config.u}) ${keyFn} key();`)
  }

  const openscadExe = process.env.OPENSCAD || join(targetDir, 'openscad')
  await promisify(execFile)(openscadExe, [scadName, '-o', stlName])

  const loader = new STLLoader()
  const stl = await readFile(stlName)
  const geometry = loader.parse(stl.buffer as ArrayBuffer)
  exportGLTF(join(targetDir, `key-${name}.glb`), geometry)
}

async function genKeys() {
  const folder = await mkdtemp(join(tmpdir(), 'keycaps'))

  const pool = new PromisePool()
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
    pool.add(name, () => genKey(p, folder))
  })

  await pool.run()

  await rm(folder, { recursive: true })
}

genKeys()

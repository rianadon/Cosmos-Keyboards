import { fork } from 'child_process'
import { join, resolve } from 'path'
import { fileURLToPath } from 'url'
import { exportGLTF } from './exportGLTF'
import { copyToFS, loadManifold, loadOpenSCAD, type OpenSCAD, parseString } from './openscad2'
import { PromisePool } from './promisePool'

const targetDir = fileURLToPath(new URL('../../target', import.meta.url))

const header = `
include <KeyV2/includes.scad>
$support_type = "disable";
$stem_support_type = "disable";
`

const US = [1, 1.25, 1.5, 2]
const ROWS = [0, 1, 2, 3, 4, 5]

const UNIFORM = ['dsa', 'xda', 'choc']

async function genKey(config: { profile: string; u: number; row?: number }) {
  const [openscad, _] = await Promise.all([loadOpenSCAD(), loadManifold()])
  copyToFS(openscad, resolve(targetDir, 'KeyV2'), 'KeyV2')

  const row = config.profile == 'dsa' ? 3 : config.row

  const name = UNIFORM.includes(config.profile)
    ? config.profile + '-' + config.u
    : config.profile + '-' + config.row + '-' + config.u
  const stemFn = config.profile == 'choc' ? '$stem_type = "choc";' : ''
  const keyFn = `${config.profile}_row(${row})`
  openscad.FS.writeFile(name + '.scad', header + `${stemFn} u(${config.u}) ${keyFn} key();`)
  openscad.callMain([name + '.scad', '-o', name + '.csg'])
  const csg = openscad.FS.readFile(name + '.csg', { encoding: 'utf8' })
  const geometry = await parseString(csg)

  exportGLTF(join(targetDir, `key-${name}.glb`), geometry)
}

async function genKeys() {
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
      return new Promise((resolve, reject) => {
        child.addListener('error', reject)
        child.addListener('exit', resolve)
      })
    })
  })

  await pool.run()
}

if (process.argv[2]?.startsWith('{')) {
  genKey(JSON.parse(process.argv[2]))
} else {
  genKeys()
}

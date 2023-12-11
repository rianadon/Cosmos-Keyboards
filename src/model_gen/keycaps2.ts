import { exec } from 'child_process'
import { readdirSync, readFileSync, writeFileSync } from 'fs'
import { mkdtemp, readdir, readFile, rm, writeFile } from 'fs/promises'
import { cpus, tmpdir } from 'os'
import { dirname, join, resolve } from 'path'
import { clearInterval } from 'timers'
import { fileURLToPath } from 'url'
import { promisify } from 'util'
import { simplify, stringifyOperation } from './modeling'
import { loadOpenSCAD, type OpenSCAD, parseString } from './openscad'

const targetDir = fileURLToPath(new URL('../../target', import.meta.url))

const POOL_SIZE = 4

const header = `
include <KeyV2/includes.scad>
$support_type = "disable";
$stem_support_type = "disable";
`

const US = [1, 1.25, 1.5, 2]
const ROWS = [0, 1, 2, 3, 4, 5]

const UNIFORM = ['dsa', 'xda', 'choc']

function name(config) {
  if (UNIFORM.includes(config.profile)) {
    return config.profile + '-' + config.u
  }
  return config.profile + '-' + config.row + '-' + config.u
}

/** Copy a directory of scad files to the OpenSCAD filesystem */
function copyToFS(openscad: OpenSCAD, local: string, dir: string) {
  openscad.FS.mkdir(dir)
  const dirents = readdirSync(local, { withFileTypes: true })
  for (const dirent of dirents) {
    const loc = resolve(local, dirent.name)
    const dr = join(dir, dirent.name)
    if (dirent.isDirectory() && !dirent.name.endsWith('git')) {
      copyToFS(openscad, loc, dr)
    } else if (dirent.name.endsWith('.scad')) {
      const contents = readFileSync(loc, { encoding: 'utf8' })
      openscad.FS.writeFile(dr, contents)
    }
  }
}

async function genKeyWork(config) {
  const openscad = await loadOpenSCAD()
  copyToFS(openscad, resolve(targetDir, 'KeyV2'), 'KeyV2')

  const row = config.profile == 'dsa' ? 3 : config.row

  openscad.FS.writeFile(name(config) + '.scad', header + `u(${config.u}) ${config.profile}_row(${row}) key();`)
  openscad.callMain([name(config) + '.scad', '-o', name(config) + '.csg'])
  const csg = openscad.FS.readFile(name(config) + '.csg', { encoding: 'utf8' })
  const operations = await parseString(csg)
  console.log(stringifyOperation(simplify(operations)))
  // await writeFile(join(targetDir, name(config)+'.csg'), csg)

  // const scadName = join(folder, name(config)+'.scad')
  // const stlName = join(folder, name(config)+'.stl')
  // const gltfName = join(folder, name(config)+'.glb')
  // const glbName = join(targetDir, `key-${name(config)}.glb`)
  // await writeFile(scadName,
  // header + `u(${config.u}) ${config.profile}_row(${row}) key();`)
  // await promisify(exec)(`/Applications/OpenSCAD.app/Contents/MacOS/OpenSCAD ${scadName} -o ${stlName}`)

  // try {
  //     await promisify(exec)(`blender --background -noaudio -P ${join(__dirname, "to_gltf.py")} ${stlName} ${gltfName}`)
  // } catch (e) {
  //     if(!e.stdout.includes('Finished glTF 2.0 export')) throw e
  // }
  // await promisify(exec)(`npx gltfpack -noq -i ${gltfName} -o ${glbName}`)
  // await promisify(exec)(`cp ${gltfName} ${glbName}`)
}

function genKey(profile) {
  const promise = genKeyWork(profile)
  promise.profile = profile
  promise.began = Date.now()
  return promise
}

async function genKeys() {
  const profiles = [
    ...US.map(u => ({ profile: 'dsa', u })),
    ...US.map(u => ({ profile: 'xda', u })),
    ...US.map(u => ({ profile: 'choc', u })),
    ...US.flatMap(u => ROWS.map(r => ({ profile: 'mt3', u, row: r }))),
    ...US.flatMap(u => ROWS.map(r => ({ profile: 'oem', u, row: r }))),
    ...US.flatMap(u => ROWS.map(r => ({ profile: 'sa', u, row: r }))),
    ...US.flatMap(u => ROWS.map(r => ({ profile: 'cherry', u, row: r }))),
  ]

  await genKey(profiles[0])
  return

  let working = []
  for (let i = 0; i < POOL_SIZE; i++) {
    working.push(genKey(profiles.shift(), ''))
    console.log()
  }
  console.log()

  const interval = setInterval(() => {
    process.stdout.moveCursor(0, -POOL_SIZE - 1)

    for (let i = 0; i < POOL_SIZE; i++) {
      if (i < working.length) {
        const w = working[i]
        const time = Math.round((Date.now() - w.began) / 1000)
        const row = 'row' in w.profile ? ` r${w.profile.row}` : ''
        console.log(`[${time}s] Generating ${w.profile.u}u${row} ${w.profile.profile}   `)
      } else {
        console.log() // Pad with blank lines
      }
    }
    console.log(`Plus ${profiles.length} more keycaps`)
  }, 1000)

  while (working.length > 0) {
    const [toRemove] = await Promise.race(working.map(p => p.then(() => [p])))
    working.splice(working.indexOf(toRemove), 1)
    if (profiles.length > 0) working.push(genKey(profiles.shift(), ''))
  }
  clearInterval(interval)
}

genKeys().catch(console.error)

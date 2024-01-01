import { readdirSync, readFileSync } from 'fs'
import { readFile, writeFile } from 'fs/promises'
import { join, resolve } from 'path'
import { fileURLToPath } from 'url'
import load from '../assets/openscad.wasm.js'

const targetDir = fileURLToPath(new URL('../../target', import.meta.url))

async function loadOpenSCAD() {
  const wasm = fileURLToPath(new URL('../assets/openscad.wasm', import.meta.url))
  const fileBuffer = await readFile(wasm)

  return new Promise((resolve) => {
    const mod = {
      noInitialRun: true,
      wasmBinary: fileBuffer.buffer,
      onRuntimeInitialized: () => resolve(mod),
      print: console.log,
      printErr: console.error,
    }
    load(mod)
  })
}

/** Copy a directory of scad files to the OpenSCAD filesystem */
function copyToFS(openscad, local, dir) {
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

async function main() {
  const openscad = await loadOpenSCAD()
  copyToFS(openscad, resolve(targetDir, 'KeyV2'), 'KeyV2')
  const input = await readFile(process.argv[2])
  openscad.FS.writeFile('input.scad', input)
  openscad.callMain(['input.scad', '-o', 'output.stl'])
  const stl = openscad.FS.readFile('output.stl')
  await writeFile(process.argv[3], stl)
}

main().catch(e => {
  console.error('Error:', e)
  process.exit(1)
})

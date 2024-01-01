import { execFileSync, spawnSync } from 'child_process'
import { accessSync, constants, createWriteStream, existsSync, linkSync, lstatSync, readdirSync } from 'fs'
import { join } from 'path'
import * as readline from 'readline/promises'
import { Readable } from 'stream'
import { finished } from 'stream/promises'
import { fileURLToPath } from 'url'

const targetDir = fileURLToPath(new URL('../../target', import.meta.url))
const destination = join(targetDir, 'openscad')

const GUESSES = [
  '/Applications/OpenSCAD.app/Contents/MacOS/OpenSCAD',
]
const which = spawnSync('which', ['openscad'], { encoding: 'utf-8' }).stdout
if (which) GUESSES.unshift(which)

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })

/** Link locally installed OpenSCAD to target path */
function linkOpenSCAD(path: string) {
  console.log(`Linking ${path} to ${destination}`)
  try {
    linkSync(path, destination)
  } catch (e) {
    console.log()
    console.error(`    Could not link OpenSCAD: ${e}`)
  }
}

/** Try to find and link local OpenSCAD installation. */
async function findLocalOpenSCAD(): Promise<boolean> {
  for (const guess of GUESSES) {
    try {
      accessSync(guess, constants.X_OK)
    } catch (e) {
      continue // Skip the guess
    }

    const output = spawnSync(guess, ['--version'], { encoding: 'utf-8' })
    const version = output.stderr.replace('OpenSCAD version', '').trim()

    console.log()
    console.log('Your current OpenSCAD version:', version)
    console.log('        Recommended version >=', '2023.03.31')
    console.log()
    while (true) {
      const keep = await rl.question('Use yours? (y/n) ')
      if (keep.trim().toLowerCase() == 'n') {
        return false
      }
      if (keep.trim().toLowerCase() == 'y') {
        linkOpenSCAD(guess)
        return true
      }
      console.log('Please enter y or n.')
    }
  }
  return false
}

/** Determine the OpenSCAD download URL for this system. */
function downloadURL(): string | null {
  if (process.platform == 'linux' && process.arch == 'x64') {
    return 'https://files.openscad.org/snapshots/OpenSCAD-2023.12.31.ai17940-x86_64.AppImage'
  }
  return null
}

/** Prompt for the local OpenSCAD path and link it to the target directory */
async function promptLocalOpenSCAD(): Promise<boolean> {
  const path = await rl.question('Path to OpenSCAD executable (press enter to skip): ')
  if (!path) return false
  if (!existsSync(path)) {
    console.log(`The path ${path} does not exist. Please type a valid path.`)
    return await promptLocalOpenSCAD()
  } else if (lstatSync(path).isDirectory()) {
    console.log(`The path ${path} is a directory, not the OpenSCAD executable.`)
    return await promptLocalOpenSCAD()
  }
  try {
    accessSync(path, constants.X_OK)
  } catch (e) {
    console.log(`The path ${path} exists but is not an executable file.`)
    return await promptLocalOpenSCAD()
  }

  // Link the local executable to where OpenSCAD would be installed
  linkOpenSCAD(path)
  return true
}

async function main() {
  // if (existsSync(destination)) {
  // console.log('OpenSCAD is already installed')
  // return
  // }
  const url = downloadURL()
  if (!process.env['CI']) {
    if (await findLocalOpenSCAD()) {
      return
    }

    if (url) {
      console.log('Cosmos will try to automatically install a compatible version of OpenSCAD.')
      console.log("If you'd like to use a pre-installed version of OpenSCAD instead, type the path to the executable here")
      console.log('Otherwise, to proceed with installing OpenSCAD to the local file target/openscad, press enter.')
    } else {
      console.log('Your OS is not supported for automatically downloading OpenSCAD.')
      console.log('Please download OpenSCAD from https://openscad.org/downloads.html.')
      console.log('Once installed, enter the path here. If you skip this step, the following steps will error.')
    }
    if (await promptLocalOpenSCAD()) {
      return
    }
  }
  if (!url) {
    console.error('Your OS is not supported for automatically downloading OpenSCAD.')
    console.error('  Platform: ', process.platform)
    console.error('  Arch: ', process.arch)
    process.exit(1)
  }

  console.log(`Downloading to ${destination}`)
  const res = await fetch(url)
  const fileStream = createWriteStream(destination, { flags: 'wx', mode: 0o777 })
  await finished(Readable.fromWeb(res.body).pipe(fileStream))

  if (process.platform == 'linux' && process.env['CI']) {
    // Some CI systems (like Vercel) don't have FUSE, so extract the appimage.
    console.log('Extracting AppImage...')
    console.log(execFileSync(destination, ['--appimage-extract'], {
      cwd: targetDir,
    }))
    console.log(readdirSync(targetDir))
  }
}

main().catch(e => {
  console.error(e)
}).then(() => rl.close())

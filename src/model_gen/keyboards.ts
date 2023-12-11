import { type Cuttleform, type CuttleKey, orbylThumbs } from '$lib/worker/config'
import ETrsf from '$lib/worker/modeling/transformation-ext'
import { for2, range } from '$lib/worker/util'
import { type Part, setup } from './node-model'
import { render, renderMulti, type RenderOptions } from './node-render'
import { PromisePool } from './promisePool'

const COLOR = 'purple'

interface Opts extends Partial<RenderOptions> {
  parts?: Part[]
}

async function renderTrimmed(conf: Cuttleform, filename: string, opts?: Opts) {
  const img = await render(conf, opts?.parts, 5000, 5000, { color: COLOR, ...opts })
  await img.resize(500, 500, { fit: 'outside' }).trim().toFile(filename)
}

async function renderMult(confs: Cuttleform[], filename: string, opts?: Opts) {
  const img = await renderMulti(confs, opts?.parts, 5000, 5000, { color: COLOR, ...opts })
  await img.resize(500, 500, { fit: 'outside' }).trim().toFile(filename)
}

const DEFAULTS: Omit<Cuttleform, 'keys'> = {
  wallThickness: 4,
  wallShrouding: 0,
  webThickness: 0,
  screwIndices: [],
  screwType: 'screw insert',
  screwSize: 'M3',
  screwCountersink: true,
  rounded: {},
  connector: null,
  connectorIndex: -1,
  microcontroller: null,
  verticalClearance: 0.1,
  clearScrews: true,
  shell: { type: 'basic', lip: false },
  wristRestOrigin: null as any,
}

const letter = (column: number, row: number) => ({
  1: '67890',
  2: 'yuiop',
  3: "hjkl;'",
  4: 'nm,./',
}[row]?.charAt(column) || undefined)

/** Used on Expert Mode docs for sphere layout */
function kbSphere(): Cuttleform {
  const thumbOrigin = new ETrsf()
    .rotate(10, [0, 0, 0], [1, 0, 0])
    .rotate(-15, [0, 0, 0], [0, 1, 0])
    .rotate(5, [0, 0, 0], [0, 0, 1])

  const keys = orbylThumbs('mx-better', 'xda', { curvature: -10 * 45 }, thumbOrigin)
  return { ...DEFAULTS, keys }
}

/** Used on Expert Mode docs for matrix layout */
function kbMatrix(): Cuttleform {
  const columns = range(0, 5)
  const rows = range(0, 4)

  const keys = for2<number, number, CuttleKey>(columns, rows)((column, row) => ({
    type: 'mx-better',
    keycap: {
      profile: 'xda',
      row: row + 1,
      letter: letter(column, row + 1),
    },
    aspect: 1,
    cluster: 'fingers',
    position: new ETrsf().placeOnMatrix({
      curvatureOfColumn: 15,
      curvatureOfRow: 5,
      spacingOfRows: 20.5,
      spacingOfColumns: 21.5,
      column: column - 2,
      row: row - 2.5,
    }),
  })).flat()

  return { ...DEFAULTS, keys: keys }
}

/** Used on Expert Mode docs for sphere layout example */
function kbStadium(): Cuttleform {
  // Define the letters to be placed on each row
  const rows = ['zxcvbnm', 'asdfghjkl', 'qwertyuiop']
  const keys: CuttleKey[] = []

  // Construct the keys with for loops
  for (let r = 0; r < rows.length; r++) {
    for (let i = 0; i < rows[r].length; i++) {
      // The key's offset from the center
      const center = 0.5 - (i / (rows[r].length - 1))
      keys.push({
        type: 'mx-better',
        keycap: { profile: 'xda', row: 5, letter: rows[r][i] },
        cluster: 'fingers',
        aspect: 1,
        position: new ETrsf()
          .placeOnSphere({
            curvature: 15, // Play around with the curvature to make new designs!
            spacing: 18.5,
            angle: 0, // The rotation happens afterwards
            row: r + 2,
          })
          .translate([110, 0, 0]) // Push the keys out from the center
          .rotate(56 * center), // Span a total of 56 degrees
      })
    }
  }

  return { ...DEFAULTS, keys: keys }
}

export function kbOpenSource(): Cuttleform[] {
  const curvature = {
    curvatureOfColumn: 15,
    curvatureOfRow: 5,
    spacingOfRows: 19,
    spacingOfColumns: 19.5,
  }

  const phrase = (phrase: string, plane: ETrsf) =>
    [...phrase].map((c, i) => ({
      type: 'choc',
      keycap: { profile: 'choc', row: 2, letter: c },
      cluster: 'fingers',
      aspect: 1,
      position: new ETrsf()
        .placeOnMatrix({ ...curvature, row: 0, column: i - (phrase.length - 1) / 2 })
        .transformBy(plane),
    } as CuttleKey))

  const kb1Plane = new ETrsf()
    .rotate(-6, [0, 0, 0], [0, 1, 0], false)
    .rotate(1, [0, 0, 0], [1, 0, 0], false)
    .translate(-80, 0, 0, false)

  const kb2Plane = new ETrsf()
    .rotate(6, [0, 0, 0], [0, 1, 0], false)
    .rotate(1, [0, 0, 0], [1, 0, 0], false)
    .translate(80, 0, 0, false)

  const keys1: CuttleKey[] = [
    ...phrase('OPEN–', kb1Plane),
    {
      type: 'cirque-23mm',
      size: { sides: 50 },
      aspect: 1,
      cluster: 'fingers',
      position: new ETrsf()
        .placeOnMatrix({ ...curvature, column: 2.5, row: 1.3 })
        .transformBy(kb1Plane),
    },
    {
      type: 'ec11',
      aspect: 1,
      cluster: 'fingers',
      position: new ETrsf()
        .placeOnMatrix({ ...curvature, column: 1.5, row: 1.3 })
        .transformBy(kb1Plane),
    },
  ]

  const keys2: CuttleKey[] = [
    ...phrase('SOURCE', kb2Plane),
    {
      type: 'trackball',
      size: { radius: 20.9, sides: 10 },
      aspect: 1,
      cluster: 'fingers',
      position: new ETrsf()
        .placeOnMatrix({
          ...curvature,
          column: -2.5,
          row: 1.3,
        })
        .translate(0, 0, 0)
        .transformBy(kb2Plane),
    },
    {
      type: 'blank',
      size: { width: 18.5, height: 18.5 },
      aspect: 1,
      cluster: 'fingers',
      position: new ETrsf()
        .placeOnMatrix({ ...curvature, column: -0.5, row: 1 })
        .transformBy(kb2Plane),
    },
  ]

  return [{ ...DEFAULTS, keys: keys1 }, { ...DEFAULTS, keys: keys2 }]
}

export function kbCosmos(): Cuttleform {
  const curvature = {
    curvatureOfColumn: 5,
    curvatureOfRow: 6,
    spacingOfRows: 19,
    spacingOfColumns: 19.5,
  }

  const phrase = (phrase: string, plane: ETrsf, row: number) =>
    [...phrase].map((c, i) => ({
      type: 'choc',
      keycap: { profile: 'choc', row: 2, letter: c },
      cluster: 'fingers',
      aspect: 1,
      position: new ETrsf()
        .placeOnMatrix({ ...curvature, row: row, column: i - (phrase.length - 1) / 2 })
        .transformBy(plane),
    } as CuttleKey))

  const plane = new ETrsf()
    .rotate(-12, [0, 0, 0], [0, 1, 0], false)
    .rotate(5, [0, 0, 0], [1, 0, 0], false)
    .translate(-80, 0, 0, false)

  const keys: CuttleKey[] = [
    ...phrase('COSMOS', plane, 0),

    {
      type: 'trackball',
      aspect: 1,
      cluster: 'thumbs',
      position: new ETrsf()
        .rotate(-15, [0, 0, 0], [1, 0, 0])
        .rotate(-10, [0, 0, 0], [0, 1, 0])
        .translate(0, 0, 15)
        .placeOnMatrix({ ...curvature, row: 1.8, column: 1 })
        .transformBy(plane),
      size: { radius: 20.9, sides: 20 },
    },
    {
      type: 'ec11',
      aspect: 1,
      cluster: 'thumbs',
      position: new ETrsf()
        .rotate(-10)
        .rotate(-10, [0, 0, 0], [0, 1, 0])
        .translate(0, 0, 8)
        .placeOnMatrix({ ...curvature, row: 1.3, column: -0.5 })
        .transformBy(plane),
    },
  ]

  return [{ ...DEFAULTS, keys }, kbOpenSource()[1]]
}

async function main() {
  console.log('Setting up OpenCascade...')
  await setup()
  const pool = new PromisePool()
  const docs = (name: string) => 'docs/assets/target/' + name

  pool.add('Sphere', () => renderTrimmed(kbSphere(), docs('sphere.png'), { parts: ['holes'] }))
  pool.add('Matrix', () => renderTrimmed(kbMatrix(), docs('/matrix.png'), { parts: ['holes'] }))
  pool.add('Stadium', () => renderTrimmed(kbStadium(), docs('/stadium.png'), { cameraPos: [-1, 0.5, 0] }))
  pool.add('OpenSource', () => renderMult(kbOpenSource(), docs('/gen-opensource.png'), { zoom: 300, cameraPos: [0, 1, 0.4] }))
  pool.add('Cosmos', () => renderMult(kbCosmos(), docs('/gen-cosmos.png'), { zoom: 350, cameraPos: [0, 1, 0.4] }))

  await pool.run()
}

main()

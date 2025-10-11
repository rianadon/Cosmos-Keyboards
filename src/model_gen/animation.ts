// @ts-nocheck Unmaintained file

import cuttleform from '$assets/cuttleform.json' assert { type: 'json' }
import { cuttleConf, type Cuttleform, type CuttleformProto, type CuttleKey } from '$lib/worker/config'
import { spawn } from 'child_process'

import { fromGeometry } from '$lib/loaders/geometry'
import ETrsf from '$lib/worker/modeling/transformation-ext'
import type { Color } from 'sharp'
import { CONNECTOR, KEYCAP, SWITCH } from '../../target/proto/cuttleform'
import { generate, setup } from './node-model'
import { modelZoom, render } from './node-render'

const BACKGROUND: Color = { r: 15, g: 23, b: 42 }

function getCuttleform(): CuttleformProto {
  const conf = JSON.parse(JSON.stringify(cuttleform.options))
  conf.upperKeys.keycapType = KEYCAP.DSA
  conf.upperKeys.switchType = SWITCH.BOX
  conf.upperKeys.rows = 0
  conf.upperKeys.columns = 0
  conf.wall.connector = CONNECTOR.NONE
  return conf
}

const confCache: Record<string, ReturnType<typeof generate>> = {}

function renderPreset(conf: Cuttleform, rotation = 0) {
  return async () => {
    const key = JSON.stringify(conf)
    if (!confCache[key]) confCache[key] = generate(conf)
    const { mesh, plateMesh, center, switches, keys } = await confCache[key]
    const geo = fromGeometry(mesh)
    const plate = fromGeometry(plateMesh).geometry
    return {
      center,
      zoom: modelZoom(geo, 1),
      model: (zoom: number, center: any) => render(geo, 2000, 2000, center, { zoom, keys, switches, rotation }).resize(500, 500),
    }
  }
}

type Frame = ReturnType<typeof renderPreset>
type Model = Awaited<ReturnType<Frame>>

interface VideoOpts {
  fps: number
  center: boolean
  zoom: number
  zOffset?: number
}

function spawnFFMPEG(filename: string, format: 'mp4' | 'webm' | 'mov', opts: VideoOpts) {
  // dprint-ignore
  const outputOpts = {
        'mp4': ["-vcodec", "libx264", "-pix_fmt", "yuv420p"],
        'webm': ["-c:v", "libvpx-vp9", "-crf", "30", "-b:v", "0", "-pix_fmt", "yuva420p"],
        'mov': ["-c:v", "hevc_videotoolbox", "-allow_sw", "1", "-alpha_quality", "0.75", "-vtag", "hvc1", "-movflags", "+faststart"]
    }

  // dprint-ignore
  const ffmpeg = spawn("ffmpeg", [
        "-hide_banner", "-y", "-loglevel", "error", // Limit information output to console
        "-f", "image2pipe", "-c:v", "png", // The input format is PNG images
        "-r", ""+opts.fps, // Frame rate
        "-i", "-", // Input from pipe
        "-an", // No audio
        ...outputOpts[format], // Set output format
        `${filename}.${format}`
    ]);

  ffmpeg.stdout.on('data', data => console.log(data.toString()))
  ffmpeg.stderr.on('data', data => console.log(data.toString()))

  const end = new Promise((resolve, reject) => {
    ffmpeg.on('exit', (code) => {
      if (code === 0) resolve(code)
      else reject(code)
    })
  })

  return { ffmpeg, end }
}

async function createVideo(frames: Frame[], filename: string, opts: VideoOpts) {
  const mp4 = spawnFFMPEG(filename, 'mp4', opts)
  const webm = spawnFFMPEG(filename, 'webm', opts)
  const mov = spawnFFMPEG(filename, 'mov', opts)
  let i = 0

  let maxZoom = 0
  let maxCenter: [number, number, number] = [0, 0, 0]
  const models: Model[] = []
  for (const frame of frames) {
    process.stdout.write(`\rrendering ${filename} [${((++i) / frames.length * 50).toFixed(0)}%]`)
    const model = await frame()
    if (model.zoom > maxZoom) {
      maxZoom = Math.max(model.zoom, maxZoom)
      maxCenter = model.center
    }
    models.push(model)
  }

  if (opts.zOffset) maxCenter[2] += opts.zOffset

  for (const model of models) {
    process.stdout.write(`\rrendering ${filename} [${((++i) / frames.length * 50).toFixed(0)}%]`)
    const image = model.model(maxZoom * opts.zoom, opts.center ? model.center : maxCenter)
    webm.ffmpeg.stdin.write(await image.toFormat('png').toBuffer())
    mov.ffmpeg.stdin.write(await image.toFormat('png').toBuffer())
    mp4.ffmpeg.stdin.write(await image.flatten({ background: BACKGROUND }).toFormat('png').toBuffer())
  }
  console.log()
  webm.ffmpeg.stdin.end()
  mp4.ffmpeg.stdin.end()
  mov.ffmpeg.stdin.end()
  await Promise.all([webm.end, mp4.end, mov.end])
}

function easeInOutQuad(x: number): number {
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2
}

function easeInOutElastic(x: number): number {
  const c5 = (2 * Math.PI) / 4.5
  return x === 0 ? 0 : x === 1
    ? 1
    : x < 0.5
    ? -(Math.pow(2, 20 * x - 10) * Math.sin((20 * x - 11.125) * c5)) / 2
    : (Math.pow(2, -20 * x + 10) * Math.sin((20 * x - 11.125) * c5)) / 2 + 1
}

async function thumbsVideo() {
  const conf = getCuttleform()
  const frames: Frame[] = []

  frames.push(renderPreset(cuttleConf(conf)))
  conf.thumbCluster = { oneofKind: 'carbonfetThumb', carbonfetThumb: {} }
  frames.push(renderPreset(cuttleConf(conf)))
  conf.thumbCluster = { oneofKind: 'orbylThumb', orbylThumb: { curvature: 0 } }
  frames.push(renderPreset(cuttleConf(conf)))
  conf.thumbCluster = { oneofKind: 'curvedThumb', curvedThumb: { thumbCount: 5 } }
  frames.push(renderPreset(cuttleConf(conf)))
  await createVideo(frames, 'target/video/thumbs', { fps: 1, center: true, zoom: 0.6 })
}

async function keyboardVideo() {
  const conf = getCuttleform()
  conf.upperKeys.columns = 5
  conf.upperKeys.rows = 4
  conf.wall.roundedSide = true
  conf.thumbCluster = { oneofKind: 'orbylThumb', orbylThumb: { curvature: 10 * 45 } }
  const time = 24 * 4
  const frames: Frame[] = []

  console.log('lets go')
  for (let i = 0; i < time; i++) {
    frames.push(renderPreset(cuttleConf(conf), Math.PI * 4 * easeInOutElastic(i / time)))
  }

  await createVideo(frames, 'target/video/keyboard', { fps: 24, center: false, zoom: 0.9, zOffset: -5 })
}

/**
 * Animation showing the adjustment of positons and rotaitons on all axes.
 */
async function positionVideo() {
  const conf = cuttleConf(getCuttleform())
  const time = 24 * 1

  const keyCommon = { aspect: 1, type: 'mx', keycap: { profile: 'dsa', row: 1 } }
  const keys = (rotation: number, height: number) =>
    [
      { ...keyCommon, position: new ETrsf().rotate(rotation, [0, 0, 0], [0, 0, 1]).translate(0, 0, height + 5) },
      { ...keyCommon, position: new ETrsf().rotate(rotation, [0, 0, 0], [1, 0, 0]).translate(20, 0 - height, 6) },
      { ...keyCommon, position: new ETrsf().rotate(rotation, [0, 0, 0], [0, 1, 0]).translate(10 + height, 20, 15) },
    ] as CuttleKey[]

  const frames: Frame[] = []
  for (let i = 0; i < time; i++) {
    frames.push(renderPreset({ ...conf, keys: keys(10 * easeInOutQuad(i / time), easeInOutQuad(i / time) * 10 + 1) }))
  }
  for (let i = 0; i < time; i++) {
    frames.push(
      renderPreset({ ...conf, keys: keys(10 * easeInOutQuad(1 - i / time), easeInOutQuad(1 - i / time) * 10 + 1) }),
    )
  }

  await createVideo(frames, 'target/video/positions', { fps: 24, center: false, zoom: 1 })
}

/**
 * Animation of adjusting the curves on the curved thumb cluster.
 *
 * I initially was envisioning animating both the top and side curves.
 * However, limiting the animation to just the sides delivered the idea more clearly.
 */
async function curvesVideo() {
  const conf = getCuttleform()
  const time = 24 * 1
  conf.thumbCluster = { oneofKind: 'curvedThumb', curvedThumb: { thumbCount: 5 } }

  const div = (t: number) => 3 + Math.pow(2 * (1 - t), 10)

  const frames: Frame[] = []
  for (let i = 0; i < time; i++) {
    frames.push(renderPreset({ ...cuttleConf(conf), rounded: { side: { divisor: div(i / time) } } }))
  }
  for (let i = 0; i < time; i++) {
    frames.push(renderPreset({ ...cuttleConf(conf), rounded: { side: { divisor: div(1 - i / time) } } }))
  }
  // for (let i = 0; i < time; i++)
  //     frames.push(renderPreset({ ...cuttleConf(conf), rounded: { top: { horizontal: 5*(i+1)/time, vertical: 10*(i+1)/time } } }))
  // for (let i = 0; i < time; i++)
  //     frames.push(renderPreset({ ...cuttleConf(conf), rounded: { top: { horizontal: 5-5*(i)/time, vertical: 10-10*(i)/time } } }))

  await createVideo(frames, 'target/video/curves', { fps: 24, center: false, zoom: 0.6, zOffset: 5 })
}

/** Render all the animations */
async function main() {
  await setup()

  await curvesVideo()
  await keyboardVideo()
  await thumbsVideo()
  await positionVideo()
}

main()

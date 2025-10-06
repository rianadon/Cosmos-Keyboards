import { execFile } from 'child_process'
import fg from 'fast-glob'
import { existsSync, mkdirSync, statSync } from 'fs'
import { stat } from 'fs/promises'
import { format, parse } from 'path'
import sharp from 'sharp'
import { promisify } from 'util'
import { PromisePool } from '../model_gen/promisePool'

function main() {
  // Crate the output directories
  if (!existsSync('target/media')) {
    mkdirSync('target/media')
  }
  if (!existsSync('docs/assets/target')) {
    mkdirSync('docs/assets/target')
  }

  // Add all images and videos to the paths to be compressed
  const pool = new PromisePool()
  const images = fg.sync(['docs/assets/*.(png|jpg)', 'docs/assets/target/*.png'])
  for (const image of images) {
    addIfModified(pool, image, '.jpg', () => compressJpg(image))
    addIfModified(pool, image, '.webp', () => compressWebp(image))
    addIfModified(pool, image, '.avif', () => compressAvif(image))
  }
  for (const image of fg.sync('src/routes/showcase/assets/kbd-*.jpg')) {
    addIfModified(pool, image, '.thumb.jpg', () => compressThumbJpg(image, preprocessKeyboard(false)))
    // addIfModified(pool, image, '.thumb.webp', () => compressThumbWebp(image, preprocessKeyboard(false)))
    // addIfModified(pool, image, '.thumb.avif', () => compressThumbAvif(image, preprocessKeyboard(false)))
    addIfModified(pool, image, '.jpg', () => compressJpg(image, preprocessKeyboard(true)))
    // addIfModified(pool, image, '.webp', () => compressWebp(image, preprocessKeyboard(true)))
    // addIfModified(pool, image, '.avif', () => compressAvif(image, preprocessKeyboard(true)))
  }
  for (const video of fg.sync('docs/assets/*.(mp4)')) {
    addIfModified(pool, video, '.mp4', () => compressMp4(video))
    addIfModified(pool, video, '.webm', () => compressWebm(video))
  }
  pool.run().then(() => console.log('Done optimizing!'))
}

/** Fit keyboard to 19:10 aspect ratio and reduce size */
function preprocessKeyboard(large: boolean) {
  return (img: sharp.Sharp) => {
    const [width, height] = large ? [1900, 1000] : [668, 352]
    return img.resize(width, height, {
      fit: 'cover',
      withoutEnlargement: true,
    })
  }
}

/** Only add the task if the input file was modified after the last optimization */
function addIfModified(pool: PromisePool, filename: string, ext: string, task: () => Promise<string>) {
  const out = target(filename, ext)
  const inMtime = statSync(filename).mtime
  let outMtime = new Date(0)
  try {
    outMtime = statSync(out).mtime
  } catch (_) {}
  if (inMtime > outMtime) {
    pool.add(`${filename}→${ext}`, task)
  }
}

const target = (path: string, ext: string) => {
  if (path.startsWith('docs')) {
    return format({ ...parse(path), dir: 'docs/assets/target', base: undefined, ext })
  }
  return format({ ...parse(path), dir: 'target/media', base: undefined, ext })
}
const inKB = (size: number) => Math.ceil(size / 1000) + 'kB'
const formatSize = (begin: number, end: number) => inKB(begin) + ' ⭢  ' + inKB(end)

/** Compress images using the sharp library */
function compressSharp(fn: (inp: sharp.Sharp) => sharp.Sharp, ext: string) {
  return async (image: string, preprocess?: (inp: sharp.Sharp) => sharp.Sharp) => {
    const input = sharp(await sharp(image).toBuffer())
    const meta = await input.metadata()
    const output = await fn(preprocess ? preprocess(input) : input).toFile(target(image, ext))
    return formatSize(meta.size!, output.size)
  }
}

const compressJpg = compressSharp(img => img.jpeg({ mozjpeg: true, quality: 90 }), '.jpg')
const compressWebp = compressSharp(img => img.webp({ quality: 90, effort: 6 }), '.webp')
const compressAvif = compressSharp(img => img.avif({ quality: 90, effort: 6 }), '.avif')
const compressThumbJpg = compressSharp(img => img.jpeg({ mozjpeg: true, quality: 90 }), '.thumb.jpg')
const compressThumbWebp = compressSharp(img => img.webp({ quality: 90, effort: 6 }), '.thumb.webp')
const compressThumbAvif = compressSharp(img => img.avif({ quality: 90, effort: 6 }), '.thumb.avif')

const run = promisify(execFile)
/** Compress videos using the ffmpeg process */
function compressFfmpeg(opts: string[], ext: string) {
  return async (video: string) => {
    const inSize = (await stat(video)).size
    await run('ffmpeg', ['-y', '-i', video, '-threads', '1', ...opts, target(video, ext)])
    const outSize = (await stat(target(video, ext))).size
    return formatSize(inSize, outSize)
  }
}

const compressMp4 = compressFfmpeg(['-vcodec', 'libx264', '-pix_fmt', 'yuv420p', '-profile:v', 'baseline', '-level', '3', '-crf', '28', '-movflags', '+faststart'], '.mp4')
const compressWebm = compressFfmpeg(['-vcodec', 'libvpx', '-qmin', '0', '-qmax', '50', '-crf', '15', '-b:v', '500K', '-acodec', 'libvorbis'], '.webm')

main()

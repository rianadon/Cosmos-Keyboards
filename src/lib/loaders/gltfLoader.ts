import type { Mesh } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
import { makeAsyncCacher } from './cacher'

let glbUrls: Record<string, { default: string }> | undefined = {}
try {
  glbUrls = import.meta.glob(['$target/*.glb', '$assets/*.glb'], { query: '?url', eager: true })
} catch (e) {
  glbUrls = undefined
}
const loader = new GLTFLoader()

const load = async (url: string) =>
  glbUrls
    ? loader.loadAsync(url)
    : loader.parseAsync((await (await import(process.env.FS!)).readFile(url)).buffer, '')

const cacher = makeAsyncCacher(async (url: string) => {
  const urls = glbUrls || JSON.parse(process.env.GLB_URLS!)
  if (!urls[url]) throw new Error(`Model for url ${url} does not exist`)
  return load(urls[url].default).then(g => (g.scene.children[0] as Mesh).geometry)
})

export default function loadGLTF(url: string) {
  return cacher(url, url)
}

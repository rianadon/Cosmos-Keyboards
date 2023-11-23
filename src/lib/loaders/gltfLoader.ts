import type { Mesh } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
import { makeAsyncCacher } from './cacher'

const glbUrls = import.meta.glob(['$target/*.glb', '$assets/*.glb'], { as: 'url', eager: true })
const loader = new GLTFLoader()
const cacher = makeAsyncCacher(async (url: string) => {
  if (!glbUrls[url]) throw new Error(`Model for url ${url} does not exist`)
  return await loader.loadAsync(glbUrls[url]).then(g => (g.scene.children[0] as Mesh).geometry)
})

export default function loadGLTF(url: string) {
  return cacher(url, url)
}

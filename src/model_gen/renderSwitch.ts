import { BOARD_PROPERTIES } from '$lib/geometry/microcontrollers'
import { partGeometry } from '$lib/loaders/parts'
import { objKeys } from '$lib/worker/util'
import { writeFile } from 'fs/promises'
import { Mesh, MeshBasicMaterial, OrthographicCamera, Scene, Vector3 } from 'three'
import { createRenderPage, renderScene } from './node-render'

const { page, browser } = await createRenderPage()

const [width, height] = [256, 256]

for (const sw of ['mx-better', 'choc-v1', 'alps']) {
  const geo = await partGeometry(sw, {})
  const scene = new Scene()

  const keyMesh = new Mesh(geo!, new MeshBasicMaterial({ color: 'pink' }))
  scene.add(keyMesh)

  const camera = new OrthographicCamera(-5.5, 5.5, 5.5, -5.5)
  camera.position.set(0, -100, 2)
  camera.up.set(0, 0, 1)
  camera.lookAt(new Vector3(0, 0, 2))

  const { data } = await renderScene(scene, camera, page, { width, height })

  await writeFile(`target/switch-${sw}.png`, data as any)
}

await browser.close()

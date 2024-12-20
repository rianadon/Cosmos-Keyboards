import { BOARD_PROPERTIES } from '$lib/geometry/microcontrollers'
import { fetchBoardElement } from '$lib/loaders/boardElement'
import { objKeys } from '$lib/worker/util'
import { writeFile } from 'fs/promises'
import { Mesh, MeshBasicMaterial, OrthographicCamera, Scene, Vector3 } from 'three'
import { createRenderPage, renderScene } from './node-render'

const { page, browser } = await createRenderPage()

const [width, height] = [512, 256]

for (const microcontroller of objKeys(BOARD_PROPERTIES)) {
  const geo = await fetchBoardElement({ model: microcontroller } as any)
  const size = BOARD_PROPERTIES[microcontroller].size
  const scene = new Scene()

  const keyMesh = new Mesh(geo!, new MeshBasicMaterial({ color: 'pink' }))
  scene.add(keyMesh)

  const camera = new OrthographicCamera(-16, 16, 8, -8)
  camera.position.set(0, -size.y / 2, 100)
  camera.up.set(0, 0, 1)
  camera.lookAt(new Vector3(0, -size.y / 2, 0))

  const { data } = await renderScene(scene, camera, page, { width, height })

  await writeFile(`target/microcontroller-${microcontroller}.png`, data as any)
}

await browser.close()

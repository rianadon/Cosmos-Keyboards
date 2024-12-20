import { KEY_INFO } from '$lib/geometry/keycaps'
import { keyGeometries } from '$lib/loaders/keycaps'
import { type CuttleKey } from '$lib/worker/config'
import Trsf from '$lib/worker/modeling/transformation'
import { objKeys } from '$lib/worker/util'
import { writeFile } from 'fs/promises'
import { Mesh, MeshBasicMaterial, OrthographicCamera, Scene, Vector3 } from 'three'
import { createRenderPage, renderScene } from './node-render'

const { page, browser } = await createRenderPage()

const [width, height] = [256, 256]

for (const keycap of objKeys(KEY_INFO)) {
  const key: CuttleKey = {
    type: 'mx-better',
    position: null as any,
    aspect: 1,
    cluster: 'idk',
    keycap: { profile: keycap as any, row: 2 },
  }
  const geo = await keyGeometries([new Trsf()], [key])
  const scene = new Scene()

  const keyMesh = new Mesh(geo[0].geometry, new MeshBasicMaterial({ color: 'pink' }))
  scene.add(keyMesh)

  const camera = new OrthographicCamera(-5, 5, 5, -5)
  camera.zoom = 0.08
  camera.position.set(-100, 0, 8)
  camera.up.set(0, 0, 1)
  camera.lookAt(new Vector3(0, 0, 8))

  const { data } = await renderScene(scene, camera, page, { width, height })
  await writeFile(`target/keycap-${keycap}.png`, data as any)

  keyMesh.material = new MeshBasicMaterial({ color: 'white' })
  const { data: thumb } = await renderScene(scene, camera, page, { width: 32, height: 32 })
  await writeFile(`target/keycap-${keycap}-thumb.png`, thumb as any)
}

await browser.close()

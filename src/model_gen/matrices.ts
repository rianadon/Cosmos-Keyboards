import { type Cuttleform, type CuttleKey, fullEstimatedCenter, type Geometry, newFullGeometry } from '$lib/worker/config'
import { type CosmosKeyboard, fromCosmosConfig } from '$lib/worker/config.cosmos'
import { mapObj, objEntries } from '$lib/worker/util'
import { writeFile } from 'fs/promises'
import { Group, type Material, Mesh, MeshBasicMaterial, PerspectiveCamera, Scene, type ShapeGeometry, Vector3 } from 'three'
import { findMatrix, keyLine } from '../routes/beta/lib/matrixLayout'
import { deserialize } from '../routes/beta/lib/serialize'
import type { FullGeometry } from '../routes/beta/lib/viewers/viewer3dHelpers'
import { drawLinedWall, drawPath, drawWall, fullSizes, rectangle } from '../routes/beta/lib/viewers/viewerHelpers'
import { keyboards } from '../routes/showcase/showcase'
import { createRenderPage, dataURLToData, mergeDataURLs, renderScene, zoomForSize } from './node-render'

/** Group keys by the cluster they belong to. */
function splitByCluster(conf: Cuttleform) {
  const clusters: Record<string, CuttleKey[]> = {}
  for (const k of conf.keys) {
    if (!clusters.hasOwnProperty(k.cluster)) clusters[k.cluster] = []
    clusters[k.cluster].push(k)
  }
  return clusters
}

/** Computes matrix and renders Three.js geometry for displaying it and the keys. */
function drawStates(darkMode: boolean, geometry: FullGeometry) {
  return mapObj(geometry as Required<typeof geometry>, (g, kbd) => drawState(g!.c, darkMode, g!))
}

function drawState(
  conf: Cuttleform,
  darkMode: boolean,
  geo: Geometry,
) {
  // How to use the optimizer
  const matCol: ReturnType<typeof keyLine> = []
  const matRow: ReturnType<typeof keyLine> = []

  // All the computation happens in these 3 lines.
  const clusters = splitByCluster(conf)
  objEntries(clusters).forEach(([name, c]) => {
    if (name == 'thumbs') {
      const { matRow: mr, matCol: mc } = findMatrix(c)
      matCol.push(...mc)
      matRow.push(...mr)
    } else {
      matCol.push(...keyLine(c, 'col'))
      matRow.push(...keyLine(c, 'row'))
    }
  })
  // const matCol = Object.values(clusters).flatMap((c) => keyLine(c, 'col'))
  // const matRow =  Object.values(clusters).flatMap((c) => keyLine(c, 'row'))

  const geos: { geometry: ShapeGeometry; material: Material }[] = []

  const keys = geo.keyHolesTrsfs2D

  const positions = keys.flat().map((k) => k.xyz().slice(0, 2))
  geos.push(
    ...positions.map((p) => ({
      geometry: rectangle(p[0], p[1]),
      material: new MeshBasicMaterial({ color: darkMode ? 0xffffff : 0x000000 }),
    })),
  )

  const pts = geo.allKeyCriticalPoints2D
  // const allProj = pts.flat().map(p => p.xy())

  geos.push(
    ...pts.map((p) => ({
      geometry: drawWall(p.map((p) => p.xy())),
      material: new MeshBasicMaterial({ color: 0xffcc33, transparent: true, opacity: 0.1 }),
    })),
  )
  geos.push(
    ...pts.map((p) => ({
      geometry: drawLinedWall(p.map((p) => p.xy())),
      material: new MeshBasicMaterial({ color: 0xffcc33 }),
    })),
  )

  geos.push(
    ...matRow.map((row) => ({
      geometry: drawPath(
        row.map((k) => k.origin.xy()),
        1,
      ),
      material: new MeshBasicMaterial({ color: 0x3333ff }),
    })),
  )
  geos.push(
    ...matCol.map((column) => ({
      geometry: drawPath(
        column.map((k) => k.origin.xy()),
        1,
      ),
      material: new MeshBasicMaterial({ color: 0xff3333 }),
    })),
  )
  return geos
}

const { page, browser } = await createRenderPage()

const urls = []
const [width, height] = [1000, 500]

for (const keyboard of keyboards) {
  const deserialized = keyboard.config ? deserialize(keyboard.config.substring(1), () => undefined as any).options as CosmosKeyboard : undefined
  const cuttleConf = deserialized ? fromCosmosConfig(deserialized) : undefined
  if (!cuttleConf) continue

  const geometry = newFullGeometry(cuttleConf)
  const center = fullEstimatedCenter(geometry, false)['both']

  const geos = drawStates(false, geometry)
  const size = fullSizes(mapObj(geos, (l) => l.map((g) => g.geometry)))['both']
  const scene = new Scene()

  for (const [kbd, geo] of objEntries(geos)) {
    const group = new Group()
    const cent = center[kbd]!
    group.position.set(-cent[0], -cent[1], -cent[2])
    group.scale.x = kbd == 'left' ? -1 : 1
    geo.forEach(g => group.add(new Mesh(g.geometry, g.material)))
    scene.add(group)
  }

  const zoom = zoomForSize(size, width / height)
  const camera = new PerspectiveCamera(50, width / height, 1, 1000)
  camera.position.set(0, 0, 1).normalize().multiplyScalar(zoom)
  camera.up.set(0, 0, 1)

  const { data, dataURL } = await renderScene(scene, camera, page, { width, height })

  await writeFile(`matrices/${keyboard.key}.png`, data)
  urls.push(dataURL)
}

await writeFile(`matrices/big.png`, dataURLToData(await mergeDataURLs(urls, page, { width, height })))

await browser.close()

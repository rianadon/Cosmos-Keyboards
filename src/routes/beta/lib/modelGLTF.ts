/**
 * Utilities to export the model as a GLTF file.
 * Used in GLTF/GLB export and static previews.
 */

import { drawLetter } from '$lib/3d/materials'
import { boardGeometries } from '$lib/loaders/boardElement'
import { fromGeometry } from '$lib/loaders/geometry'
import { keyGeometries } from '$lib/loaders/keycaps'
import { partGeometries } from '$lib/loaders/parts'
import * as THREE from 'three'
import type { FullGeometry } from './viewers/viewer3dHelpers'
import type { WorkerPool } from './workerPool'

export async function modelAsScene(pool: WorkerPool<typeof import('$lib/worker/api')>, geometry: FullGeometry, side: 'left' | 'right' | 'unibody') {
  const geo = geometry[side]!
  const conf = geo.c
  const wall = pool.execute((p) => p.cutWall(conf))
  const web = pool.execute((p) => p.generateWeb(conf))
  const key = pool.execute((p) => p.generateKeysMesh(conf, side == 'left'))
  const plate = pool.execute((p) => p.generatePlate(conf, true))
  const holder = pool.execute((p) => p.generateBoardHolder(conf))
  const inserts = pool.execute((p) => p.generateScrewInserts(conf))

  const keys = keyGeometries(geo.keyHolesTrsfs, conf.keys)
  const switches = partGeometries(geo.keyHolesTrsfs, conf.keys, false)
  const microcontroller = boardGeometries(conf, geo)

  function node(name: string, geometry: THREE.BufferGeometry, material: THREE.Material) {
    const mesh = new THREE.Mesh(geometry, material)
    mesh.name = name
    return mesh
  }

  const scene = new THREE.Scene()
  const group = new THREE.Group()
  group.rotation.set(-Math.PI / 2, 0, 0)
  group.scale.setScalar(1 / 10)
  group.position.setY(-geo.floorZ / 10)
  if (side == 'left') group.scale.x *= -1
  group.name = 'Keyboard'
  scene.add(group)

  const switchMaterial = new THREE.MeshStandardMaterial({ color: '#fff' })
  switchMaterial.name = 'Switch Parts'
  const kbMaterial = new THREE.MeshStandardMaterial({ color: '#ccc' })
  kbMaterial.name = 'Keyboard'
  const plateMaterial = new THREE.MeshStandardMaterial({ color: '#999' })
  plateMaterial.name = 'Plate'
  const caseGroup = new THREE.Group()
  caseGroup.name = 'Case'
  group.add(caseGroup)
  caseGroup.add(node('Wall', fromGeometry((await wall).mesh)!, kbMaterial))
  caseGroup.add(node('Web', fromGeometry((await web).mesh)!, kbMaterial))
  caseGroup.add(node('Sockets', fromGeometry(await key)!, kbMaterial))
  const plateResult = await plate
  group.add(node('Plate', fromGeometry(plateResult.top.mesh)!, plateMaterial))
  if (plateResult.bottom) {
    group.add(node('Plate Bottom', fromGeometry(plateResult.bottom.mesh)!, plateMaterial))
  }
  const insertsResult = await inserts
  if (insertsResult.baseInserts.mesh) {
    group.add(node('Base Inserts', fromGeometry(insertsResult.baseInserts.mesh)!, kbMaterial))
  }
  if (insertsResult.plateInserts.mesh) {
    group.add(node('Plate Inserts', fromGeometry(insertsResult.plateInserts.mesh)!, kbMaterial))
  }
  if (conf.microcontroller) {
    const microcontrollerGroup = new THREE.Group()
    microcontrollerGroup.name = 'Microcontroller'
    for (const g of await microcontroller) {
      const mesh = new THREE.Mesh(g.board, switchMaterial)
      g.matrix.decompose(mesh.position, mesh.quaternion, mesh.scale)
      if (side == 'left') mesh.scale.x = -1
      microcontrollerGroup.add(mesh)
    }
    group.add(microcontrollerGroup)
    group.add(node('Microcontroller Holder', fromGeometry((await holder)!.mesh)!, kbMaterial))
  }
  const componentsGroup = new THREE.Group()
  componentsGroup.name = 'Components'
  group.add(componentsGroup)
  ;(await keys).forEach((k) => {
    const material = new THREE.MeshStandardMaterial()
    if ('keycap' in k.key && k.key.keycap && k.key.keycap.letter) {
      const canvas = document.createElement('canvas')
      canvas.width = 512
      canvas.height = 512
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = 'white'
      ctx.fillRect(0, 0, 512, 512)
      drawLetter(canvas, k.key.keycap.letter, false, 'black')
      material.map = new THREE.CanvasTexture(canvas)
    } else {
      material.color = new THREE.Color('white')
    }
    const n = node('Key', k.geometry, material)
    k.matrix.decompose(n.position, n.quaternion, n.scale)
    if (side == 'left') n.scale.x = -1
    componentsGroup.add(n)
  })
  ;(await switches).forEach((k) => {
    const n = node('Part', k.geometry, switchMaterial)
    k.matrix.decompose(n.position, n.quaternion, n.scale)
    if (side == 'left') n.scale.x = -1
    componentsGroup.add(n)
  })

  return scene
}

<script lang="ts">
  import { onDestroy, onMount } from 'svelte'
  import {
    BoxGeometry,
    BufferAttribute,
    BufferGeometry,
    Euler,
    Matrix4,
    Object3D,
    Quaternion,
    Triangle,
    Vector3,
    MeshBasicMaterial,
  } from 'three'
  import * as SC from 'svelte-cubed'
  import {
    thumbOrigin,
    type CuttleformProto,
    matrixToConfig,
    type Cuttleform,
    type CuttleKey,
    findKeyByAttr,
    tupleToRot,
    tupleToXYZ,
    cuttleConf,
    thumbs,
    decodeTuple,
    encodeTuple,
    type Geometry,
  } from '$lib/worker/config'
  import type { ConfError } from '$lib/worker/check'
  import Viewer from './Viewer.svelte'
  import Trsf from '$lib/worker/modeling/transformation'
  import { protoConfig, transformMode, clickedKey } from '$lib/store'
  import HandModel from '$lib/3d/HandModel.svelte'
  import { FINGERS, type Joints, objectFromFingers, SolvedHand } from '../hand'
  import { refine } from '../handoptim'
  import Keyboard from '$lib/3d/Keyboard.svelte'
  import * as flags from '$lib/flags'
  import TransformControls from '$lib/3d/TransformControls.svelte'
  import AxesHelper from '$lib/3d/AxesHelper.svelte'
  import Raycaster from '$lib/3d/Raycaster.svelte'
  import { keyPosition, keyPositionTop } from '$lib/worker/modeling/transformation-ext'
  import { closestAspect, keyInfo } from '$lib/geometry/keycaps'
  import { switchInfo } from '$lib/geometry/switches'
  import { simplekeyGeo, simpleTris } from '$lib/worker/simplekeys'
  import { KeyMaterial } from '$lib/3d/materials'
  import { boardGeometries } from '$lib/loaders/boardElement'
  import {
    allKeyCriticalPoints,
    allWallCriticalPoints,
    applyKeyAdjustment,
    keyHolesTrsfs,
    componentBoxes,
    componentGeometry,
    wristRestGeometry,
  } from '$lib/worker/geometry'
  import * as mdi from '@mdi/js'
  import Icon from '$lib/presentation/Icon.svelte'
  import KeyboardMesh from '$lib/3d/KeyboardMesh.svelte'
  import { Cuttleform_CustomThumb } from '$target/proto/cuttleform'

  export let showSupports = false
  export let style: string = ''
  export let center: [number, number, number]
  export let size: THREE.Vector3
  export let cameraPosition: [number, number, number] = [0, 0.8, 1]
  export let enableRotate = true
  export let enableZoom = false
  export let is3D = false
  export let isExpert
  export let transparency
  export let flip = true
  export let showHand = true
  export let error: ConfError
  export let geometry: Geometry | null

  export let conf: Cuttleform

  let pressedLetter: string | null = null
  let raycast

  $: addHeight = 0
  $: cluster = $protoConfig?.thumbCluster
  $: plane = cluster?.oneofKind === 'customThumb' ? cluster.customThumb.plane : undefined
  $: planeMatrix = plane
    ? {
        plane: true,
        matrix: new Trsf()
          .rotate(tupleToRot(plane.rotation).alpha, [0, 0, 0], [1, 0, 0])
          .rotate(tupleToRot(plane.rotation).beta, [0, 0, 0], [0, 1, 0])
          .rotate(tupleToRot(plane.rotation).gamma, [0, 0, 0], [0, 0, 1])
          .translate(tupleToXYZ(plane.position))
          .premultiply(
            thumbOrigin($protoConfig, true).evaluate({ flat: false }, new Trsf()) as Trsf
          )
          .translate(0, 0, addHeight)
          .Matrix4(),
      }
    : undefined
  $: keyMatrices =
    conf && cluster?.oneofKind === 'customThumb'
      ? cluster.customThumb.key.map((k, i) => {
          return {
            plane: false,
            matrix: keyToTrsf(k, planeMatrix!.matrix),
          }
        })
      : []

  const sentence = 'pink,plum;youlhuminjoy.'
  const fingersToKeys = {
    '6': 'indexFinger',
    '7': 'indexFinger',
    '8': 'middleFinger',
    '9': 'ringFinger',
    '0': 'pinky',
    y: 'indexFinger',
    u: 'indexFinger',
    i: 'middleFinger',
    o: 'ringFinger',
    p: 'pinky',
    h: 'indexFinger',
    j: 'indexFinger',
    k: 'middleFinger',
    l: 'ringFinger',
    ';': 'pinky',
    n: 'indexFinger',
    m: 'indexFinger',
    ',': 'middleFinger',
    '.': 'ringFinger',
    '/': 'pinky',
  }

  function reachability(keys: CuttleKey[], joints: Joints[], origin: Vector3) {
    return keys.map((k) => {
      const finger = 'keycap' in k && k.keycap.letter ? fingersToKeys[k.keycap.letter] : 'thumb'
      const reach = joints[finger || 'thumb'].reduce((a, j) => a + j.length, 0) * 1000
      const distance = pos15(k).distanceTo(origin)
      return distance <= reach
    })
  }

  let customThumbConfig: Matrix4[] | null
  $: updateThumbs(keyMatrices)

  function updateThumbs(keyMatrices) {
    customThumbConfig = keyMatrices.length
      ? cluster.customThumb.key.map((k, i) => keyToTrsf2(keyMatrices[i].matrix, i))
      : null
    console.log('Set new custom thumbs', keyMatrices, customThumbConfig)
  }

  function onTransform(index: number, obj: Matrix4) {
    if (index == 0) {
      // The plane
      const relative = new Matrix4().multiplyMatrices(
        thumbOrigin($protoConfig, true)
          .evaluate({ flat: false }, new Trsf())
          .translate(0, 0, addHeight)
          .Matrix4()
          .invert(),
        obj
      )
      protoConfig.update((p) => {
        // @ts-ignore
        p.thumbCluster.customThumb.plane = matrixToConfig(relative)
        return p
      })
    } else {
      // A key
      const relative = new Matrix4().multiplyMatrices(planeMatrix!.matrix.clone().invert(), obj)
      const translation = new Vector3().setFromMatrixPosition(relative)
      protoConfig.update((p) => {
        const keys = thumbs(p)
        // @ts-ignore
        p.thumbCluster.customThumb.key[index - 1] = matrixToConfig(relative, keys[index - 1])
        return p
      })
    }
  }

  function keyToTrsf(k: any, obj) {
    const rot = tupleToRot(k.rotation)
    return new Trsf()
      .rotate(rot.alpha, [0, 0, 0], [1, 0, 0])
      .rotate(rot.beta, [0, 0, 0], [0, 1, 0])
      .rotate(rot.gamma, [0, 0, 0], [0, 0, 1])
      .translate(tupleToXYZ(k.position))
      .Matrix4()
      .premultiply(obj)
  }

  function keyToTrsf2(m: Matrix4, i: number) {
    const keyIndex = conf.keys.length - cluster.customThumb.key.length + i
    const key = conf.keys[keyIndex]
    const adj = applyKeyAdjustment(key, new Trsf()).Matrix4()

    return new Matrix4().multiplyMatrices(m, adj)
  }

  function onMove(index: number, obj: Matrix4) {
    if (index == 0) {
      customThumbConfig = cluster.customThumb.key.map((k, i) =>
        keyToTrsf2(keyToTrsf(k, obj), index - 1)
      )
    } else {
      // A key
      customThumbConfig[index - 1] = keyToTrsf2(obj, index - 1)
    }
  }

  let jointsJSON: { left: Joints; right: Joints } | undefined = readHands()
  $: whichHand = flip ? 'left' : 'right'

  let theHand = jointsJSON ? new SolvedHand(jointsJSON[whichHand], new Matrix4()) : undefined
  let handMatrix = new Matrix4().setPosition(60 + center[0], -85, -5)

  let handMatrixInitialized = false
  $: if (conf && geometry && !handMatrixInitialized) {
    if (conf.wristRest) {
      const wrGeo = wristRestGeometry(conf, geometry)
      handMatrix = new Matrix4().setPosition(
        wrGeo.leftEnd
          .lerp(wrGeo.rightEnd, 0.5)
          .sub(new Vector3(...center))
          .add(new Vector3(0, 5, 10))
      )
      handPosition = new Vector3().setFromMatrixPosition(handMatrix).toArray()
    }
    handMatrixInitialized = true
  }

  let debug = new Matrix4()

  function fit(targets: Record<string, Vector3 | undefined>) {
    const tg = Object.fromEntries(
      Object.entries(targets)
        .filter(([k, v]) => !!v)
        .map(([k, v]) => (flip ? [k, new Vector3(v.x, v.y, v.z)] : [k, v]))
    )
    const ik = Object.fromEntries(
      FINGERS.map((f) => [f, [new Vector3(), new Vector3(), new Vector3(), new Vector3()]])
    )
    const position = new Vector3().setFromMatrixPosition(handMatrix)
    handMatrix = new Matrix4()
      .makeRotationFromEuler(
        flip ? new Euler(0, Math.PI / 2, Math.PI) : new Euler(0, -Math.PI / 2, 0)
      )
      .setPosition(position)
    const { m, Vt } = refine(handMatrix, jointsJSON[whichHand], tg)
    handMatrix = m
    debug = new Matrix4().multiplyMatrices(handMatrix, new Matrix4().copy(Vt))
    theHand = new SolvedHand(jointsJSON[whichHand], handMatrix)
    for (const [finger, position] of Object.entries(tg)) {
      ik[finger] = theHand.ik(finger, position, 1000)
    }
    handRotation = new Euler().setFromRotationMatrix(handMatrix).toArray()
    handPosition = new Vector3().setFromMatrixPosition(handMatrix).toArray()
    return ik
  }

  const keyDepth = (k: CuttleKey) => keyInfo(k).depth

  const HAND_RADIUS = 2

  const pos = (k: CuttleKey | undefined) =>
    k
      ? keyPositionTop(k, false)
          .pretranslated(0, 0, HAND_RADIUS)
          .origin()
          .sub(new Vector3(center[0], center[1], center[2] - addHeight))
      : undefined
  const pos15 = (k: CuttleKey | undefined) =>
    k
      ? keyPositionTop(k, false)
          .pretranslated(
            0,
            0,
            -switchInfo(k.type).height + switchInfo(k.type).pressedHeight + HAND_RADIUS
          )
          .origin()
          .sub(new Vector3(center[0], center[1], center[2] - addHeight))
      : undefined
  function theBigFit() {
    return fit({
      indexFinger: pos(findKeyByAttr(conf, 'home', 'index')),
      middleFinger: pos(findKeyByAttr(conf, 'home', 'middle')),
      ringFinger: pos(findKeyByAttr(conf, 'home', 'ring')),
      pinky: pos(findKeyByAttr(conf, 'home', 'pinky')),
      thumb: pos(findKeyByAttr(conf, 'home', 'thumb')),
    })
  }
  $: if (conf && jointsJSON) {
    theBigFit()
  }

  let handRotation = undefined
  let handPosition = new Vector3()

  function easeInOutQuad(x: number): number {
    return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2
  }

  let req: number
  let zPos = 0

  function toggleplay(sentence: string) {
    if (playing) {
      playing = false
      return
    }
    playing = true
    play(sentence)
  }

  let playing = false
  function play(sentence: string, beginning: Record<string, Vector3[]> | undefined, index = 0) {
    if (index > sentence.length) {
      playing = false
      return
    }
    if (!beginning) beginning = theBigFit()

    const prevRot = new Quaternion().setFromEuler(new Euler().fromArray(handRotation))
    const prevPos = new Vector3().fromArray(handPosition)
    let targets
    if (index >= sentence.length) {
      targets = theBigFit()
    } else {
      const letter = sentence[index]
      const finger = fingersToKeys[letter]
      targets = fit({
        [finger]: pos15(findKeyByAttr(conf, 'letter', letter)),
      })
      console.log('letter', pressedLetter)
    }
    const newRot = new Quaternion().setFromEuler(new Euler().fromArray(handRotation))
    const newPos = new Vector3().fromArray(handPosition)

    const tStart = window.performance.now()
    ;(function step(t) {
      const p = (t - tStart) / 500
      if (p > 0.5) {
        pressedLetter = sentence[index]
      }

      const percent = easeInOutQuad(p)
      if (p > 1) return play(sentence, targets, ++index)
      theHand = new SolvedHand(jointsJSON[whichHand], theHand.position)
      for (const f of FINGERS) {
        if (!targets[f] || !beginning[f]) continue
        const current = beginning[f].map((b, i) =>
          new Vector3().subVectors(targets[f][i], b).multiplyScalar(percent).add(b)
        )
        theHand.fkBy(f, (i) => [current[i].z, current[i].y])
        if (f == fingersToKeys[pressedLetter]) {
          console.log('pl', pressedLetter)
          const key = findKeyByAttr(conf, 'letter', pressedLetter)
          const ti = keyPosition(key, false)
            .translate(-center[0], -center[1], -center[2])
            .invert()
            .Matrix4()
          const swInfo = switchInfo(key.type)
          const pos = theHand.worldPositions(f, 1000)
          zPos = Math.max(
            Math.min(
              pos[pos.length - 1].applyMatrix4(ti).z - HAND_RADIUS - swInfo.height - keyDepth(key),
              0
            ),
            swInfo.pressedHeight - swInfo.height
          )
        }
      }
      handPosition = new Vector3()
        .subVectors(newPos, prevPos)
        .multiplyScalar(percent)
        .add(prevPos)
        .toArray()
      handRotation = new Euler()
        .setFromQuaternion(new Quaternion().slerpQuaternions(prevRot, newRot, percent))
        .toArray()
      // handRotation = newRot.toArray()
      if (playing) req = requestAnimationFrame(step)
    })(tStart)
  }

  function updateHandMatrix(ev: CustomEvent<Matrix4>) {
    console.log('update matrix', new Vector3().setFromMatrixPosition(ev.detail))
    handMatrix = ev.detail
    if (pressedLetter) {
      const finger = fingersToKeys[pressedLetter]
      fit({
        [finger]: pos15(findKeyByAttr(conf, 'letter', pressedLetter)),
      })
    } else {
      theBigFit()
    }
  }

  const onFlip = (f) => {
    if (conf && jointsJSON) updateHandMatrix({ detail: handMatrix })
  }
  $: onFlip(flip)

  function debounce<T>(h: (e: T) => void) {
    let req = false
    return (e: T) => {
      if (req) return
      req = true
      requestAnimationFrame(() => {
        h(e)
        req = false
      })
    }
  }

  function readHands() {
    try {
      const json = localStorage.getItem('cosmosHands')
      return JSON.parse(json)[0]
    } catch (e) {
      return undefined
    }
  }

  let timer = 0
  function scanHand() {
    const win = window.open('https://ryanis.cool/cosmos/scan')
    timer = setInterval(() => {
      if (win.closed) {
        clearInterval(timer)
        jointsJSON = readHands()
      }
    }, 1000)
  }
  onDestroy(() => {
    cancelAnimationFrame(req)
    clearInterval(timer)
  })

  function selectParent() {
    if (selectedKey !== null) selectedKey = 0
  }

  function handleKeydown(event: KeyboardEvent) {
    switch (event.key) {
      case 'Escape':
      case 'q':
        selectedKey = null
        $transformMode = 'select'
        break
      case 'e':
      case 'r':
        if (selectedKey !== null) $transformMode = 'rotate'
        break
      case 'w':
      case 'g':
      case 't':
        if (selectedKey !== null) $transformMode = 'translate'
        break
      case 'p':
        selectParent()
        break
      case 'l':
        makeEncoder()
        break
      case 'b':
        makeTrackball()
        break
      case 'c':
        makeTrackpad()
        break
      case 'k':
        makeKey('horizontal')
        break
      case 'K':
        makeKey('vertical')
        break
    }
  }

  let selectedKey: number | null = null
  function raycasterClick(e) {
    if (e.detail == null) {
      // selectedKey = null
      // $transformMode = 'select'
      return
    }
    const firstKeyPos = conf.keys.length - cluster.customThumb.key.length
    if ($transformMode == 'select') $transformMode = 'translate'
    if (e.detail >= firstKeyPos) selectedKey = e.detail - firstKeyPos + 1
    else {
      selectedKey = null
      $transformMode = 'select'
    }
  }

  $: clickedKey.set(
    selectedKey > 0 && cluster && cluster.customThumb
      ? conf.keys.length - cluster.customThumb.key.length + selectedKey - 1
      : null
  )
  $: console.log('CLICKED', $clickedKey)

  function simpleMeshh(tris: Triangle[]) {
    const geo = new Float32Array(tris.length * 9)
    tris.forEach(({ a, b, c }, i) => {
      a.toArray(geo, i * 9)
      b.toArray(geo, i * 9 + 3)
      c.toArray(geo, i * 9 + 6)
    })
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(geo, 3))
    return geometry
  }

  function makeKey(direction = 'current') {
    if (selectedKey == null) {
      console.warn('No key selected')
      return
    }
    protoConfig.update((p) => {
      const position = decodeTuple(p.thumbCluster.customThumb.key[selectedKey - 1].position)
      if (position[3] != 0 || p.thumbCluster.customThumb.key[selectedKey - 1].id == 2) {
        const pos = encodeTuple([position[0], position[1], position[2]])
        p.thumbCluster.customThumb.key[selectedKey - 1].position = pos
      } else {
        const aspects = [1, 1.25, 1.5, 2, 1]
        const rot = decodeTuple(p.thumbCluster.customThumb.key[selectedKey - 1].rotation)
        const currentAspect = rot[3] < 0 ? -100 / rot[3] : rot[3] / 100
        console.log(currentAspect, rot[3])
        let newAspect = 100 * aspects[aspects.indexOf(closestAspect(currentAspect)) + 1]
        if (currentAspect < 1) newAspect = -newAspect

        if (direction == 'horizontal') newAspect = Math.abs(newAspect)
        if (direction == 'vertical') newAspect = -Math.abs(newAspect)
        const newRot = encodeTuple([rot[0], rot[1], rot[2], newAspect])
        p.thumbCluster.customThumb.key[selectedKey - 1].rotation = newRot
      }
      p.thumbCluster.customThumb.key[selectedKey - 1].trackballRadius = undefined
      p.thumbCluster.customThumb.key[selectedKey - 1].trackballSides = undefined
      return p
    })
  }

  function addKey() {
    protoConfig.update((p) => {
      if (!('customThumb' in p.thumbCluster)) throw new Error('Not custom')
      p.thumbCluster.customThumb.key.push({
        position: 0n,
        rotation: encodeTuple([0, 0, 0, 100]),
        trackballRadius: undefined as any,
        trackballSides: undefined as any,
      })
      selectedKey = p.thumbCluster.customThumb.key.length
      return p
    })
  }

  function deleteKey() {
    const theSelected = selectedKey
    if (theSelected == null) {
      console.warn('No key selected')
      return
    }
    selectedKey = null
    protoConfig.update((p) => {
      if (!('customThumb' in p.thumbCluster)) throw new Error('Not custom')
      const newKeys = [...p.thumbCluster.customThumb.key]
      newKeys.splice(theSelected - 1, 1)
      p.thumbCluster.customThumb.key = newKeys
      return p
    })
  }

  function makeEncoder() {
    if (selectedKey == null) {
      console.warn('No key selected')
      return
    }
    const position = decodeTuple(
      $protoConfig.thumbCluster.customThumb.key[selectedKey - 1].position
    )
    if (position[3] == 1) return
    protoConfig.update((p) => {
      const customType = 1
      p.thumbCluster.customThumb.key[selectedKey - 1].position = encodeTuple([
        position[0],
        position[1],
        position[2],
        customType,
      ])
      p.thumbCluster.customThumb.key[selectedKey - 1].trackballRadius = undefined
      p.thumbCluster.customThumb.key[selectedKey - 1].trackballSides = undefined
      return p
    })
  }

  function makeTrackball() {
    if (selectedKey == null) {
      console.warn('No key selected')
      return
    }
    const position = decodeTuple(
      $protoConfig.thumbCluster.customThumb.key[selectedKey - 1].position
    )
    protoConfig.update((p) => {
      const customType = 0
      p.thumbCluster.customThumb.key[selectedKey - 1].position = encodeTuple([
        position[0],
        position[1],
        position[2],
        customType,
      ])
      p.thumbCluster.customThumb.key[selectedKey - 1].trackballRadius = 209
      p.thumbCluster.customThumb.key[selectedKey - 1].trackballSides = 20
      return p
    })
  }

  function makeTrackpad() {
    if (selectedKey == null) {
      console.warn('No key selected')
      return
    }
    const position = decodeTuple(
      $protoConfig.thumbCluster.customThumb.key[selectedKey - 1].position
    )
    protoConfig.update((p) => {
      const customType = { 3: 4, 4: 5, 5: 3 }[position[3]] ?? 3
      p.thumbCluster.customThumb.key[selectedKey - 1].position = encodeTuple([
        position[0],
        position[1],
        position[2],
        customType,
      ])
      p.thumbCluster.customThumb.key[selectedKey - 1].trackballRadius = undefined
      p.thumbCluster.customThumb.key[selectedKey - 1].trackballSides = 20
      return p
    })
  }

  $: simpleMesh = simpleMeshh($simpleTris)

  $: reachabilityArr =
    conf && flags.hand && showHand && jointsJSON
      ? reachability(
          conf.keys,
          jointsJSON[whichHand],
          new Vector3().setFromMatrixPosition(handMatrix)
        )
      : undefined

  $: boardGeos =
    !error && conf?.microcontroller && geometry
      ? boardGeometries(conf, geometry)
      : Promise.resolve([])

  // $: matrices = conf ? allKeyCriticalPoints(conf, keyHolesTrsfs(conf, new Trsf())).flat().map(m => m.Matrix4()) : []
  // $: matrices = conf ? allWallCriticalPoints(conf, allKeyCriticalPoints(conf, keyHolesTrsfs(conf, new Trsf()))).map(m => m.ti.Matrix4()) : []
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="absolute top-10 left-0 right-0">
  {#if plane}
    <div class="flex flex-1 justify-around">
      <div class="flex justify-center">
        <button
          class="button"
          class:selected={$transformMode == 'select'}
          on:click|stopPropagation={() => transformMode.set('select')}
          ><Icon size="24px" path={mdi.mdiCursorDefaultOutline} />q</button
        >
        <button
          class="button"
          disabled={selectedKey == null}
          class:selected={$transformMode == 'translate'}
          on:click|stopPropagation={() => transformMode.set('translate')}
          ><Icon path={mdi.mdiCursorMove} size="24px" />w g</button
        >
        <button
          class="button"
          disabled={selectedKey == null}
          class:selected={$transformMode == 'rotate'}
          on:click|stopPropagation={() => transformMode.set('rotate')}
          ><Icon path={mdi.mdiOrbitVariant} size="24px" />e r</button
        >
        <button
          class="button"
          disabled={selectedKey == null}
          on:click|stopPropagation={() => selectParent()}
          ><Icon size="24px" path={mdi.mdiArrowUpBoldHexagonOutline} />p</button
        >
        <button class="button" on:click|stopPropagation={addKey}>Add</button>
        <button class="button" disabled={selectedKey == null} on:click|stopPropagation={deleteKey}
          >Delete</button
        >
      </div>
      {#if flags.hand && showHand}
        <div class="flex">
          <button on:click={scanHand}>Scan Hand</button>
          {#if jointsJSON}
            <button on:click={() => toggleplay(sentence)}>Simulate</button>
          {/if}
        </div>
      {/if}
    </div>
    {#if selectedKey}
      <div class="flex flex-1 justify-around">
        <div class="flex">
          <button
            class="button"
            class:selected={'keycap' in
              conf.keys[conf.keys.length - cluster.customThumb.key.length + selectedKey - 1]}
            on:click|stopPropagation={() => makeKey()}
            ><Icon size="24px" name="keycap" />Key/Aspect (k/K)</button
          >
          <button
            class="button"
            class:selected={conf.keys[
              conf.keys.length - cluster.customThumb.key.length + selectedKey - 1
            ].type == 'ec11'}
            on:click|stopPropagation={() => makeEncoder()}
            ><Icon size="24px" name="knob" />Encoder (l)</button
          >
          <button
            class="button"
            class:selected={conf.keys[
              conf.keys.length - cluster.customThumb.key.length + selectedKey - 1
            ].type == 'trackball'}
            on:click|stopPropagation={() => makeTrackball()}
            ><Icon size="24px" name="knob" />Trackball (b)</button
          >
          <button
            class="button"
            class:selected={conf.keys[
              conf.keys.length - cluster.customThumb.key.length + selectedKey - 1
            ].type.startsWith('cirque')}
            on:click|stopPropagation={() => makeTrackpad()}
            ><Icon size="24px" name="knob" />Trackpad (c)</button
          >
        </div>
      </div>
    {/if}
  {:else if flags.hand && showHand}
    <div class="flex justify-center">
      <button on:click={scanHand}>Scan Hand</button>
      {#if jointsJSON}
        <button on:click={() => toggleplay(sentence)}>Simulate</button>
      {/if}
    </div>
  {/if}
</div>
{#if flip && jointsJSON && flags.hand && showHand}
  <div class="absolute top-20 left-8 right-8 text-center">
    Sorry the left hand is not fitting properly for the time being.
  </div>
{/if}
<Viewer
  geometries={[]}
  {style}
  {center}
  {size}
  {cameraPosition}
  {flip}
  {enableRotate}
  {enableZoom}
  enablePan={true}
  {is3D}
  on:start={() => (raycast = false)}
  on:end={() => (raycast = true)}
>
  <svelte:fragment slot="geometry">
    {#if conf && flags.hand && showHand && jointsJSON}
      <SC.Group position={handPosition} rotation={handRotation} scale={[1, flip ? -1 : 1, 1]}>
        <HandModel reverse={!flip} hand={theHand} />
      </SC.Group>
      <!-- <AxesHelper size={100} matrix={debug} /> -->
    {/if}
    <SC.Group position={[-center[0], -center[1], -center[2]]}>
      {#if flags.intersection && conf}
        {#each $simplekeyGeo as g}
          <SC.Mesh geometry={g} material={new KeyMaterial(1, 1, 'red')} />
        {/each}
        {#each componentBoxes(conf, geometry) as box}
          <SC.Mesh geometry={componentGeometry(box)} material={new KeyMaterial(1, 1, 'red')} />
        {/each}
        <SC.Mesh geometry={simpleMesh} material={new MeshBasicMaterial({ color: 0xff0000 })} />
      {/if}
      <Raycaster on:click={raycasterClick} enabled={!!plane && raycast}>
        <Keyboard
          config={conf}
          {transparency}
          {pressedLetter}
          {customThumbConfig}
          translation={zPos}
          {flip}
          reachability={reachabilityArr}
          {error}
        />
      </Raycaster>
      {#await boardGeos then boards}
        {#each boards as board}
          <KeyboardMesh kind="key" geometry={board} visible={!showSupports} />
        {/each}
      {/await}
      <slot />
    </SC.Group>
  </svelte:fragment>
  <svelte:fragment slot="controls">
    {#if !isExpert && planeMatrix && $transformMode !== 'select'}
      {#each [planeMatrix, ...keyMatrices] as tr, i}
        {#if selectedKey === i}
          <TransformControls
            {flip}
            transformation={tr.matrix}
            plane={tr.plane}
            {center}
            on:change={(e) => onTransform(i, e.detail)}
            on:move={debounce((e) => onMove(i, e.detail))}
          />
        {/if}
      {/each}
    {/if}
    {#if flags.hand && showHand && jointsJSON}
      <TransformControls
        fixed
        {flip}
        transformation={handMatrix}
        plane="minimal"
        center={[0, 0, 0]}
        on:move={debounce(updateHandMatrix)}
      />
    {/if}
  </svelte:fragment>
</Viewer>

<style>
  button.selected {
    --at-apply: 'bg-gray-400 dark:bg-gray-700';
  }
  button {
    z-index: 10;
    --at-apply: 'bg-gray-200 dark:bg-gray-900 p-1 pr-2 m-1 rounded text-gray-800 dark:text-gray-200 flex gap-2';
  }
  button:not(:disabled) {
    --at-apply: 'hover:bg-gray-400 dark:hover:bg-gray-700';
  }
  button:disabled {
    --at-apply: 'opacity-40';
  }
</style>

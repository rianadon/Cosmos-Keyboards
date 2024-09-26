<script lang="ts">
  import { onDestroy } from 'svelte'
  import { Euler, Matrix4, Quaternion, Vector3 } from 'three'
  import {
    type Cuttleform,
    type CuttleKey,
    findKeyByAttr,
    decodeTuple,
    encodeTuple,
    tupleToXYZ,
    type Center,
  } from '$lib/worker/config'
  import Trsf from '$lib/worker/modeling/transformation'
  import {
    debugViewport,
    protoConfig,
    transformMode,
    clickedKey,
    selectMode,
    tempConfig,
    hoveredKey,
    showKeyInts,
    view,
    type TempConfig,
    showGizmo,
    enableUndo,
    showGrid,
  } from '$lib/store'
  import HandModel from '$lib/3d/HandModel.svelte'
  import { FINGERS, type Joints, SolvedHand } from '../hand'
  import { refine } from '../handoptim'
  import Keyboard from '$lib/3d/Keyboard.svelte'
  import AddButton from '$lib/3d/AddButton.svelte'
  import * as flags from '$lib/flags'
  import TransformControls from '$lib/3d/TransformControls.svelte'
  import { ContactShadows, TransformControls as TTransformControls } from '@threlte/extras'
  import ETrsf, { keyPosition, keyPositionTop } from '$lib/worker/modeling/transformation-ext'
  import { keyInfo } from '$lib/geometry/keycaps'
  import { switchInfo } from '$lib/geometry/switches'
  import { KeyMaterial } from '$lib/3d/materials'
  import { componentBoxes, componentGeometry } from '$lib/worker/geometry'
  import * as mdi from '@mdi/js'
  import Icon from '$lib/presentation/Icon.svelte'
  import { diff, notNull, objEntriesNotNull, objKeys } from '$lib/worker/util'
  import { readHands, type HandData } from '$lib/handhelpers'
  import { simpleSocketGeos } from '$lib/loaders/simpleparts'
  import GroupMatrix from '$lib/3d/GroupMatrix.svelte'
  import { simpleKeyGeo, simpleKeyPosition } from '$lib/loaders/simplekeys'
  import { T } from '@threlte/core'
  import Gizmo from '$lib/3d/ThrelteGizmo.svelte'
  import NewViewer from './Viewer.svelte'
  import {
    indexOfKey,
    nthKey,
    nthPartType,
    toPosRotation,
    type CosmosCluster,
    type CosmosKey,
    nthProfile,
    fromCosmosConfig,
    nthPartAspect,
    nthCurvature,
    isNthFirstColumn,
    isNthLastColumn,
    type CosmosKeyboard,
    nthPartVariant,
    ROUND_PARTS,
    clusterName,
    cosmosKeyPosition,
    rotationPositionETrsf,
    nthSplay,
    calculateSplay,
    PARTS_WITH_KEYCAPS,
  } from '$lib/worker/config.cosmos'
  import { PART, PROFILE } from '../../../../../target/cosmosStructs'
  import {
    addColumnInPlace,
    addKeyInPlace,
    adjacentPositions,
    formatHoming,
    keyProp,
    formatProfile,
    transformationCenter,
    profileName,
    sortProfiles,
    type FullGeometry,
    kbdOffset,
    flipMatrixX,
    shouldFlipKey,
  } from './viewer3dHelpers'
  import Field from '$lib/presentation/Field.svelte'
  import DecimalInput from '../editor/DecimalInput.svelte'
  import Select from '$lib/presentation/Select.svelte'
  import { TupleStore } from '../editor/tuple'
  import DecimalInputInherit from '../editor/DecimalInputInherit.svelte'
  import SelectInherit from '$lib/presentation/SelectInherit.svelte'
  import { encodeVariant, PART_INFO, sortedCategories } from '$lib/geometry/socketsParts'
  import AngleInput from '../editor/AngleInput.svelte'
  import AngleInputInherit from '../editor/AngleInputInherit.svelte'
  import { browser } from '$app/environment'
  import KeyboardMaterial from '$lib/3d/KeyboardMaterial.svelte'

  export let darkMode: boolean
  export let showSupports = false
  export let style: string = ''
  export let center: Center
  export let size: [number, number, number]
  export let cameraPosition: [number, number, number] = [0.16, -0.96, 0.56]
  export let enableRotate = true
  export let enableZoom = false
  export let isExpert: boolean
  export let transparency: number
  export let showHand = true
  export let showFit: boolean
  export let geometry: FullGeometry
  export let progress = 1

  $: flip = $view == 'left'

  export let conf: Cuttleform | undefined
  let fitConf: Cuttleform | undefined

  function copyCanvas() {
    document.querySelector('canvas')!.toBlob(function (blob) {
      const item = new ClipboardItem({ 'image/png': blob! })
      navigator.clipboard.write([item]).then(console.log, console.error)
    })
  }

  $: if ($debugViewport) {
    const origFn = HTMLCanvasElement.prototype.getContext
    // @ts-ignore
    HTMLCanvasElement.prototype.getContext = function (type, attributes) {
      if (type === 'webgl' || type === 'webgl2') {
        attributes = Object.assign({}, attributes, {
          preserveDrawingBuffer: true,
        })
      }
      return origFn.call(this, type, attributes)
    }
  }

  function removeKey() {
    protoConfig.update((proto) => {
      const { key, column, cluster } = nthKey(proto, $clickedKey!)
      if ($selectMode == 'key') column.keys.splice(column.keys.indexOf(key), 1)
      // If there are no keys left in the column, delete the column too
      if ($selectMode == 'column' || column.keys.length == 0)
        cluster.clusters.splice(cluster.clusters.indexOf(column), 1)
      return proto
    })
    $clickedKey = null
  }

  function addKey(dx: number, dy: number) {
    protoConfig.update((proto) => {
      let newKey: CosmosKey | undefined = undefined
      if ($selectMode == 'key') newKey = addKeyInPlace(proto, $clickedKey!, dx, dy)
      if ($selectMode == 'column') newKey = addColumnInPlace(proto, $clickedKey!, dx)
      if (newKey) clickedKey.set(indexOfKey(proto, newKey))
      return proto
    })
  }

  function changeKey(e: Event) {
    protoConfig.update((proto) => {
      const newType: any = (e.target as HTMLInputElement).value
      const { key, column } = nthKey(proto, $clickedKey!)
      if ($selectMode == 'key') {
        key.partType.type = newType
        key.partType.variant = key.sizeA = key.sizeB = undefined
      }
      if ($selectMode == 'column') {
        column.partType.type = newType
        column.partType.variant = undefined
      }
      return proto
    })
  }
  function changeKeyAspect(e: Event) {
    protoConfig.update((proto) => {
      const oldAspect = nthPartAspect(proto, $clickedKey!, 'key')
      const newAspect = Number((e.target as HTMLInputElement).value)
      const newKey = diff(newAspect, nthPartAspect(proto, $clickedKey!, 'column'))
      const newColumn = diff(newAspect, nthPartAspect(proto, $clickedKey!, 'cluster'))
      let colOffset = 0
      // If the column is both first and last, these 2 cancel out so colOffset = 0
      if (isNthFirstColumn(proto, $clickedKey!)) colOffset += (oldAspect - newAspect) / 2
      if (isNthLastColumn(proto, $clickedKey!)) colOffset += (newAspect - oldAspect) / 2
      const { key, column } = nthKey(proto, $clickedKey!)
      if ($selectMode == 'key') {
        key.partType.aspect = newKey
        key.column! = (key.column ?? column.column!) + colOffset
      }
      if ($selectMode == 'column') {
        column.partType.aspect = newColumn
        column.column! += colOffset
      }
      return proto
    })
  }
  function changeKeyVariant(e: Event, elem: string) {
    const newValue = (e.target as HTMLInputElement).value
    protoConfig.update((proto) => {
      const oldVariant = nthPartVariant(proto, $clickedKey)
      const type = nthPartType(proto, $clickedKey, 'key')
      oldVariant[elem] = newValue
      const { key } = nthKey(proto, $clickedKey!)
      key.partType.variant = encodeVariant(type, oldVariant)
      return proto
    })
  }
  function onMove(obj: Matrix4, change: boolean) {
    ;(change ? protoConfig : tempConfig).update((proto) => {
      const oldPosition = transformationCenter($clickedKey!, proto, $selectMode, true)
      obj.premultiply(oldPosition.evaluate({ flat: false }, new Trsf()).Matrix4().invert())
      const { position, rotation } = toPosRotation(obj)

      const { key, column, cluster } = nthKey(proto, $clickedKey!)
      const update = (k: CosmosKey | CosmosCluster) => {
        k.position = position
        k.rotation = rotation
      }
      if ($selectMode == 'key') update(key)
      if ($selectMode == 'column') update(column)
      if ($selectMode == 'cluster') update(cluster)
      ;(proto as TempConfig).fromProto = false
      return proto
    })
  }

  function updateTuple(elem: 'position' | 'rotation', t: bigint, mode: 'key' | 'column' | 'cluster') {
    if ($clickedKey == null || t < 0) return
    const key = nthKey($protoConfig, $clickedKey!)[mode]
    if (t == (key[elem] || 0n)) return
    protoConfig.update((proto) => {
      key[elem] = t
      return proto
    })
  }

  function setFingerSplay(e: CustomEvent) {
    const splay = Number(e.detail)
    protoConfig.update((proto) => {
      const { column, cluster } = nthKey(proto, $clickedKey!)
      const prevSplay = calculateSplay(column, cluster)
      const prevColumnIndex = cluster.clusters.indexOf(column) - 1

      const clusterTrsfInv =
        rotationPositionETrsf(cluster)?.evaluate({ flat: false }).invert() || new Trsf()

      const columnCenter = cosmosKeyPosition({ row: 0 } as any, column, cluster, proto)
        .evaluate({ flat: false })
        .premultiply(clusterTrsfInv)
        .origin()

      let topKeyTop = columnCenter
      let botKeyBot = columnCenter
      if (prevColumnIndex >= 0) {
        // Pose of each key in the column
        const keyPositions = column.keys.map((k) =>
          cosmosKeyPosition(k, cluster.clusters[prevColumnIndex], cluster, proto)
            .evaluate({ flat: false })
            .premultiply(clusterTrsfInv)
        )
        keyPositions.sort((a, b) => a.origin().y - b.origin().y)
        const mul = cluster.side == 'left' ? -1 : 1
        topKeyTop = keyPositions[keyPositions.length - 1].pretranslate(mul * 9.75, 9.75, 0).origin()
        botKeyBot = keyPositions[0].pretranslate(mul * 9.75, -9.75, 0).origin()
      }
      for (let colInd = prevColumnIndex + 1; colInd < cluster.clusters.length; colInd++) {
        const column = cluster.clusters[colInd]
        let [tx, ty, tz] = decodeTuple(column.position || 0n)
        let [irx, iry, irz] = decodeTuple(column.rotation || 0n)
        // Position of the center of the column
        const colPt = cosmosKeyPosition({ row: 0 } as any, column, cluster, proto)
          .evaluate({ flat: false })
          .premultiply(clusterTrsfInv)
          .origin()

        function applySplay(dA: number, abt: Vector3) {
          const rad = dA * (Math.PI / 180) * (cluster.side == 'left' ? 1 : -1)
          const newX = (colPt.x - abt.x) * Math.cos(rad) - (colPt.y - abt.y) * Math.sin(rad) + abt.x
          const newY = (colPt.x - abt.x) * Math.sin(rad) + (colPt.y - abt.y) * Math.cos(rad) + abt.y
          tx += 10 * (newX - colPt.x)
          ty += 10 * (newY - colPt.y)
        }

        applySplay(-prevSplay, prevSplay < 0 ? topKeyTop : botKeyBot) // Undo the current splay
        applySplay(splay, splay < 0 ? topKeyTop : botKeyBot) // Apply the current splay
        irz += (cluster.side == 'left' ? -1 : 1) * Math.round((prevSplay - splay) * 45) // Adjust this column's rotation
        column.position = encodeTuple([Math.round(tx), Math.round(ty), tz])
        column.rotation = encodeTuple([irx, iry, irz])
      }
      return proto
    })
  }

  function updateProto() {
    protoConfig.update((p) => p)
  }

  const initialLength = browser ? window.history.length : 0
  function handleKeydown(event: KeyboardEvent) {
    if (document.activeElement != document.body) return
    const isMac = navigator.platform.toLowerCase().includes('mac')
    const isCtrl = event.ctrlKey == !isMac && event.metaKey == isMac
    if (isCtrl && !event.altKey && (event.key == 'z' || event.key == 'y')) {
      if ($enableUndo) {
        if ((event.key == 'z' && event.shiftKey) || (event.key == 'y' && !event.shiftKey))
          window.history.forward()
        else if (event.key == 'z') window.history.back()
      } else if (
        confirm(
          "The undo/redo shortcuts are disabled by default because they simply navigate through browser history. Undo too many times, and you'll find your way back to the new tab page. Do you promise to be careful and wish to enable undo/redo?"
        )
      ) {
        $enableUndo = true
      }
    }
    if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return
    if (event.key == 'Escape') $clickedKey = null
    else if (event.key == 'q') $transformMode = 'select'
    else if (event.key == 'e' || event.key == 'r') $transformMode = 'rotate'
    else if (event.key == 'w' || event.key == 'g') $transformMode = 'translate'
    else if (event.key == 'k') $selectMode = 'key'
    else if (event.key == 'l') $selectMode = 'column'
    else if (event.key == 'o') $selectMode = 'cluster'
    else if (event.key == 'Delete') removeKey()
  }

  function getClickedSide(
    config: CosmosKeyboard,
    n: number | null
  ): 'unibody' | 'right' | 'left' | null {
    if (config?.unibody) return 'unibody'
    if (n == null) return null
    return nthKey(config, n).cluster.side
  }

  $: clickedSide = getClickedSide($protoConfig, $clickedKey)

  function kbdOffsetClicked(config: CosmosKeyboard, n: number | null) {
    if (n == null) return false
    return kbdOffset(config.unibody ? 'unibody' : nthKey(config, n).cluster.side)
  }

  let popoutShown = false
  let pressedLetter: string | null = null
  let reachabilityArr = undefined

  const positionStore = new TupleStore(-1n)
  const [positionX, positionY, positionZ, _] = positionStore.components()
  positionStore.tuple.subscribe((t) => updateTuple('position', t, 'key'))
  $: if ($clickedKey != null) positionStore.update(nthKey($tempConfig, $clickedKey).key.position || 0n)

  const rotationStore = new TupleStore(-1n, 45)
  const [rotationX, rotationY, rotationZ, __] = rotationStore.components()
  rotationStore.tuple.subscribe((t) => updateTuple('rotation', t, 'key'))
  $: if ($clickedKey != null) rotationStore.update(nthKey($tempConfig, $clickedKey).key.rotation || 0n)

  const cpositionStore = new TupleStore(-1n)
  const [cpositionX, cpositionY, cpositionZ, _3] = cpositionStore.components()
  cpositionStore.tuple.subscribe((t) => updateTuple('position', t, 'column'))
  $: if ($clickedKey != null)
    cpositionStore.update(nthKey($tempConfig, $clickedKey).column.position || 0n)

  const crotationStore = new TupleStore(-1n, 45)
  const [crotationX, crotationY, crotationZ, _4] = crotationStore.components()
  crotationStore.tuple.subscribe((t) => updateTuple('rotation', t, 'column'))
  $: if ($clickedKey != null)
    crotationStore.update(nthKey($tempConfig, $clickedKey).column.rotation || 0n)

  const lpositionStore = new TupleStore(-1n)
  const [lpositionX, lpositionY, lpositionZ, _5] = lpositionStore.components()
  lpositionStore.tuple.subscribe((t) => updateTuple('position', t, 'cluster'))
  $: if ($clickedKey != null)
    lpositionStore.update(nthKey($tempConfig, $clickedKey).cluster.position || 0n)

  const lrotationStore = new TupleStore(-1n, 45)
  const [lrotationX, lrotationY, lrotationZ, _6] = lrotationStore.components()
  lrotationStore.tuple.subscribe((t) => updateTuple('rotation', t, 'cluster'))
  $: if ($clickedKey != null)
    lrotationStore.update(nthKey($tempConfig, $clickedKey).cluster.rotation || 0n)

  $: floorZ = $showGrid ? (geometry.right || geometry.unibody)?.floorZ ?? 0 : 0
  $: keyIsClicked = $clickedKey == null ? null : nthKey($protoConfig, $clickedKey).key
  $: columnIsClicked = $clickedKey == null ? null : nthKey($protoConfig, $clickedKey).column
  $: clusterIsClicked = $clickedKey == null ? null : nthKey($protoConfig, $clickedKey).cluster
  $: keyIsHovered = $hoveredKey == null ? null : nthKey($protoConfig, $hoveredKey).key
  $: columnIsHovered = $hoveredKey == null ? null : nthKey($protoConfig, $hoveredKey).column
  $: clusterIsHovered = $hoveredKey == null ? null : nthKey($protoConfig, $hoveredKey).cluster
  $: hoveredPosition = keyIsHovered == null ? null : decodeTuple(keyIsHovered.position || 0n)
  $: hoveredCPosition = columnIsHovered == null ? null : decodeTuple(columnIsHovered.position || 0n)
  $: hoveredLPosition = clusterIsHovered == null ? null : decodeTuple(clusterIsHovered.position || 0n)
  $: hoveredRotation = keyIsHovered == null ? null : decodeTuple(keyIsHovered.rotation || 0n)
  $: hoveredCRotation = columnIsHovered == null ? null : decodeTuple(columnIsHovered.rotation || 0n)
  $: hoveredLRotation = clusterIsHovered == null ? null : decodeTuple(clusterIsHovered.rotation || 0n)

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

  function reachability(conf: Cuttleform, joints: Joints[], origin: Vector3) {
    const keys = conf.keys
    return keys.map((k) => {
      const finger = 'keycap' in k && k.keycap.letter ? fingersToKeys[k.keycap.letter] : 'thumb'
      const reach = joints[finger || 'thumb'].reduce((a, j) => a + j.length, 0) * 1000
      const distance = pos15(conf, k).distanceTo(origin)
      return distance <= reach
    })
  }

  let jointsJSON: HandData | undefined = readHands()
  $: whichHand = flip ? 'left' : 'right'

  let theHand = jointsJSON ? new SolvedHand(jointsJSON[whichHand], new Matrix4()) : undefined

  $: rightHandMatrix = $protoConfig
    ? new Matrix4().makeTranslation(...tupleToXYZ($protoConfig.wristRestPosition))
    : conf?.wristRestOrigin
    ? new ETrsf(conf.wristRestOrigin.history).evaluate({ flat: false }).Matrix4()
    : new Matrix4()

  $: leftHandMatrix = $protoConfig
    ? new Matrix4().makeTranslation(
        ...(tupleToXYZ($protoConfig.wristRestPosition).map((x, i) => (i == 0 ? -x : x)) as [
          number,
          number,
          number
        ])
      )
    : conf?.wristRestOrigin
    ? new ETrsf(conf.wristRestOrigin.history).mirrored([1, 0, 0]).evaluate({ flat: false }).Matrix4()
    : new Matrix4()

  let debug = new Matrix4()

  function fit(targets: Record<string, Vector3 | undefined>) {
    const tg = Object.fromEntries(
      Object.entries(targets)
        .filter(([k, v]) => !!v)
        .map(([k, v]) => (flip ? [k, new Vector3(-v.x, v.y, v.z)] : [k, v]))
    )
    const ik = Object.fromEntries(
      FINGERS.map((f) => [f, [new Vector3(), new Vector3(), new Vector3(), new Vector3()]])
    )
    let handMatrix = flip ? leftHandMatrix : rightHandMatrix
    const position = new Vector3().setFromMatrixPosition(handMatrix)
    handMatrix = new Matrix4()
      .makeRotationFromEuler(flip ? new Euler(0, Math.PI / 2, Math.PI) : new Euler(0, -Math.PI / 2, 0))
      .setPosition(position)
    const { m, Vt } = refine(handMatrix, jointsJSON[whichHand], tg)
    handMatrix = m
    debug = new Matrix4().multiplyMatrices(handMatrix, new Matrix4().copy(Vt))
    theHand = new SolvedHand(jointsJSON[whichHand], handMatrix)
    for (const [finger, position] of Object.entries(tg)) {
      ik[finger] = theHand.ik(finger, position, 1000)
    }
    if (flip) {
      leftHandMatrix = handMatrix
      leftHandRotation = new Euler().setFromRotationMatrix(handMatrix).toArray() as any
      leftHandPosition = new Vector3().setFromMatrixPosition(handMatrix).toArray()
    } else {
      rightHandMatrix = handMatrix
      rightHandRotation = new Euler().setFromRotationMatrix(handMatrix).toArray() as any
      rightHandPosition = new Vector3().setFromMatrixPosition(handMatrix).toArray()
    }
    return ik
  }

  const keyDepth = (k: CuttleKey) => keyInfo(k).depth

  const HAND_RADIUS = 2

  const pos = (c: Cuttleform, k: CuttleKey | undefined) =>
    k ? keyPositionTop(c, k, false).pretranslated(0, 0, HAND_RADIUS).origin() : undefined
  const pos15 = (c: Cuttleform, k: CuttleKey | undefined) =>
    k
      ? keyPositionTop(c, k, false)
          .pretranslated(
            0,
            0,
            -switchInfo(k.type).height + switchInfo(k.type).pressedHeight + HAND_RADIUS
          )
          .origin()
      : undefined
  function theBigFit(conf: Cuttleform) {
    console.log('FITTING', conf)
    return fit({
      indexFinger: pos(conf, findKeyByAttr(conf, 'home', 'index')),
      middleFinger: pos(conf, findKeyByAttr(conf, 'home', 'middle')),
      ringFinger: pos(conf, findKeyByAttr(conf, 'home', 'ring')),
      pinky: pos(conf, findKeyByAttr(conf, 'home', 'pinky')),
      thumb: pos(conf, findKeyByAttr(conf, 'home', 'thumb')),
    })
  }
  $: if (conf) fitConf = conf
  $: if ($tempConfig) fitConf = fromCosmosConfig($tempConfig).right
  $: if (fitConf && jointsJSON) theBigFit(fitConf)

  let leftHandRotation: [number, number, number] = [0, 0, 0]
  let rightHandRotation: [number, number, number] = [0, 0, 0]
  let leftHandPosition: [number, number, number] = [0, 0, 0]
  let rightHandPosition: [number, number, number] = [0, 0, 0]

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
  function play(sentence: string, beginning?: Record<string, Vector3[]>, index = 0) {
    if (index > sentence.length) {
      playing = false
      return
    }
    if (!beginning) beginning = theBigFit(fitConf)

    const prevRot = new Quaternion().setFromEuler(new Euler().fromArray(rightHandRotation))
    const prevPos = new Vector3().fromArray(rightHandPosition)
    let targets
    if (index >= sentence.length) {
      targets = theBigFit(fitConf)
    } else {
      const letter = sentence[index]
      const finger = fingersToKeys[letter]
      targets = fit({
        [finger]: pos15(conf, findKeyByAttr(conf, 'letter', letter)),
      })
      console.log('letter', pressedLetter)
    }
    const newRot = new Quaternion().setFromEuler(new Euler().fromArray(rightHandRotation))
    const newPos = new Vector3().fromArray(rightHandPosition)

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
          const ti = keyPosition(conf, key, false).invert().Matrix4()
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
      rightHandPosition = new Vector3()
        .subVectors(newPos, prevPos)
        .multiplyScalar(percent)
        .add(prevPos)
        .toArray()
      rightHandRotation = new Euler()
        .setFromQuaternion(new Quaternion().slerpQuaternions(prevRot, newRot, percent))
        .toArray() as any
      // handRotation = newRot.toArray()
      if (playing) req = requestAnimationFrame(step)
    })(tStart)
  }

  function updateHandMatrix(rightMat: Matrix4) {
    console.log('update matrix', new Vector3().setFromMatrixPosition(rightMat))
    rightHandMatrix = rightMat
    if (pressedLetter) {
      const finger = fingersToKeys[pressedLetter]
      fit({
        [finger]: pos15(conf, findKeyByAttr(conf, 'letter', pressedLetter)),
      })
    } else {
      theBigFit(fitConf)
    }
  }

  function updateWristRest(mat: Matrix4) {
    const wrOrigin = new Vector3().setFromMatrixPosition(mat).toArray()
    if ($protoConfig)
      $protoConfig.wristRestPosition = encodeTuple(wrOrigin.map((w) => Math.round(w * 10)))
  }

  function setLetter(e: Event) {
    if (!keyIsClicked) return
    protoConfig.update((p) => {
      keyIsClicked.profile.letter = (e.target as HTMLInputElement).value
      return p
    })
  }

  function changeCType(cluster: CosmosCluster | undefined) {
    if (!cluster) return
    protoConfig.update((p) => {
      if (cluster.type == 'matrix') cluster.type = 'sphere'
      else cluster.type = 'matrix'

      cluster.clusters.forEach((c) => (c.type = cluster.type))
      return p
    })
  }

  const onFlip = (f) => {
    if (fitConf && jointsJSON) updateHandMatrix(rightHandMatrix)
  }
  $: onFlip(flip)

  let timer = 0
  function scanHand() {
    const win = window.open('scan2')
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

  $: reachabilityArr =
    conf && flags.hand && showHand && jointsJSON
      ? reachability(conf, jointsJSON[whichHand], new Vector3().setFromMatrixPosition(rightHandMatrix))
      : undefined

  $: columnType = columnIsClicked?.type
  $: clusterType = clusterIsClicked?.type
  $: sphereColumn = (columnIsClicked || columnIsHovered)?.type == 'sphere'
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="absolute top-10 left-0 right-0">
  {#if flags.hand && showHand}
    <div class="flex justify-center gap-2">
      <button class="button" on:click={scanHand}>Scan Hand</button>
      {#if jointsJSON}
        {#if !isExpert}
          <button
            on:click={() => (showFit = true)}
            class="button bg-gradient-to-r! from-pink-300 to-orange-300 dark:from-pink-800 dark:to-orange-800"
          >
            Fit to Hand
          </button>
        {/if}
        <button class="button" on:click={() => toggleplay(sentence)}>Simulate</button>
      {/if}
    </div>
  {/if}
  {#if $clickedKey !== null}
    <div class="flex flex-1 justify-around">
      <div
        class="flex justify-center bg-[#EFE8FF] dark:bg-gray-900 rounded-5 pl-1 pr-2 gap-0.5 z-100 items-center mt-2 overflow-hidden"
      >
        {#if $selectMode == 'cluster'}
          <div class="line-height-8 px-8 capitalize">{clusterName(clusterIsClicked)} Cluster</div>
        {:else}
          <div class="relative">
            <div
              class="pointer-events-none absolute inset-y-0 left-0 flex items-center px-4 text-gray-700 dark:text-gray-100"
            >
              <Icon size="20px" name="keycap" />
            </div>
            <select
              class="appearance-none bg-[#EFE8FF] dark:bg-gray-900 w-88 pl-20 h-8 pl-11!"
              class:w-64!={PART_INFO[nthPartType($protoConfig, $clickedKey, $selectMode)].partName
                .length < 20}
              on:change={changeKey}
              value={nthPartType($protoConfig, $clickedKey, $selectMode)}
            >
              {#each sortedCategories as cat}
                <optgroup label={cat}>
                  {#each notNull(objKeys(PART_INFO)).filter((v) => PART_INFO[v].category == cat) as part}
                    <option value={part}>{PART_INFO[part].partName}</option>
                  {/each}
                </optgroup>
              {/each}
            </select>
            <div
              class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-700 dark:text-gray-100"
            >
              <Icon path={mdi.mdiChevronDown} size="20px" />
            </div>
          </div>
        {/if}
        {#if ($selectMode == 'key' && PART_INFO[nthPartType($protoConfig, $clickedKey, 'key')].keycap) || $selectMode == 'column'}
          <div class="relative">
            <select
              class="appearance-none bg-purple-200 dark:bg-pink-900/80 w-22 h-8 px-2"
              on:change={changeKeyAspect}
              value={nthPartAspect($protoConfig, $clickedKey, $selectMode)}
            >
              {#each [1, 1.25, 1.5, 1.75, 2] as part}
                <option value={part}>{part}u</option>
              {/each}
            </select>
            <div
              class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-700 dark:text-gray-100"
            >
              <Icon path={mdi.mdiChevronDown} size="20px" />
            </div>
          </div>
        {/if}
        {#if $selectMode == 'key'}
          {@const info = PART_INFO[nthPartType($protoConfig, $clickedKey, 'key')]}
          {#each Object.entries('variants' in info ? info.variants : {}) as [key, opt]}
            <div class="relative">
              <select
                class="appearance-none bg-purple-200 dark:bg-pink-900/80 w-24 h-8 px-2"
                class:w-34!={key == 'sensor'}
                value={nthPartVariant($protoConfig, $clickedKey)[key]}
                on:change={(ev) => changeKeyVariant(ev, key)}
              >
                {#each opt as part}
                  <option value={part}>{part}</option>
                {/each}
              </select>
              <div
                class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-700 dark:text-gray-100"
              >
                <Icon path={mdi.mdiChevronDown} size="20px" />
              </div>
            </div>
          {/each}
        {/if}
        {#if $selectMode != 'cluster'}
          <button class="sidebutton" title="Remove" on:click|stopPropagation={removeKey}>
            <Icon size="20px" path={mdi.mdiDelete} />
          </button>
        {/if}
      </div>
    </div>
  {/if}
  {#if flip && jointsJSON && flags.hand && showHand}
    <div class=" text-white m-4 rounded p-4 bg-yellow-700 flex">
      Sorry the left hand is not fitting properly for the time being.
    </div>
  {/if}
  {#if progress != 1}
    <div
      class="mx-auto mt-4 bg-slate-100 dark:bg-slate-700 py-2 w-48 text-center rounded z-1 relative flex items-center gap-4 px-4"
    >
      <Icon path={mdi.mdiLoading} class="animate-spin" />
      Generating: {Math.round(progress * 100)}%
    </div>
  {/if}
</div>

{#if !isExpert}
  <div class="absolute top-10 bottom-10 right-0 flex flex-col justify-center select-none">
    <div class="relative flex flex-col gap-2 h-87">
      <div
        class="bigmenu bg-[#EFE8FF] dark:bg-slate-900 flex flex-col rounded-5 relative z-1 p-0.5 gap-0.5"
      >
        <button
          class="sidebutton"
          class:selected={$transformMode == 'select'}
          on:click|stopPropagation={() => transformMode.set('select')}
          ><Icon size="20px" path={mdi.mdiCursorDefaultOutline} />
        </button>
        <button
          class="sidebutton"
          class:selected={$transformMode == 'translate'}
          on:click|stopPropagation={() => transformMode.set('translate')}
          ><Icon path={mdi.mdiCursorMove} size="20px" />
        </button>
        <button
          class="sidebutton"
          class:selected={$transformMode == 'rotate'}
          on:click|stopPropagation={() => transformMode.set('rotate')}
          ><Icon path={mdi.mdiRotateOrbit} size="20px" />
        </button>
        <div class="my-2 h-[1px] bg-white dark:bg-slate-700" />

        <button
          class="sidebutton"
          class:selected={$selectMode == 'key'}
          on:click|stopPropagation={() => selectMode.set('key')}
          ><Icon size="20px" name="keycap" />
        </button>
        <button
          class="sidebutton"
          class:selected={$selectMode == 'column'}
          on:click|stopPropagation={() => selectMode.set('column')}
          ><Icon name="column" size="20px" />
        </button>
        <button
          class="sidebutton"
          class:selected={$selectMode == 'cluster'}
          on:click|stopPropagation={() => selectMode.set('cluster')}
          ><Icon path={mdi.mdiGrid} size="20px" />
        </button>
      </div>
      <div
        class="mhelp absolute right-8.5 top-0 text-right flex flex-col py-0.5 px-1 gap-0.5 text-purple-950/60 dark:text-pink-300/90 text-sm z-1 pointer-events-none font-medium"
        class:hidden!={popoutShown}
      >
        <div class="mhelpitem">Select / Add (q)</div>
        <div class="mhelpitem">Reposition (w/g)</div>
        <div class="mhelpitem">Rotate (e/r)</div>
        <div class="h-[1px] my-2" />
        <div class="mhelpitem">Select Keys (k)</div>
        <div class="mhelpitem">Select Columns (l)</div>
        <div class="mhelpitem">Select Clusters (o)</div>
      </div>
      <button
        class="sidemenu"
        class:selected={popoutShown}
        on:click={() => (popoutShown = !popoutShown)}
      >
        {#if $selectMode == 'key'}Edit Key{/if}
        {#if $selectMode == 'column'}Edit Column{/if}
        {#if $selectMode == 'cluster'}Edit Cluster{/if}
      </button>
      {#if popoutShown}
        <div
          class="absolute right-10 bottom-[-4rem]"
          class:w-60={$clickedKey != null}
          class:w-50={$clickedKey == null}
        >
          {#if $selectMode == 'key'}
            <div
              class="tab"
              class:hide={$clickedKey != null
                ? ![...PARTS_WITH_KEYCAPS, ...ROUND_PARTS].includes(
                    nthPartType($protoConfig, $clickedKey, 'key')
                  )
                : $hoveredKey == null ||
                  ![...PARTS_WITH_KEYCAPS, ...ROUND_PARTS].includes(
                    nthPartType($protoConfig, $hoveredKey, 'key')
                  )}
            >
              {#if $clickedKey != null ? PARTS_WITH_KEYCAPS.includes(nthPartType($protoConfig, $clickedKey, 'key')) : $hoveredKey == null || PARTS_WITH_KEYCAPS.includes(nthPartType($protoConfig, $hoveredKey, 'key'))}
                <div class="tabhead">Keycap</div>
                <div class="px-2 py-1">
                  <Field small name="Profile" icon="keycapsmall">
                    {#if keyIsClicked && $clickedKey != null}<SelectInherit
                        small
                        bind:value={keyIsClicked.profile.profile}
                        inherit={nthProfile($protoConfig, $clickedKey, 'column')}
                        on:change={updateProto}
                      >
                        {#each notNull(PROFILE).sort(sortProfiles) as prof}
                          <option value={prof}>{profileName(prof)}</option>
                        {/each}
                      </SelectInherit>
                    {:else if keyIsHovered}<span
                        class="fallback"
                        class:inherit={!keyIsHovered.profile.profile}
                        >{formatProfile($protoConfig, $hoveredKey)}</span
                      >
                    {:else}<span class="fallback">-</span>{/if}
                  </Field>
                  <Field small name="Row">
                    {#if keyIsClicked}<Select
                        small
                        bind:value={keyIsClicked.profile.row}
                        on:change={updateProto}
                      >
                        <option value={5}>R5</option>
                        <option value={4}>R4</option>
                        <option value={3}>R3</option>
                        <option value={2}>R2</option>
                        <option value={1}>R1</option>
                        <option value={0}>R0</option>
                      </Select>
                    {:else if keyIsHovered}<span class="fallback">{'R' + keyIsHovered.profile.row}</span>
                    {:else}<span class="fallback">-</span>{/if}
                  </Field>
                  {#if $clickedKey != null ? nthPartType($protoConfig, $clickedKey, 'key') != 'blank' : $hoveredKey == null || nthPartType($protoConfig, $hoveredKey, 'key') != 'blank'}
                    <Field small name="Homing">
                      {#if keyIsClicked}<Select
                          small
                          bind:value={keyIsClicked.profile.home}
                          on:change={updateProto}
                        >
                          <option value={null}>None</option>
                          <option value="thumb">Thumb</option>
                          <option value="index">Index</option>
                          <option value="middle">Middle</option>
                          <option value="ring">Ring</option>
                          <option value="pinky">Pinky</option>
                        </Select>
                      {:else if keyIsHovered}<span class="fallback">{formatHoming(keyIsHovered)}</span>
                      {:else}<span class="fallback">-</span>{/if}
                    </Field>
                    <Field small name="Letter" icon="letter">
                      {#if keyIsClicked}<input
                          class="s-input w-[5.4rem] mx-0 px-2"
                          bind:value={keyIsClicked.profile.letter}
                          on:change={updateProto}
                          on:input={setLetter}
                        />
                      {:else if keyIsHovered}<span class="fallback"
                          >{keyIsHovered.profile.letter || ''}</span
                        >
                      {:else}<span class="fallback">-</span>{/if}
                    </Field>
                  {:else}
                    <Field small name="Width">
                      {#if keyIsClicked}<DecimalInputInherit
                          small
                          noColor
                          inherit={18.5}
                          bind:value={keyIsClicked.sizeA}
                          on:change={updateProto}
                        />
                      {:else if keyIsHovered}<span class="fallback">{keyIsHovered.sizeA || '18.5'}</span>
                      {:else}<span class="fallback">-</span>{/if}
                    </Field>
                    <Field small name="Height">
                      {#if keyIsClicked}<DecimalInputInherit
                          small
                          noColor
                          inherit={18.5}
                          bind:value={keyIsClicked.sizeB}
                          on:change={updateProto}
                        />
                      {:else if keyIsHovered}<span class="fallback">{keyIsHovered.sizeB || '18.5'}</span>
                      {:else}<span class="fallback">-</span>{/if}
                    </Field>
                  {/if}
                </div>
              {:else}
                <div class="tabhead">Trackball / Trackpad</div>
                <div class="px-2 py-1">
                  <Field small name="Sides">
                    {#if keyIsClicked}<DecimalInputInherit
                        small
                        noColor
                        inherit={20}
                        bind:value={keyIsClicked.sizeB}
                        on:change={updateProto}
                      />
                    {:else if keyIsHovered}<span class="fallback">{keyIsHovered.sizeB || '20'}</span>
                    {:else}<span class="fallback">-</span>{/if}
                  </Field>
                </div>
              {/if}
            </div>
            <div class="tab">
              <div class="tabhead">Key Position</div>
              <div class="px-2 py-1">
                <Field small name="Row">
                  {#if keyIsClicked && columnIsClicked}<DecimalInputInherit
                      small
                      bind:value={keyIsClicked.row}
                      inherit={columnIsClicked.row}
                      on:change={updateProto}
                      divisor={100}
                    />
                  {:else if keyIsHovered}<span
                      class="fallback"
                      class:inherit={typeof keyIsHovered.row == 'undefined'}
                    >
                      {keyProp($protoConfig, $hoveredKey, 'row')}
                    </span>
                  {:else}<span class="fallback">-</span>{/if}
                </Field>
                <Field small name={sphereColumn ? 'Angle' : 'Column'}>
                  {#if keyIsClicked && columnIsClicked}
                    {#if sphereColumn}<AngleInputInherit
                        small
                        bind:value={keyIsClicked.column}
                        inherit={columnIsClicked.column}
                        on:change={updateProto}
                        divisor={100}
                      />
                    {:else}<DecimalInputInherit
                        small
                        bind:value={keyIsClicked.column}
                        inherit={columnIsClicked.column}
                        on:change={updateProto}
                        divisor={100}
                      />
                    {/if}
                  {:else if keyIsHovered}<span
                      class="fallback"
                      class:inherit={typeof keyIsHovered.column == 'undefined'}
                    >
                      {keyProp($protoConfig, $hoveredKey, 'column')}{#if sphereColumn}&deg;{/if}
                    </span>
                  {:else}<span class="fallback">-</span>{/if}
                </Field>
                <div class="my-2" />
                <Field small name="Offset X" icon="movex" iconColor="#ff3653">
                  {#if $clickedKey != null}<DecimalInput small bind:value={$positionX} />
                  {:else if hoveredPosition}<span class="fallback">{hoveredPosition[0] / 10}</span>
                  {:else}<span class="fallback">-</span>{/if}
                </Field>
                <Field small name="Offset Y" icon="movey" iconColor="#8adb00">
                  {#if $clickedKey != null}<DecimalInput small bind:value={$positionY} />
                  {:else if hoveredPosition}<span class="fallback">{hoveredPosition[1] / 10}</span>
                  {:else}<span class="fallback">-</span>{/if}
                </Field>
                <Field small name="Offset Z" icon="movez" iconColor="#2c8fff">
                  {#if $clickedKey != null}<DecimalInput small bind:value={$positionZ} />
                  {:else if hoveredPosition}<span class="fallback">{hoveredPosition[2] / 10}</span>
                  {:else}<span class="fallback">-</span>{/if}
                </Field>
                <div class="my-2" />
                <Field small name="Rotation X" icon="rotatex" iconColor="#ff3653">
                  {#if $clickedKey != null}
                    <AngleInput small bind:value={$rotationX} />
                  {:else if hoveredRotation}
                    <span class="fallback">{Math.round(hoveredRotation[0] / 4.5) / 10}&deg;</span>
                  {:else}
                    <span class="fallback">-</span>
                  {/if}
                </Field>
                <Field small name="Rotation Y" icon="rotatey" iconColor="#8adb00">
                  {#if $clickedKey != null}
                    <AngleInput small bind:value={$rotationY} />
                  {:else if hoveredRotation}
                    <span class="fallback">{Math.round(hoveredRotation[1] / 4.5) / 10}&deg;</span>
                  {:else}
                    <span class="fallback">-</span>
                  {/if}
                </Field>
                <Field small name="Rotation Z" icon="rotatez" iconColor="#2c8fff">
                  {#if $clickedKey != null}
                    <AngleInput small bind:value={$rotationZ} />
                  {:else if hoveredRotation}
                    <span class="fallback">{Math.round(hoveredRotation[2] / 4.5) / 10}&deg;</span>
                  {:else}
                    <span class="fallback">-</span>
                  {/if}
                </Field>
              </div>
            </div>
          {:else if $selectMode == 'column'}
            <div class="tab">
              <div class="tabhead">
                Column Curvature
                {#if columnType}<button class="ctbutton" on:click={() => changeCType(columnIsClicked)}>
                    {columnType}
                  </button>{/if}
              </div>
              <div class="px-2 py-1">
                <Field small name="Curvature" icon="column-curve">
                  {#if columnIsClicked && $clickedKey != null}<AngleInputInherit
                      small
                      bind:value={columnIsClicked.curvature.curvatureB}
                      on:change={updateProto}
                      inherit={nthCurvature($protoConfig, $clickedKey, 'curvatureB', 'cluster')}
                    />
                  {:else if $hoveredKey != null && columnIsHovered}<span
                      class="fallback"
                      class:inherit={typeof columnIsHovered.curvature.curvatureB == 'undefined'}
                    >
                      {nthCurvature($protoConfig, $hoveredKey, 'curvatureB', 'column')}&deg;
                    </span>
                  {:else}<span class="fallback">-</span>{/if}
                </Field>
                {#if !sphereColumn}
                  <Field small name="Arc" icon="bulge">
                    {#if columnIsClicked && $clickedKey != null}<DecimalInputInherit
                        small
                        bind:value={columnIsClicked.curvature.arc}
                        on:change={updateProto}
                        inherit={nthCurvature($protoConfig, $clickedKey, 'arc', 'cluster')}
                      />
                    {:else if $hoveredKey != null && columnIsHovered}<span
                        class="fallback"
                        class:inherit={typeof columnIsHovered.curvature.arc == 'undefined'}
                      >
                        {nthCurvature($protoConfig, $hoveredKey, 'arc', 'column')}&deg;
                      </span>
                    {:else}<span class="fallback">-</span>{/if}
                  </Field>
                {/if}
                <Field small name="Spacing" icon="expand-vertical">
                  {#if columnIsClicked && $clickedKey != null}<DecimalInputInherit
                      small
                      bind:value={columnIsClicked.curvature.verticalSpacing}
                      on:change={updateProto}
                      inherit={nthCurvature($protoConfig, $clickedKey, 'verticalSpacing', 'cluster')}
                    />
                  {:else if $hoveredKey != null && columnIsHovered}<span
                      class="fallback"
                      class:inherit={typeof columnIsHovered.curvature.verticalSpacing == 'undefined'}
                    >
                      {nthCurvature($protoConfig, $hoveredKey, 'verticalSpacing', 'column')}
                    </span>
                  {:else}<span class="fallback">-</span>{/if}
                </Field>
              </div>
            </div>
            <div class="tab">
              <div class="tabhead">Column Position</div>
              <div class="px-2 py-1">
                <Field small name={sphereColumn ? 'Angle' : 'Column'}>
                  {#if columnIsClicked && columnIsClicked}
                    {#if sphereColumn}<AngleInput
                        small
                        bind:value={columnIsClicked.column}
                        on:change={updateProto}
                        divisor={100}
                      />
                    {:else}<DecimalInput
                        small
                        bind:value={columnIsClicked.column}
                        on:change={updateProto}
                        divisor={100}
                      />
                    {/if}
                  {:else if columnIsHovered}<span class="fallback">
                      {columnIsHovered.column}{#if sphereColumn}&deg;{/if}
                    </span>
                  {:else}<span class="fallback">-</span>{/if}
                </Field>
                {#if !sphereColumn}
                  <Field small name="Splay">
                    {#if $clickedKey != null}
                      <AngleInput
                        small
                        value={nthSplay($protoConfig, $clickedKey)}
                        on:change={setFingerSplay}
                      />
                    {:else if $hoveredKey != null}
                      <span class="fallback"
                        >{Math.round(nthSplay($protoConfig, $hoveredKey) / 4.5) / 10}&deg;</span
                      >
                    {:else}
                      <span class="fallback">-</span>
                    {/if}
                  </Field>
                {/if}
                <div class="my-2" />
                <Field small name="Offset X" icon="movex" iconColor="#ff3653">
                  {#if $clickedKey != null}<DecimalInput small bind:value={$cpositionX} />
                  {:else if hoveredCPosition}<span class="fallback">{hoveredCPosition[0] / 10}</span>
                  {:else}<span class="fallback">-</span>{/if}
                </Field>
                <Field small name="Offset Y" icon="movey" iconColor="#8adb00">
                  {#if $clickedKey != null}<DecimalInput small bind:value={$cpositionY} />
                  {:else if hoveredCPosition}<span class="fallback">{hoveredCPosition[1] / 10}</span>
                  {:else}<span class="fallback">-</span>{/if}
                </Field>
                <Field small name="Offset Z" icon="movez" iconColor="#2c8fff">
                  {#if $clickedKey != null}<DecimalInput small bind:value={$cpositionZ} />
                  {:else if hoveredCPosition}<span class="fallback">{hoveredCPosition[2] / 10}</span>
                  {:else}<span class="fallback">-</span>{/if}
                </Field>
                <div class="my-2" />
                <Field small name="Rotation X" icon="rotatex" iconColor="#ff3653">
                  {#if $clickedKey != null}
                    <AngleInput small bind:value={$crotationX} />
                  {:else if hoveredCRotation}
                    <span class="fallback">{Math.round(hoveredCRotation[0] / 4.5) / 10}&deg;</span>
                  {:else}
                    <span class="fallback">-</span>
                  {/if}
                </Field>
                <Field small name="Rotation Y" icon="rotatey" iconColor="#8adb00">
                  {#if $clickedKey != null}
                    <AngleInput small bind:value={$crotationY} />
                  {:else if hoveredCRotation}
                    <span class="fallback">{Math.round(hoveredCRotation[1] / 4.5) / 10}&deg;</span>
                  {:else}
                    <span class="fallback">-</span>
                  {/if}
                </Field>
                <Field small name="Rotation Z" icon="rotatez" iconColor="#2c8fff">
                  {#if $clickedKey != null}
                    <AngleInput small bind:value={$crotationZ} />
                  {:else if hoveredCRotation}
                    <span class="fallback">{Math.round(hoveredCRotation[2] / 4.5) / 10}&deg;</span>
                  {:else}
                    <span class="fallback">-</span>
                  {/if}
                </Field>
              </div>
            </div>
          {:else if $selectMode == 'cluster'}
            <div class="tab">
              <div class="tabhead">
                Cluster Curvature
                {#if clusterType}<button class="ctbutton" on:click={() => changeCType(clusterIsClicked)}>
                    {clusterType}
                  </button>{/if}
              </div>
              <div class="px-2 py-1">
                <Field small name="Row Curve" icon="row-curve">
                  {#if clusterIsClicked && $clickedKey != null}<AngleInputInherit
                      small
                      bind:value={clusterIsClicked.curvature.curvatureA}
                      on:change={updateProto}
                      inherit={nthCurvature($protoConfig, $clickedKey, 'curvatureA', 'kb')}
                    />
                  {:else if $hoveredKey != null && clusterIsHovered}<span
                      class="fallback"
                      class:inherit={typeof clusterIsHovered.curvature.curvatureA == 'undefined'}
                    >
                      {nthCurvature($protoConfig, $hoveredKey, 'curvatureA', 'cluster')}&deg;
                    </span>
                  {:else}<span class="fallback">-</span>{/if}
                </Field>
                <Field small name="Col Curve" icon="column-curve">
                  {#if clusterIsClicked && $clickedKey != null}<AngleInputInherit
                      small
                      bind:value={clusterIsClicked.curvature.curvatureB}
                      on:change={updateProto}
                      inherit={nthCurvature($protoConfig, $clickedKey, 'curvatureB', 'kb')}
                    />
                  {:else if $hoveredKey != null && clusterIsHovered}<span
                      class="fallback"
                      class:inherit={typeof clusterIsHovered.curvature.curvatureB == 'undefined'}
                    >
                      {nthCurvature($protoConfig, $hoveredKey, 'curvatureB', 'cluster')}&deg;
                    </span>
                  {:else}<span class="fallback">-</span>{/if}
                </Field>
                <Field small name="Arc" icon="bulge">
                  {#if clusterIsClicked && $clickedKey != null}<DecimalInputInherit
                      small
                      bind:value={clusterIsClicked.curvature.arc}
                      on:change={updateProto}
                      inherit={nthCurvature($protoConfig, $clickedKey, 'arc', 'kb')}
                    />
                  {:else if $hoveredKey != null && clusterIsHovered}<span
                      class="fallback"
                      class:inherit={typeof clusterIsHovered.curvature.arc == 'undefined'}
                    >
                      {nthCurvature($protoConfig, $hoveredKey, 'arc', 'cluster')}&deg;
                    </span>
                  {:else}<span class="fallback">-</span>{/if}
                </Field>
                <div class="my-2" />
                <Field small name="H Spacing" icon="expand-horizontal">
                  {#if clusterIsClicked && $clickedKey != null}<DecimalInputInherit
                      small
                      bind:value={clusterIsClicked.curvature.horizontalSpacing}
                      on:change={updateProto}
                      inherit={nthCurvature($protoConfig, $clickedKey, 'horizontalSpacing', 'kb')}
                    />
                  {:else if $hoveredKey != null && clusterIsHovered}<span
                      class="fallback"
                      class:inherit={typeof clusterIsHovered.curvature.horizontalSpacing == 'undefined'}
                    >
                      {nthCurvature($protoConfig, $hoveredKey, 'horizontalSpacing', 'cluster')}
                    </span>
                  {:else}<span class="fallback">-</span>{/if}
                </Field>
                <Field small name="V Spacing" icon="expand-vertical">
                  {#if clusterIsClicked && $clickedKey != null}<DecimalInputInherit
                      small
                      bind:value={clusterIsClicked.curvature.verticalSpacing}
                      on:change={updateProto}
                      inherit={nthCurvature($protoConfig, $clickedKey, 'verticalSpacing', 'kb')}
                    />
                  {:else if $hoveredKey != null && clusterIsHovered}<span
                      class="fallback"
                      class:inherit={typeof clusterIsHovered.curvature.verticalSpacing == 'undefined'}
                    >
                      {nthCurvature($protoConfig, $hoveredKey, 'verticalSpacing', 'cluster')}
                    </span>
                  {:else}<span class="fallback">-</span>{/if}
                </Field>
              </div>
            </div>
            <div class="tab">
              <div class="tabhead">Cluster Position</div>
              <div class="px-2 py-1">
                <Field small name="Offset X" icon="movex" iconColor="#ff3653">
                  {#if $clickedKey != null}<DecimalInput small bind:value={$lpositionX} />
                  {:else if hoveredLPosition}<span class="fallback">{hoveredLPosition[0] / 10}</span>
                  {:else}<span class="fallback">-</span>{/if}
                </Field>
                <Field small name="Offset Y" icon="movey" iconColor="#8adb00">
                  {#if $clickedKey != null}<DecimalInput small bind:value={$lpositionY} />
                  {:else if hoveredLPosition}<span class="fallback">{hoveredLPosition[1] / 10}</span>
                  {:else}<span class="fallback">-</span>{/if}
                </Field>
                <Field small name="Offset Z" icon="movez" iconColor="#2c8fff">
                  {#if $clickedKey != null}<DecimalInput small bind:value={$lpositionZ} />
                  {:else if hoveredLPosition}<span class="fallback">{hoveredLPosition[2] / 10}</span>
                  {:else}<span class="fallback">-</span>{/if}
                </Field>
                <div class="my-2" />
                <Field small name="Rotation X" icon="rotatex" iconColor="#ff3653">
                  {#if $clickedKey != null}
                    <DecimalInput small bind:value={$lrotationX} divisor={45} />
                  {:else if hoveredLRotation}
                    <span class="fallback">{Math.round(hoveredLRotation[0] / 4.5) / 10}</span>
                  {:else}
                    <span class="fallback">-</span>
                  {/if}
                </Field>
                <Field small name="Rotation Y" icon="rotatey" iconColor="#8adb00">
                  {#if $clickedKey != null}
                    <DecimalInput small bind:value={$lrotationY} divisor={45} />
                  {:else if hoveredLRotation}
                    <span class="fallback">{Math.round(hoveredLRotation[1] / 4.5) / 10}</span>
                  {:else}
                    <span class="fallback">-</span>
                  {/if}
                </Field>
                <Field small name="Rotation Z" icon="rotatez" iconColor="#2c8fff">
                  {#if $clickedKey != null}
                    <DecimalInput small bind:value={$lrotationZ} divisor={45} />
                  {:else if hoveredLRotation}
                    <span class="fallback">{Math.round(hoveredLRotation[2] / 4.5) / 10}</span>
                  {:else}
                    <span class="fallback">-</span>
                  {/if}
                </Field>
              </div>
            </div>
          {/if}
        </div>
      {/if}
    </div>
  </div>
{/if}

<NewViewer {style} bind:cameraPosition {enableRotate} {enableZoom} enablePan={true} suggestedSize={size}>
  {#each objEntriesNotNull(geometry) as [kbd, geo] (kbd)}
    {@const cent = center[kbd]}
    {#if cent}
      <T.Group position={[-cent[0], -cent[1], -cent[2]]} scale.x={kbd == 'left' ? -1 : 1}>
        <Keyboard
          geometry={geo}
          {transparency}
          flip={kbd == 'left'}
          {pressedLetter}
          translation={zPos}
          reachability={kbd != 'left' ? reachabilityArr : undefined}
          side={kbd}
        />
        {#if flags.intersection}
          {#each componentBoxes(geo.c, geo) as box}
            <T.Mesh geometry={componentGeometry(box)} material={new KeyMaterial(1, 1, 'red')} />
          {/each}
        {/if}
        {#if $showKeyInts}
          {#each geo.c.keys as k, i}
            <GroupMatrix matrix={geo.keyHolesTrsfs[i].Matrix4()}>
              {#each simpleSocketGeos(k.type) as g}
                <T.Mesh geometry={g}><KeyboardMaterial status="error" kind="key" /></T.Mesh>
              {/each}
              {@const skey = simpleKeyGeo(k, true)}
              {#if skey}
                <GroupMatrix matrix={simpleKeyPosition(k, new Trsf()).Matrix4()}>
                  <T.Mesh geometry={skey}><KeyboardMaterial status="error" kind="key" /></T.Mesh>
                </GroupMatrix>
              {/if}
            </GroupMatrix>
          {/each}
        {/if}
      </T.Group>
    {/if}
  {/each}
  <slot />
  {@const bestC = center.unibody || center.right || center.left}
  <T.Group position={[-bestC[0], -bestC[1], -bestC[2]]}>
    {#if conf && flags.hand && showHand && jointsJSON}
      <T.Group
        position={$view == 'left' ? leftHandPosition : rightHandPosition}
        rotation={$view == 'left' ? leftHandRotation : rightHandRotation}
        scale={[1, flip ? -1 : 1, 1]}
        let:ref={handRef}
      >
        <HandModel reverse={!flip} hand={theHand} />
        <TTransformControls
          object={handRef}
          scale={0.9}
          transformation={rightHandMatrix}
          on:objectChange={() => {
            handRef.updateMatrix()
            updateHandMatrix(handRef.matrix)
          }}
          on:mouseUp={() => {
            handRef.updateMatrix()
            updateWristRest(handRef.matrix)
          }}
        />
      </T.Group>
      <!-- <AxesHelper size={100} matrix={debug} /> -->
    {/if}
  </T.Group>
  {#if clickedSide != null}
    {@const clickedC = center[clickedSide] || [0, 0, 0]}
    <T.Group position={[-clickedC[0], -clickedC[1], -clickedC[2]]}>
      {#if $transformMode == 'select' && !showSupports}
        {#each adjacentPositions(geometry[clickedSide], $clickedKey, $protoConfig, $selectMode) as adj}
          <GroupMatrix
            matrix={shouldFlipKey($view, $clickedKey, $protoConfig) ? flipMatrixX(adj.pos) : adj.pos}
          >
            <AddButton {darkMode} on:click={() => addKey(adj.dx, adj.dy)} />
          </GroupMatrix>
        {/each}
      {/if}
      <TransformControls
        visible={!showSupports}
        on:move={(e) => onMove(e.detail, false)}
        on:change={(e) => onMove(e.detail, true)}
      />
    </T.Group>
  {/if}
  {#if $showGizmo}
    <Gizmo verticalPlacement="top" horizontalPlacement="left" paddingX={50} paddingY={50} />
  {/if}
  {#if $showGrid}
    <T.GridHelper
      args={[$view == 'both' ? 400 : 300, $view == 'both' ? 40 : 30, 0x888888]}
      position.z={floorZ - (Object.values(center)[0] || [0, 0, 0])[2]}
      rotation={[-Math.PI / 2, 0, 0]}
    />
  {/if}
  <!--  -->
</NewViewer>
{#if $debugViewport}
  <div
    class="absolute bottom-8 right-8 bg-gray-100/80 dark:bg-gray-800/80 backdrop-blur-md rounded px-4 py-2 text-xs font-mono w-76 text-end select-none"
  >
    <p>
      Camera Position: {new Vector3(...cameraPosition)
        .normalize()
        .toArray()
        .map((a) => Math.round(a * 100) / 100)
        .join(', ')}
    </p>
    <p><button class="inline-block!" on:click={copyCanvas}>Copy Canvas to clipboard</button></p>
  </div>
{/if}

<style>
  .button {
    z-index: 10;
    --at-apply: 'appearance-none bg-gray-200 dark:bg-gray-900 p-1 pr-2 m-1 rounded text-gray-800 dark:text-gray-200 flex gap-2';
  }
  .button:not(:disabled) {
    --at-apply: 'hover:bg-gray-400 dark:hover:bg-gray-700';
  }
  .button:disabled {
    --at-apply: 'opacity-40';
  }

  .ctbutton {
    z-index: 10;
    --at-apply: 'appearance-none bg-purple-200 dark:bg-pink-900  px-2 rounded text-gray-800 dark:text-gray-200';
  }

  .sidebutton {
    --at-apply: 'appearance-none hover:bg-purple-200 dark:hover:bg-gray-200 dark:hover:bg-gray-700 p-1.5 rounded-full text-gray-800 dark:text-gray-200';
  }
  .sidemenu {
    --at-apply: 'text-sm relative z-1 appearance-none hover:bg-purple-200 dark:hover:bg-gray-200 dark:hover:bg-gray-700 py-4 rounded-5 bg-[#EFE8FF] dark:bg-gray-900 text-gray-800 dark:text-gray-200 write-vertical-left flex items-center';
  }
  .sidebutton.selected,
  .sidemenu.selected {
    --at-apply: 'bg-purple-300  dark:bg-pink-600 dark:text-white';
  }

  .fallback {
    --at-apply: 'text-gray-500 dark:text-gray-400 whitespace-nowrap';
  }
  .fallback.inherit {
    --at-apply: 'text-yellow-500/70';
  }

  .hide {
    opacity: 0;
    z-index: -1;
  }

  .tab {
    --at-apply: 'bg-[#f8f5ff]/80 backdrop-blur-md dark:bg-slate-900/80 rounded-2 overflow-hidden mb-4 transition-opacity relative z-1';
  }
  .tabhead {
    --at-apply: 'bg-purple-300 dark:bg-pink-600 px-3 py-0.5 flex justify-between';
  }
  .mhelp {
    opacity: 0;
    transform: translate(10px);
    transition: transform 0.2s ease-out, opacity 0.1s ease-out;
  }
  .bigmenu:hover + .mhelp {
    opacity: 1;
    transform: none;
  }
  .mhelpitem {
    --at-apply: 'line-height-[20px] pl-4 pr-2 py-1.5 whitespace-nowrap from-white/80 dark:from-slate-800/80 via-white/60 to-white/0 dark:via-slate-800/70  dark:to-slate-800/50 backdrop-blur-sm rounded-2';
    background: radial-gradient(ellipse 70% 80% at 60% center, var(--un-gradient-stops));
  }
</style>

<script lang="ts">
  import { isWarningError, type ConfErrors } from '$lib/worker/check'
  import KeyboardKey from './KeyboardKey.svelte'
  import KeyboardMaterial from './KeyboardMaterial.svelte'
  import KeyboardPartGeo from './KeyboardPartGeo.svelte'
  import KeyboardKeycapGeo from './KeyboardKeycapGeo.svelte'
  import type { CuttleKey, Geometry } from '$lib/worker/config'
  import * as flags from '$lib/flags'
  import { keyBrightness, type KeyStatus } from './keyboardKey'
  import { hasKeyGeometry, keyUrl } from '$lib/loaders/keycaps'
  import {
    clickedKey,
    confError,
    hoveredKey,
    noBlanks,
    noLabels,
    protoConfig,
    selectMode,
    showKeyInts,
  } from '$lib/store'
  import { nthIndex } from '$lib/worker/config.cosmos'
  import { switchInfo } from '$lib/geometry/switches'
  import { T } from '@threlte/core'
  import { variantURL } from '$lib/geometry/socketsParts'
  import { DefaultMap } from '$lib/worker/util'
  import { MeshStandardMaterial, Quaternion, Vector3, type Vector3Tuple, type Vector4Tuple } from 'three'

  export let geometry: Geometry | null
  export let transparency: number = 100
  export let pressedLetter: string | null = null
  export let translation: number = 0
  export let flip = true
  export let reachability: boolean[] | undefined = undefined
  export let side: 'left' | 'right' | 'unibody'
  export let keyColor: [any, number] | undefined = undefined

  $: console.log('new intersections', $confError)

  function keyStatus(reachability: boolean[] | undefined, errors: ConfErrors, i: number) {
    let status: KeyStatus = undefined
    if (reachability && !reachability[i]) status = 'warning'
    errors.forEach((error) => {
      if (!error || error.side != side) return
      if (error.type == 'intersection' && (error.i == i || error.j == i))
        status = isWarningError(error) && status != 'error' ? 'warning' : 'error'
      if (error.type == 'wallBounds' && error.i == i) status = 'warning'
      if (error.type == 'samePosition' && (error.i == i || error.j == i)) status = 'error'
    })
    return status
  }

  function partStatus(errors: ConfErrors, i: number) {
    let status: KeyStatus = undefined
    errors.forEach((error) => {
      if (!error || error.side != side) return
      if (error.type == 'intersection' && error.what == 'socket' && (error.i == i || error.j == i))
        status = isWarningError(error) && status != 'error' ? 'warning' : 'error'
      if (error.type == 'wallBounds' && error.i == i && status != 'error') status = 'warning'
      if (error.type == 'samePosition' && (error.i == i || error.j == i)) status = 'error'
    })
    return status
  }

  type PartInfo = {
    key: CuttleKey
    pos: Vector3Tuple
    rot: Vector4Tuple
    i: number
    letter?: string
  }

  const scale = new Vector3()
  const rot = new Quaternion()
  const pos = new Vector3()

  function gatherPartsAndVariants(geo: Geometry) {
    const ids = new DefaultMap<string, PartInfo[]>(() => [])
    geo.c.keys.forEach((key, i) => {
      geo.keyHolesTrsfs[i].Matrix4().decompose(pos, rot, scale)
      const id = key.type + variantURL(key)
      ids.get(id).push({ key, pos: pos.toArray(), rot: rot.toArray() as Vector4Tuple, i })
    })
    return ids
  }

  function gatherKeysAndVariants(geo: Geometry) {
    const ids = new DefaultMap<string, PartInfo[]>(() => [])
    geo.c.keys.forEach((key, i) => {
      if (!hasKeyGeometry(key)) return false
      geo.keyHolesTrsfs[i]
        .pretranslated(0, 0, switchInfo(key.type).height)
        .Matrix4()
        .decompose(pos, rot, scale)
      const url = keyUrl(key)
      const letter = 'keycap' in key && key.keycap ? key.keycap.letter : undefined
      if (url)
        ids.get(url).push({ key, pos: pos.toArray(), rot: rot.toArray() as Vector4Tuple, i, letter })
    })
    return ids
  }

  function gatherLetters(parts: PartInfo[]) {
    const ids = new DefaultMap<string, PartInfo[]>(() => [])
    for (const part of parts) {
      ids.get(part.letter || '').push(part)
    }
    return ids
  }

  function adjustedPosition(key: PartInfo, translation: number) {
    geometry!.keyHolesTrsfs[key.i]
      .pretranslated(0, 0, switchInfo(key.key.type).height + translation)
      .Matrix4()
      .decompose(pos, rot, scale)
    return pos.toArray()
  }

  $: visible = transparency != 0

  // This file has undergone a lot of optimization. Some perf benefits that are clear:
  // - Order by part type to minimize changing of geomtries
  // - Order by letter to minimize re-computing / changing of letter textures
  // - Instancing was cool but a lot of work. Also doesn't play well with per-key textures
</script>

{#if !$showKeyInts && geometry && !flags.intersection}
  <!-- {#each geometry.keyHolesTrsfs as trsf, i (i + ' ' + geometry.c.keys[i].keycap?.letter + ' ' + (geometry.c.keys[i].type == 'blank'))}
    {@const key = geometry.c.keys[i]}
    <GroupMatrix matrix={trsf.pretranslated(0, 0, switchInfo(key.type).height).Matrix4()}>
      {@const letter = 'keycap' in key && key.keycap ? key.keycap.letter : undefined}
      <T.Group
        position={[0, 0, pressedLetter && letter === pressedLetter ? translation : 0]}
        scale.x={flip ? -1 : 1}
      >
        <KeyboardKey
          index={nthIndex($protoConfig, side, i)}
          opacity={transparency / 100}
          brightness={1}
          {letter}
          status={keyStatus(reachability, $confError, i)}
          renderOrder={5}
        >
          {#await keyGeometry(key) then k}
            {#if k}
              <T is={k} />
            {/if}
          {/await}
        </KeyboardKey>
      </T.Group>
    </GroupMatrix>
    <GroupMatrix matrix={trsf.Matrix4()}>
      <T.Group scale.x={flip ? -1 : 1}>
        <KeyboardKey
          index={nthIndex($protoConfig, side, i)}
          opacity={key.type == 'blank'
            ? Math.max(0, (transparency - 50) / 200)
            : transparency / 100}
          brightness={0.7}
          status={partStatus($confError, i)}
        >
          {#if key.type == 'blank'}
            {#if !$noBlanks}
              <T.BoxGeometry args={[key.size.width ?? 18.5, key.size.height ?? 18.5, 1]} />
            {/if}
          {:else}
            {#await partGeometry(key.type, key.variant) then geo}
              {#if geo}
                <T is={geo} />
              {/if}
            {/await}
          {/if}
        </KeyboardKey>
      </T.Group>
    </GroupMatrix>
  {/each} -->
  {#each gatherKeysAndVariants(geometry) as [id, gkeys] (id)}
    {#each gatherLetters(gkeys) as [lett, keys] (lett)}
      {#each keys as key}
        {@const index = nthIndex($protoConfig, side, key.i)}
        <KeyboardKey
          {index}
          {visible}
          position={pressedLetter && lett == pressedLetter
            ? adjustedPosition(key, translation)
            : key.pos}
          quaternion={key.rot}
          scale.x={flip ? -1 : 1}
        >
          <KeyboardKeycapGeo key={key.key} />
          {#if keyColor}
            <T.MeshStandardMaterial color={keyColor[0]} transparent={true} opacity={keyColor[1]} />
          {:else}
            <KeyboardMaterial
              textured
              kind="key"
              opacity={transparency / 100}
              brightness={keyBrightness(index, $protoConfig, $selectMode, $clickedKey, $hoveredKey, 1)}
              letter={$noLabels ? undefined : key.letter}
              status={keyStatus(reachability, $confError, key.i)}
            />
          {/if}
        </KeyboardKey>
      {/each}
    {/each}
  {/each}
  {#each gatherPartsAndVariants(geometry) as [id, keys] (id)}
    {#each keys as key}
      {@const index = nthIndex($protoConfig, side, key.i)}
      <KeyboardKey
        {index}
        visible={visible && (key.key.type != 'blank' || !($noBlanks || keyColor))}
        position={key.pos}
        quaternion={key.rot}
        scale.x={flip ? -1 : 1}
      >
        {#if key.key.type == 'blank'}
          <T.BoxGeometry args={[key.key.size.width ?? 18.5, key.key.size.height ?? 18.5, 1]} />
        {:else}
          <KeyboardPartGeo part={key.key.type} variant={key.key.variant} />
        {/if}
        {#if keyColor}
          <T.MeshStandardMaterial color={0x504866} />
        {:else}
          <KeyboardMaterial
            textured
            kind="key"
            opacity={key.key.type == 'blank'
              ? Math.max(0, (transparency - 50) / 200)
              : transparency / 100}
            brightness={keyBrightness(index, $protoConfig, $selectMode, $clickedKey, $hoveredKey, 0.7)}
            status={partStatus($confError, key.i)}
          />
        {/if}
      </KeyboardKey>
    {/each}
  {/each}
{/if}

<!-- <InstancedMesh>
      <KeyboardPartGeo part={keys[0].key.type} variant={keys[0].key.variant} />
      <KeyboardMaterial instanced kind="key" opacity={transparency / 100} />

      {#each keys as key}
        {@const index = nthIndex($protoConfig, side, key.i)}
        <KeyboardKeyInstance {index} brightness={0.7} position={key.pos} rotation={key.rot} />
      {/each}
    </InstancedMesh> -->

<script lang="ts">
  import { flippedKey } from '$lib/geometry/keycaps'
  import { isWarning, type ConfError } from '$lib/worker/check'
  import KeyboardKey from './KeyboardKey.svelte'
  import GroupMatrix from './GroupMatrix.svelte'
  import type { CuttleKey, Geometry } from '$lib/worker/config'
  import * as flags from '$lib/flags'
  import type { KeyStatus } from './keyboardKey'
  import { keyGeometry } from '$lib/loaders/keycaps'
  import { confError, protoConfig, showKeyInts } from '$lib/store'
  import { partGeometry } from '$lib/loaders/parts'
  import { nthIndex } from '$lib/worker/config.cosmos'
  import { switchInfo } from '$lib/geometry/switches'
  import { T } from '@threlte/core'

  export let geometry: Geometry | null
  export let transparency: number
  export let pressedLetter: string | null = null
  export let translation: number
  export let flip = true
  export let reachability: boolean[] | undefined
  export let side: 'left' | 'right' | 'unibody'

  $: console.log('new intersections', $confError)

  function keyStatus(reachability: boolean[] | undefined, error: ConfError | undefined, i: number) {
    let status: KeyStatus = undefined
    if (reachability && !reachability[i]) status = 'warning'
    if (!error || error.side != side) return status
    if (error.type == 'intersection' && (error.i == i || error.j == i))
      status = isWarning(error) ? 'warning' : 'error'
    if (error.type == 'wallBounds' && error.i == i) status = 'warning'
    return status
  }

  function partStatus(error: ConfError | undefined, i: number) {
    let status: KeyStatus = undefined
    if (!error || error.side != side) return status
    if (error.type == 'intersection' && error.what == 'socket' && (error.i == i || error.j == i))
      status = isWarning(error) ? 'warning' : 'error'
    if (error.type == 'wallBounds' && error.i == i) status = 'warning'
    return status
  }
</script>

{#if transparency != 0 && !$showKeyInts && geometry && !flags.intersection}
  {#each geometry.keyHolesTrsfs as trsf, i (i + ' ' + geometry.c.keys[i].keycap?.letter)}
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
            <T.BoxGeometry args={[key.size.width ?? 18.5, key.size.height ?? 18.5, 1]} />
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
  {/each}
{/if}

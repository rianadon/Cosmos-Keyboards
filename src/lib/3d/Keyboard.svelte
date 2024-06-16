<script lang="ts">
  import { flippedKey } from '$lib/geometry/keycaps'
  import { isWarning, type ConfError } from '$lib/worker/check'
  import KeyboardKey from './KeyboardKey.svelte'
  import GroupMatrix from './GroupMatrix.svelte'
  import type { Geometry } from '$lib/worker/config'
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
  {#each geometry.keyHolesTrsfs as trsf, i}
    {@const key = geometry.c.keys[i]}
    <GroupMatrix matrix={trsf.pretranslated(0, 0, switchInfo(key.type).height).Matrix4()}>
      {@const letter = 'keycap' in key && key.keycap ? key.keycap.letter : undefined}
      <KeyboardKey
        index={nthIndex($protoConfig, side, i)}
        opacity={transparency / 100}
        brightness={1}
        letter={flip ? flippedKey(letter) : letter}
        status={keyStatus(reachability, $confError, i)}
        position={[0, 0, pressedLetter && letter === pressedLetter ? translation : 0]}
        renderOrder={5}
        {flip}
      >
        {#await keyGeometry(key) then k}
          <T is={k} />
        {/await}
      </KeyboardKey>
    </GroupMatrix>
    <GroupMatrix matrix={trsf.Matrix4()}>
      <KeyboardKey
        index={nthIndex($protoConfig, side, i)}
        opacity={key.type == 'blank' ? Math.max(0, (transparency - 50) / 200) : transparency / 100}
        brightness={0.7}
        status={partStatus($confError, i)}
      >
        {#if key.type == 'blank'}
          <T.BoxGeometry args={[key.size.width ?? 18.5, key.size.height ?? 18.5, 1]} />
        {:else}
          {#await partGeometry(key.type, key.variant) then geo}
            <T is={geo} />
          {/await}
        {/if}
      </KeyboardKey>
    </GroupMatrix>
  {/each}
{/if}

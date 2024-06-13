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
    if (error && error.type == 'intersection' && (error.i == i || error.j == i))
      status = isWarning(error) ? 'warning' : 'error'
    if (error && error.type == 'wallBounds' && error.i == i) status = 'warning'
    return status
  }

  function partStatus(error: ConfError | undefined, i: number) {
    let status: KeyStatus = undefined
    if (
      error &&
      error.type == 'intersection' &&
      error.what == 'socket' &&
      (error.i == i || error.j == i)
    )
      status = isWarning(error) ? 'warning' : 'error'
    if (error && error.type == 'wallBounds' && error.i == i) status = 'warning'
    return status
  }
</script>

{#if transparency != 0 && !$showKeyInts && geometry && !flags.intersection}
  {#each geometry.keyHolesTrsfs as trsf, i}
    {#await keyGeometry(trsf, geometry.c.keys[i]) then k}
      {#if k}
        <GroupMatrix matrix={k.matrix}>
          {@const letter = 'keycap' in k.key ? k.key.keycap.letter : undefined}
          <KeyboardKey
            index={nthIndex($protoConfig, side, i)}
            opacity={transparency / 100}
            brightness={1}
            letter={flip ? flippedKey(letter) : letter}
            status={keyStatus(reachability, $confError, i)}
            geometry={k.geometry}
            position={[0, 0, pressedLetter && letter === pressedLetter ? translation : 0]}
            renderOrder={5}
            {flip}
          />
        </GroupMatrix>
      {/if}
    {/await}
    {#await partGeometry(geometry.c.keys[i].type) then geo}
      {#if geo}
        <GroupMatrix matrix={trsf.Matrix4()}>
          <KeyboardKey
            index={nthIndex($protoConfig, side, i)}
            opacity={transparency / 100}
            brightness={0.7}
            status={partStatus($confError, i)}
            geometry={geo}
          />
        </GroupMatrix>
      {/if}
    {/await}
  {/each}
{/if}

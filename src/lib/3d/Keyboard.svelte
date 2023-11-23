<script lang="ts">
  import { flippedKey } from '$lib/geometry/keycaps'
  import { keyHolesTrsfs } from '$lib/worker/geometry'
  import Trsf from '$lib/worker/modeling/transformation'
  import type { BufferGeometry, Matrix4 } from 'three'
  import type { ConfError } from '$lib/worker/check'
  import KeyboardKey from './KeyboardKey.svelte'
  import GroupMatrix from './GroupMatrix.svelte'
  import type { CuttleKey, Cuttleform } from '$lib/worker/config'
  import { switchInfo } from '$lib/geometry/switches'
  import * as flags from '$lib/flags'
  import type { KeyStatus } from './keyboardKey'
  import { keyGeometries } from '$lib/loaders/keycaps'
  import { offsetPart, partGeometries } from '$lib/loaders/parts'

  export let config: Cuttleform
  export let transparency: number
  export let pressedLetter: string | null = null
  export let translation: number
  export let flip = true
  export let reachability: boolean[]
  export let error: ConfError
  export let customThumbConfig: Matrix4[]

  interface Key {
    geometry: BufferGeometry
    brightness: number
    translation: number
    letter?: string
    status?: KeyStatus
    offset: number
    matrix: Matrix4
  }

  let geos: Key[][] = []

  $: if (config) {
    updateKeyboard(reachability, pressedLetter, translation)
  }

  async function updateKeyboard(reachability, pressedLetter, translation) {
    const p = keyHolesTrsfs(config, new Trsf())
    const keyPromise = keyGeometries(p, config.keys)
    const switchPromise = partGeometries(p, config.keys)

    const k = await keyPromise
    const s = await switchPromise
    console.log('got new geometry', k)
    geos = config.keys.map((k) => [])
    if (!flags.intersection)
      k.forEach((x) => {
        if (!x) throw new Error('oops')
        const letter = 'keycap' in x.key ? x.key.keycap.letter : undefined
        let status: KeyStatus = undefined
        if (reachability && !reachability[x.i]) status = 'warning'
        if (error && error.type == 'intersection' && (error.i == x.i || error.j == x.i))
          status = 'error'
        const offset = offsetHeight(config.keys[x.i])
        geos[x.i].push({
          geometry: x.geometry,
          brightness: 1,
          translation: pressedLetter && letter === pressedLetter ? translation : 0,
          letter,
          status,
          offset,
          matrix: x.matrix,
        })
      })
    for (const x of s) {
      if (!x) throw new Error('oops')
      geos[x.i].push({
        geometry: x.geometry,
        brightness: 0.7,
        matrix: x.matrix,
        offset: offsetPart(config.keys[x.i].type)[2],
        translation: 0,
      })
    }
  }

  $: customStart = config
    ? config.keys.length - (customThumbConfig ? customThumbConfig.length : 0)
    : 0

  function offsetHeight(k: CuttleKey) {
    const switchHeight = switchInfo(k.type).height
    return k.type == 'trackball' ? -2.5 : switchHeight
  }
</script>

{#if transparency != 0}
  {#each geos as g, i}
    {#if customThumbConfig && i >= customStart && i - customStart < customThumbConfig.length}
      {#each g as k}
        <GroupMatrix matrix={customThumbConfig[i - customStart]}>
          <KeyboardKey
            index={i}
            opacity={transparency / 100}
            brightness={k.brightness}
            letter={flip ? flippedKey(k.letter) : k.letter}
            status={k.status}
            geometry={k.geometry}
            position={[0, 0, k.offset + k.translation]}
          />
        </GroupMatrix>
      {/each}
    {:else}
      {#each g as k}
        <GroupMatrix matrix={k.matrix}>
          <KeyboardKey
            index={i}
            opacity={transparency / 100}
            brightness={k.brightness}
            letter={flip ? flippedKey(k.letter) : k.letter}
            status={k.status}
            geometry={k.geometry}
            position={[0, 0, k.translation]}
          />
        </GroupMatrix>
      {/each}
    {/if}
  {/each}
{/if}

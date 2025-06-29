<script lang="ts">
  import Viewer from './Viewer.svelte'
  import { drawLinedWall, drawWall, fullSizes, logicalKeys } from './viewerHelpers'
  import { fullEstimatedCenter, type CuttleKey } from '$lib/worker/config'
  import { isRenderable, type ConfErrors } from '$lib/worker/check'
  import { view } from '$lib/store'
  import { hasKeyGeometry, hasPinsInMatrix } from '$lib/loaders/keycaps'
  import type { FullGeometry } from './viewer3dHelpers'
  import { mapObjNotNull, objEntries } from '$lib/worker/util'
  import { T } from '@threlte/core'
  import { HTML } from '@threlte/extras'

  export let geometry: FullGeometry
  export let style: string = ''
  export let confError: ConfErrors
  export let darkMode: boolean

  let activeIndex = 0
  $: possibleKeys = logicalKeys(geometry).filter(hasPinsInMatrix)
  $: activeKey = possibleKeys[activeIndex]
  let matrices = new Map<CuttleKey, [number, number]>()
  let matrixState: [typeof matrices, number] = [matrices, 0]
  export let fullMatrix: typeof matrices | null
  $: fullMatrix = activeKey ? null : matrices

  $: centers = fullEstimatedCenter(geometry, false)
  $: center = centers[$view]

  $: allGeometriesSize =
    isRenderable(confError) && geometry
      ? drawStatesForSizing(geometry)
      : ({} as ReturnType<typeof drawStatesForSizing>)
  $: sizes = fullSizes(allGeometriesSize)
  $: size = sizes[$view]

  function drawStatesForSizing(geometry: FullGeometry) {
    return mapObjNotNull(geometry, (g) =>
      g.allKeyCriticalPoints2D.flatMap((p) => drawLinedWall(p.map((p) => p.xy())))
    )
  }

  let recording = false
  let recorded = ''
  function handleKeydown(event: KeyboardEvent) {
    if (recording && event.key == ' ') {
      recording = false
      recorded = recorded.toLowerCase()
      if (/^[a-f\d]+,[a-f\d]+$/.test(recorded)) {
        event.preventDefault()
        const [row, column] = recorded.split(',').map((n) => (isNaN(+n) ? parseInt(n, 16) : Number(n)))
        matrices.set(activeKey, [row, column])
        matrixState = [matrices, matrixState[1] + 1]
        activeIndex++
      }
      recorded = ''
    } else if (recording) recorded += event.key
    else if (event.key == '!') recording = true
  }

  function undo() {
    if (activeIndex == 0) return
    activeIndex -= 1
    matrices.delete(possibleKeys[activeIndex])
    matrixState = [matrices, matrixState[1] + 1]
  }

  function reset() {
    activeIndex = 0
    matrices.clear()
    matrixState = [matrices, matrixState[1] + 1]
  }

  function isBootmagic(kbd: string, pos: [number, number] | undefined) {
    if (!pos) return false
    if (kbd == 'right') return pos[0] == 7 && pos[1] == 0
    return pos[0] == 0 && pos[1] == 0
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="absolute top-10 left-0 right-0">
  <div class="flex justify-center gap-2">
    <button class="button" on:click={() => undo()}>Undo</button>
    <button class="button" on:click={() => reset()}>Reset</button>
  </div>
  {#if !activeKey}
    <div>
      <div class="flex items-center">
        <div class="w-8">
          <div class="bg-brand-pink/10 border-1 border-brand-pink w-4 h-4 mx-auto" />
        </div>
        Bootmagic Key
      </div>
    </div>
  {/if}
</div>

<Viewer {size} {style} cameraPosition={[0, 0, 1]} enableRotate={false}>
  {#each objEntries(geometry) as [kbd, geo]}
    {@const cent = center[kbd]}
    {#if cent && geo}
      <T.Group position={[-cent[0], -cent[1], -cent[2]]} scale.x={kbd == 'left' ? -1 : 1}>
        {#if isRenderable(confError) && geometry}
          {#each geo.allKeyCriticalPoints2D as p, i}
            {@const active = geo.c.keys[i] == activeKey}
            {@const hasMatrix = hasPinsInMatrix(geo.c.keys[i])}
            {@const bm = isBootmagic(kbd, matrixState[0].get(geo.c.keys[i]))}
            {@const meshColor = active ? 0x0000ff : hasMatrix ? (bm ? 0xf57aec : 0xffcc33) : 0xcccccc}
            <T.Mesh geometry={drawWall(p.map((p) => p.xy()))}>
              <T.MeshBasicMaterial color={meshColor} transparent={true} opacity={0.1} />
            </T.Mesh>
            <T.Mesh geometry={drawLinedWall(p.map((p) => p.xy()))}>
              <T.MeshBasicMaterial color={meshColor} />
            </T.Mesh>
          {/each}
          {#each geo.keyHolesTrsfs2D.flat().map((k) => k.xyz()) as p, i}
            {@const key = geo.c.keys[i]}
            {@const mat = matrixState[0].get(key)}
            <HTML position={[p[0], p[1], 0]} center>
              <div class="leading-none text-center">
                {(hasKeyGeometry(key) && 'keycap' in key && key.keycap?.letter) || ' '}
              </div>
              <div class="text-xs leading-none text-center opacity-70">
                {#if mat} {mat.join(',')}{/if}
              </div>
            </HTML>
          {/each}
        {/if}
      </T.Group>
    {/if}
  {/each}
</Viewer>
{#if !activeKey}
  <div class="absolute inset-1/2">
    <div
      class="rounded text-center flex items-center justify-center w-48 h-16 absolute ml-[-6rem] mt-[-4rem] bg-white dark:bg-gray-800"
    >
      All done!
    </div>
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
</style>

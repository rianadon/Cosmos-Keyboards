<script lang="ts">
  import { isWarning, salientError } from '$lib/worker/check'
  import { confError, protoConfig, showErrorMsg } from '$lib/store'
  import Icon from '$lib/presentation/Icon.svelte'
  import { mdiArrowCollapseUp, mdiArrowExpandDown } from '@mdi/js'
  import type { FullCuttleform } from '$lib/worker/config'
  import { cosmosKeyPosition, toCuttleKey } from '$lib/worker/config.cosmos'
  import { filterKeys, mapKeys } from './editor/visualEditorHelpers'
  import { keyCriticalPoints, separateSockets2D, type CriticalPoints } from '$lib/worker/geometry'
  import { intersectPolyPoly } from '$lib/worker/geometry.intersections'
  import { Vector2 } from 'three/src/math/Vector2.js'
  import type Trsf from '$lib/worker/modeling/transformation'

  export let config: FullCuttleform
  export let mode: string

  function assert<T>(t: T | undefined): T {
    if (typeof t == 'undefined') throw new Error('Expected non-undefined')
    return t
  }

  function fixUnseparated() {
    protoConfig.update((p) => {
      const trsfs: Trsf[] = []
      const sides: ('left' | 'right')[] = []
      const cpts = mapKeys(p, (k, col, c) => {
        const trsf = cosmosKeyPosition(k, col, c, p).evaluate({ flat: true })
        trsfs.push(trsf)
        sides.push(c.side)
        return keyCriticalPoints(null as any, toCuttleKey(p, c, col, k, false), trsf)
      })

      try {
        separateSockets2D(trsfs, cpts)
      } catch (e) {
        // Do nothing. The statement above has side effects
      }

      const polys = cpts.map((c) => c.map((x) => new Vector2(...x.xy())))

      return filterKeys(p, (_k, _col, _cluster, i) => {
        for (let j = 0; j < polys.length; j++) {
          if (j == i) continue
          if (sides[j] != sides[i]) continue
          if (intersectPolyPoly(polys[i], polys[j])) {
            return false
          }
        }
        return true
      })
    })
  }

  $: err = salientError($confError)
</script>

<div
  class="errorMsg"
  class:expand={$showErrorMsg}
  class:bg-red-700={!isWarning($confError)}
  class:bg-yellow-700={isWarning($confError)}
>
  {#if $showErrorMsg}<h3 class="font-bold">
      {#if $confError.length > 1}
        There are problems with the configuration.
      {:else}
        There is a problem with the configuration.
      {/if}
    </h3>
  {/if}
  {#if err.type == 'invalid'}
    <div>
      <p class="mb-2">
        In your configuration, the property <code>{err.item}</code> has the wrong data type.
      </p>
      <p class="mb-2">
        Its value was found to be <code>{JSON.stringify(err.value)}</code>, but it should be one of:
        <code>{err.valid.join(', ')}</code>.
      </p>
    </div>
  {:else if err.type == 'wrong'}
    <div>
      <p class="mb-2">
        In your configuration, the property <code>{err.item}</code> has the wrong data type.
      </p>
      <p class="mb-2">
        Its value was found to be <code>{JSON.stringify(err.value)}</code>.
      </p>
    </div>
  {:else if err.type == 'oob'}
    <div>
      <p class="mb-2">
        In your configuration, the element with value <code>{err.idx}</code> in
        <code>{err.item}</code> is out of bounds.
      </p>
      <p class="mb-2">The value must be less than <code>{err.len}</code>.</p>
    </div>
  {:else if err.type == 'exception'}
    <p class="mb-2">
      When {err.when}: <code>{err.error.message}</code>.
      {#if err.error.message.startsWith('Could not separate all sockets') && mode != 'advanced'}
        <button on:click={fixUnseparated} class="underline">Auto-fix.</button>
        If auto-fix removes too much, undo then fix the issue.
      {/if}
    </p>
  {:else if err.type == 'nan'}
    <p class="mb-2">
      One of the key positions has a value that's not a number. This often happens after an update that
      adds new configuration options, so double check the Advanced tab and make sure that every setting
      is set.
    </p>
  {:else if err.type == 'nokeys'}
    <p class="mb-2">
      You silly goose! You can't make a keyboard without keys. <br />That's like riding a snowboard
      without snow.
      <button on:click={() => window.history.back()} class="underline">Undo.</button>
    </p>
  {:else if err.type == 'missing'}
    <div>
      <p class="mb-2">
        In your configuration, the property <code>{err.item}</code> is missing.
      </p>
      {#if err.key}
        <p class="mb-2">Check the key with this configuration:</p>
        <pre class="text-xs"><code>{JSON.stringify(err.key, null, 2)}</code></pre>
      {/if}
    </div>
  {:else if err.type == 'wrongformat'}
    <div>
      <p class="mb-2">The return type in Expert mode is incorrect.</p>
      <p class="mb-2">Ensure the final lines of your code look like the following.</p>
      <pre class="text-xs"><code
          >export default &lbrace;
right: &lbrace;
...options,
keys: [...fingers, ...thumbs],
wristRestOrigin,
&rbrace;,
left: &lbrace;
...options,
keys: mirror([...fingers, ...thumbs]),
wristRestOrigin,
&rbrace;,
&rbrace;</code
        ></pre>
    </div>
  {:else if err.type == 'notEnoughPins'}
    <p class="mb-2">
      Your selected microcontroller does not have enough pins to support the keyboard. The keyboard
      requires at least {err.needed} pins, but your microcontroller has only {err.max}.
    </p>
  {:else if $showErrorMsg}
    <div class="max-h-[calc(100vh-16rem)] overflow-auto">
      {#each $confError as err}
        <div class="expandedMsg">
          {#if err.type == 'intersection'}
            {#if err.what == 'keycap' && (err.i < 0 || err.j < 0)}
              <p class="mb-2">
                One of the keycaps intersects the walls{#if err.travel}&nbsp;when pressed down {err
                    .travel[0]}mm{/if}.
              </p>
            {:else if err.what == 'keycap'}
              <p class="mb-2">
                Two of the keycaps intersect, either in their current positions or when pressed down{#if err.travel}&nbsp;with
                  {err.travel[0]}mm of travel{/if}.
              </p>
            {:else if err.what == 'part'}
              <p class="mb-2">
                Two of the parts
                {#if config && (assert(config[err.side]).keys[err.i].type == 'mx-pcb' || assert(config[err.side]).keys[err.j].type == 'mx-pcb')}
                  (switches or PCBs)
                {:else}
                  (switches)
                {/if} intersect.
              </p>
            {:else if err.what == 'socket' && (err.i < 0 || err.j < 0)}
              <p class="mb-2">
                One of the sockets intersects the walls. This is ok, but the exported model will contains
                errors and might create problems when slicing.
              </p>
            {:else if err.what == 'socket'}
              <p class="mb-2">
                Two of the key sockets intersect. This is ok, but the exported model will contain errors
                and might create problems when slicing.
              </p>
            {/if}
            <p class="mb-2">
              If you're using Advanced mode, you can try adjusting the stagger, increasing the spacing,
              or adding outwards arc to correct the issue.
              {#if err.what != 'socket'}You can also try decreasing webMinThicknessFactor in expert mode.{/if}
            </p>
            <p class="mb-2">
              If the issue is within the thumb cluster, increase the vertical and horizontal spacings in
              Advanced mode or switch to custom thumbs mode.
            </p>
          {:else if err.type == 'wallBounds'}
            <p class="mb-2">
              One of the keys sticks out past the wall boundary. The keyboard will print, but you may see
              a small hole in this spot.
            </p>
            <p>To correct this issue, try adjusting the stagger or moving the keys around.</p>
          {:else if err.type == 'samePosition'}
            <p class="mb-2">Two of keys have the exact same position. You should move one of them.</p>
          {/if}
        </div>
      {/each}
    </div>
    <div class="flex-0 pl-2 absolute top-[1rem] right-[1.5rem]">
      <button on:click={() => ($showErrorMsg = !$showErrorMsg)}
        ><Icon path={mdiArrowCollapseUp} /></button
      >
    </div>
  {:else}
    <div>
      {#if err.type == 'intersection'}
        {#if err.what == 'keycap' && (err.i < 0 || err.j < 0)}
          Keycap + Walls Intersect
        {:else if err.what == 'keycap'}
          Keycaps Intersect
        {:else if err.what == 'part'}
          Parts Intersect
        {:else if err.what == 'socket' && (err.i < 0 || err.j < 0)}
          Socket + Walls Intersect
        {:else if err.what == 'socket'}
          Sockets Intersect
        {/if}
      {:else if err.type == 'wallBounds'}
        Key Sticks Past Walls
      {:else if err.type == 'samePosition'}
        Keys have Same Position
      {/if}
      {#if $confError.length > 1}
        <br /><span class="text-sm ml-1">
          + {$confError.length - 1} more issue{#if $confError.length > 2}s{/if}
        </span>
      {/if}
    </div>
    <div class="flex-0 pl-2">
      <button on:click={() => ($showErrorMsg = !$showErrorMsg)}
        ><Icon path={mdiArrowExpandDown} /></button
      >
    </div>
  {/if}
</div>

<style>
  .errorMsg {
    --at-apply: 'absolute text-white m-4 right-[80px] rounded p-4 top-[5%] flex z-40';
  }
  .errorMsg.custom {
    --at-apply: 'top-[10%]';
  }
  .errorMsg.expand {
    --at-apply: 'top-[5%] left-0 right-0 block';
  }
  .errorMsg.expand.custom {
    --at-apply: 'top-[20%] left-0';
  }

  .expandedMsg + .expandedMsg {
    --at-apply: 'pt-2 border-t-2 border-t-white';
  }
</style>

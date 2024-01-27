<script lang="ts">
  import type { Cuttleform, CuttleKey, Geometry } from '$lib/worker/config'
  import Icon from '$lib/presentation/Icon.svelte'
  import { closestAspect, KEY_NAMES, UNIFORM } from '$lib/geometry/keycaps'
  import { PART_NAMES } from '$lib/geometry/socketsParts'
  import {
    BOARD_PROPERTIES,
    holderScrewHeight,
    holderTallScrewHeight,
  } from '$lib/geometry/microcontrollers'
  import { screwInsertHeight } from '$lib/geometry/screws'
  import * as mdi from '@mdi/js'
  import { bomMultiplier as multiplier } from '$lib/store'
  import MultiplierDropdown from './MultiplierDropdown.svelte'

  export let geometry: Geometry
  export let conf: Cuttleform

  function keycaps(c: Cuttleform, multiplier: number) {
    const caps = {}
    for (const key of c.keys) {
      if ('keycap' in key) {
        if (!caps[key.keycap.profile]) caps[key.keycap.profile] = {}
        const cap = caps[key.keycap.profile]
        const aspect = closestAspect(key.aspect)
        if (!cap[aspect])
          cap[aspect] = {
            profile: key.keycap.profile,
            aspect,
            count: 0,
            rows: {},
          }
        cap[aspect].count += multiplier
        cap[aspect].rows[key.keycap.row] = multiplier + (cap[aspect].rows[key.keycap.row] || 0)
      }
    }
    return Object.keys(caps)
      .sort()
      .flatMap((k) =>
        Object.keys(caps[k])
          .sort()
          .map((u) => caps[k][u])
      )
  }

  $: console.log(keycaps(conf, Number($multiplier)))

  function switchIcon(item: CuttleKey['type']) {
    if (item == 'ec11' || item == 'evqwgd001') return 'knob'
    if (item == 'trackball') return 'trackball'
    if (item == 'oled-128x32-0.91in-adafruit') return 'oled'
    if (item.startsWith('cirque')) return 'knob'
    return 'switch'
  }

  function sockets(c: Cuttleform, multiplier: number) {
    const sockets = {}
    for (const key of c.keys) {
      if (key.type == 'blank') continue
      if (!sockets[key.type])
        sockets[key.type] = {
          item: PART_NAMES[key.type],
          icon: switchIcon(key.type),
          count: 0,
        }
      sockets[key.type].count += multiplier
    }
    const nDiodes =
      (sockets['mx']?.count || 0) +
      (sockets['mx-better']?.count || 0) +
      (sockets['mx-pcb']?.count || 0) +
      (sockets['box']?.count || 0) +
      (sockets['choc']?.count || 0)
    const nPCB = sockets['mx-pcb']?.count || 0
    if (nDiodes - nPCB > 0)
      sockets['xdiodes'] = {
        item: '1N4148 Diodes',
        icon: 'diode',
        count: nDiodes - nPCB,
      }
    if (nPCB > 0) {
      sockets['xdiodes-pcb'] = {
        item: '1N4148 Diodes (SOD-123)',
        icon: 'diode',
        count: nPCB,
      }
      sockets['pcb'] = {
        item: 'Amoeba King PCBs',
        icon: 'pcb',
        count: sockets['mx-pcb'].count,
      }
      sockets['pcb-hotswap'] = {
        item: 'Kailh Hotswap Sockets',
        icon: 'hotswap',
        count: sockets['mx-pcb'].count,
      }
      sockets['pcb-led'] = {
        item: 'SK6812MINI-E LEDs (Optional)',
        icon: 'led',
        count: sockets['mx-pcb'].count,
      }
    }
    const nTrackball = sockets['trackball']?.count || 0
    if (nTrackball > 0) {
      sockets['trackball-dowel'] = {
        item: '3 x 8 mm Dowel Pins',
        icon: 'trackball',
        count: 3 * nTrackball,
      }
      sockets['trackball-bearing'] = {
        item: '3 x 6 x 2.5 mm Bearings',
        icon: 'trackball',
        count: 3 * nTrackball,
      }
      sockets['trackball-sensor'] = {
        item: 'PMW3360 or PMW3389 Sensors',
        icon: 'trackball',
        info: 'Supports <a class="underline" href="https://www.tindie.com/products/citizenjoe/pmw3389-motion-sensor/">these PCBs</a> from Tindie',
        count: nTrackball,
      }
    }
    return Object.keys(sockets)
      .sort()
      .map((s) => sockets[s])
  }

  function nScrewInserts(c: Cuttleform, multiplier: number) {
    const pos = geometry.screwIndices
    if (c.microcontroller) return (pos.length - 1) * multiplier
    return pos.length * multiplier
  }

  $: _nScrewInserts = nScrewInserts(conf, Number($multiplier))
</script>

<div class="text-center">
  Building for <MultiplierDropdown />
</div>

<div class="max-w-lg mx-auto md:columns-2 md:max-w-none">
  <div class="pt-2 break-inside-avoid">
    <h4 class="text-xl font-semibold mt-4 text-teal-500 dark:text-teal-300">Keys and Switches</h4>
    <ul class="mt-2">
      {#each keycaps(conf, Number($multiplier)) as k}
        <li class="item">
          <div class="icon-container"><div class="icon"><Icon size="24" name="keycap" /></div></div>
          <div class={UNIFORM.includes(k.profile) ? 'title-full' : 'title'}>
            <div>
              <span class="amount">{k.count}</span>
              <span>{k.aspect}u {KEY_NAMES[k.profile]} Keycaps</span>
            </div>
          </div>
          {#if !UNIFORM.includes(k.profile)}
            <div class="info">
              {#each Object.keys(k.rows).sort() as r}
                <span class="mr-2">R{r}: {k.rows[r]}</span>
              {/each}
            </div>
          {/if}
        </li>
      {/each}
      {#each sockets(conf, Number($multiplier)) as s}
        <li class="item">
          <div class="icon-container"><div class="icon"><Icon size="24" name={s.icon} /></div></div>
          {#if s.info}
            <div class="title">
              <span>
                <span class="amount">{s.count}</span>
                <span>{s.item}</span>
              </span>
            </div>
            <div class="info">{@html s.info}</div>
          {:else}
            <div class="title-full">
              <span>
                <span class="amount">{s.count}</span>
                <span>{s.item}</span>
              </span>
            </div>
          {/if}
        </li>
      {/each}
    </ul>
  </div>
  <div class="pt-2 break-inside-avoid">
    <h4 class="text-xl font-semibold mt-4 text-teal-500 dark:text-teal-300">Electrical</h4>
    <ul class="mt-2">
      {#if conf.microcontroller}
        <li class="item">
          <div class="icon-container">
            <div class="icon"><Icon size="24" name="microcontroller" /></div>
          </div>
          <div class="title-full">
            <div>
              <span class="amount">{$multiplier}</span>
              <span>{BOARD_PROPERTIES[conf.microcontroller].name} Boards</span>
            </div>
          </div>
        </li>
      {/if}
      {#if conf.connector == 'trrs'}
        <li class="item">
          <div class="icon-container">
            <div class="icon"><Icon size="24" path={mdi.mdiSquareCircleOutline} /></div>
          </div>
          <div class="title-full">
            <div>
              <span class="amount">{$multiplier}</span>
              <span>PJ-320A TRRS Connectors</span>
            </div>
          </div>
        </li>
      {/if}
      <li class="item">
        <div class="icon-container"><div class="icon"><Icon size="24" name="wire" /></div></div>
        <div class="title-full">
          <div>
            <span class="amount">1</span>
            <span>Spool Wire Wrap or Magnet Wire</span>
          </div>
        </div>
      </li>
      {#if conf.keys.some((k) => k.type.startsWith('cirque'))}
        <li class="item">
          <div class="icon-container"><div class="icon"><Icon size="24" name="pcb" /></div></div>
          <div class="title-full">
            <div>
              <span class="amount">1</span>
              <span>Wires/PCBs for Connecting Trackpad</span>
            </div>
          </div>
        </li>
      {/if}
    </ul>
  </div>
  <div class="pt-2 break-inside-avoid">
    <h4 class="text-xl font-semibold mt-4 text-teal-500 dark:text-teal-300">Mounting</h4>
    <ul class="mt-2">
      {#if conf.screwCountersink && conf.microcontroller && _nScrewInserts > 0 && screwInsertHeight(conf) == holderScrewHeight(conf)}
        <li class="item">
          <div class="icon-container"><div class="icon"><Icon size="24" name="screw" /></div></div>
          <div class="title">
            <span class="amount">{_nScrewInserts + 2 * Number($multiplier)}</span>
            <span>{conf.screwSize} x {screwInsertHeight(conf)} Flat Head Screws</span>
          </div>
          <div class="info">For attaching the bottom plate and microcontroller holder</div>
        </li>
        <li class="item">
          <div class="icon-container"><div class="icon"><Icon size="24" name="screw" /></div></div>
          <div class="title">
            <span class="amount">{$multiplier}</span>
            <span>{conf.screwSize} x {holderTallScrewHeight(conf)} Flat Head Screws</span>
          </div>
          <div class="info">For attaching microcontroller holder through bottom plate</div>
        </li>
      {:else}
        {#if _nScrewInserts > 0}
          <li class="item">
            <div class="icon-container">
              <div class="icon"><Icon size="24" name="screw" /></div>
            </div>
            <div class="title">
              <span class="amount">{_nScrewInserts}</span>
              <span
                >{conf.screwSize} x {screwInsertHeight(conf)}
                {#if conf.screwCountersink}Flat Head{/if} Screws</span
              >
            </div>
            <div class="info">For attaching the bottom plate</div>
          </li>
        {/if}
        {#if conf.microcontroller}
          <li class="item">
            <div class="icon-container">
              <div class="icon"><Icon size="24" name="screw" /></div>
            </div>
            <div class="title">
              <span class="amount">{2 * Number($multiplier)}</span>
              <span
                >{conf.screwSize} x {holderScrewHeight(conf)} Flat Head Screws {#if !conf.screwCountersink}(Optional){/if}</span
              >
            </div>
            <div class="info">For attaching the microcontroller holder</div>
          </li>
          <li class="item">
            <div class="icon-container">
              <div class="icon"><Icon size="24" name="screw" /></div>
            </div>
            <div class="title">
              <span class="amount">{$multiplier}</span>
              <span
                >{conf.screwSize} x {holderTallScrewHeight(conf)}
                {#if conf.screwCountersink}Flat Head{/if} Screws</span
              >
            </div>
            <div class="info">For attaching microcontroller holder through bottom plate</div>
          </li>
        {/if}
      {/if}
      {#if (_nScrewInserts > 0 || conf.microcontroller) && conf.screwType != 'tapped hole'}
        <li class="item">
          <div class="icon-container">
            <div class="icon"><Icon size="24" path={mdi.mdiCircleDouble} /></div>
          </div>
          <div class="title-full">
            <div>
              <span class="amount"
                >{_nScrewInserts + (conf.microcontroller ? 3 * Number($multiplier) : 0)}</span
              >
              <span>{conf.screwSize} <span class="capitalize">{conf.screwType}s</span></span>
            </div>
          </div>
        </li>
      {/if}
    </ul>
  </div>
  <div class="pt-2 break-inside-avoid">
    <h4 class="text-xl font-semibold mt-4 text-teal-500 dark:text-teal-300">Other Parts</h4>
    <ul class="mt-2">
      <li class="item">
        <div class="icon-container">
          <div class="icon"><Icon size="24" path={mdi.mdiPrinter3d} /></div>
        </div>
        <div class="title-full">
          <span class="amount">{$multiplier}</span>
          <span>Pair 3D Printed Components</span>
        </div>
      </li>
      <li class="item">
        <div class="icon-container">
          <div class="icon"><Icon size="24" path={mdi.mdiMoonWaxingGibbous} /></div>
        </div>
        <div class="title">
          <span class="amount">{Number($multiplier) * 4}</span>
          <span>Rubber or Silicone Feet</span>
        </div>
        <div class="info">For stopping your keyboard from sliding</div>
      </li>
      <li class="item">
        <div class="icon-container">
          <div class="icon"><Icon size="24" path={mdi.mdiEmoticonExcitedOutline} /></div>
        </div>
        <div class="title">
          <div>
            <span class="amount">1</span>
            <span>Smile and Perspiration</span>
          </div>
        </div>
        <div class="info">Building your own keyboard isn't easy</div>
      </li>
    </ul>
  </div>
</div>

<style>
  .item {
    display: grid;
    grid-template-columns: 2.5rem 1fr;
    grid-template-rows: 1.4rem 1fr;
    grid-column-gap: 1rem;
    --at-apply: 'mb-2';
  }
  .icon-container {
    grid-area: 1 / 1 / 3 / 2;
    --at-apply: 'flex items-center justify-center';
  }

  .icon {
    --at-apply: 'w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center flex-none text-teal-500 dark:text-teal-300';
  }
  .title-full {
    grid-area: 1 / 2 / 3 / 3;
    --at-apply: 'flex items-center';
  }
  .title {
    grid-area: 1 / 2 / 2 / 3;
  }
  .info {
    grid-area: 2 / 2 / 3 / 3;
    --at-apply: 'text-sm text-gray-500 dark:text-gray-400 leading-4';
  }

  .amount {
    --at-apply: 'font-bold mr-1 inline-block';
  }

  ul:empty::before {
    content: 'No items in this section';
    --at-apply: 'text-gray-500 dark:text-gray-400';
  }
</style>

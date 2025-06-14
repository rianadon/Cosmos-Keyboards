<script lang="ts">
  import { convertToMaybeCustomConnectors, type Cuttleform, type CuttleKey } from '$lib/worker/config'
  import Icon from '$lib/presentation/Icon.svelte'
  import { closestAspect, KEY_DESC, UNIFORM } from '$lib/geometry/keycaps'
  import { bomName, extraBomItems, PART_INFO, type BomItem } from '$lib/geometry/socketsParts'
  import {
    BOARD_PROPERTIES,
    holderScrewHeight,
    holderTallScrewHeight,
  } from '$lib/geometry/microcontrollers'
  import { screwInsertHeight } from '$lib/geometry/screws'
  import * as mdi from '@mdi/js'
  import type { FullGeometry } from '../viewers/viewer3dHelpers'
  import { objEntries } from '$lib/worker/util'

  export let geometry: FullGeometry

  $: conf = (geometry.unibody ?? geometry.right!).c
  $: keys = geometry.unibody
    ? geometry.unibody.c.keys
    : [...geometry.right!.c.keys, ...geometry.left!.c.keys]
  $: multiplier = Object.values(geometry).length

  function keycaps(keys: CuttleKey[]) {
    const caps: Record<any, any> = {}
    for (const key of keys) {
      if ('keycap' in key && key.keycap) {
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
        cap[aspect].count += 1
        cap[aspect].rows[key.keycap.row] = 1 + (cap[aspect].rows[key.keycap.row] || 0)
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

  $: console.log(keycaps(keys))

  function addToBom(bom: Record<any, any>, key: string, item: any) {
    if (bom[key]) {
      bom[key] = { ...bom[key], count: bom[key].count + item.count }
    } else {
      bom[key] = item
    }
  }

  function sockets(keys: CuttleKey[]) {
    const sockets: Record<any, any> = {}
    for (const key of keys) {
      if (key.type == 'blank') continue
      addToBom(sockets, key.type + bomName(key), {
        item: bomName(key),
        icon: PART_INFO[key.type].bomIcon || PART_INFO[key.type].icon || 'switch',
        count: 1,
      })
      Object.entries(extraBomItems(key)).forEach(([key, item]) =>
        addToBom(sockets, key + item.item, item)
      )
    }
    return Object.keys(sockets)
      .sort()
      .map((s) => {
        sockets[s].count = Math.ceil(sockets[s].count)
        return sockets[s]
      })
  }

  function connectorsForSide(conf: Cuttleform) {
    const conn = convertToMaybeCustomConnectors(conf)
    const nTrrs = conn.filter((c) => c.preset == 'trrs').length
    const nUSB = conn.filter((c) => c.preset == 'usb').length
    const nSecondaryUSB = Math.max(nUSB - 1, 0)
    const nCustom = conn.filter((c) => !c.preset).length
    const items: Record<string, BomItem> = {}
    if (nTrrs > 0) items['trrs'] = { item: 'PJ-320A TRRS Connectors', icon: 'trrs', count: nTrrs }
    if (nTrrs > 0) items['trrs-cable'] = { item: 'TRRS Cable', icon: 'cable', count: nTrrs / 2 }
    if (nCustom > 0) items['custom'] = { item: 'Custom Connectors', icon: 'trrs', count: nCustom }
    if (nSecondaryUSB > 0)
      items['usb'] = { item: 'USB Connectors', icon: 'usb-port', count: nSecondaryUSB }
    return items
  }

  function connectors(geometry: FullGeometry) {
    const bom: Record<string, BomItem> = {}
    Object.values(geometry).forEach((g) =>
      objEntries(connectorsForSide(g.c)).forEach(([key, item]) => addToBom(bom, key, item))
    )
    return Object.keys(bom)
      .sort()
      .map((s) => bom[s])
  }

  function nScrewInserts(geo: FullGeometry) {
    let n = 0
    for (const g of Object.values(geo)) {
      const pos = g.screwIndices
      if (g.c.microcontroller) n += pos.length - 1
      else n += pos.length
    }
    return n
  }

  function nFeet(geo: FullGeometry) {
    let n = 0
    for (const g of Object.values(geo)) {
      n += g.footIndices.length || 4
    }
    const g = Object.values(geo)[0]
    if (g.footIndices.length && g.c.wristRestLeft) n += 5
    if (g.footIndices.length && g.c.wristRestRight) n += 5
    return n
  }

  $: _nScrewInserts = nScrewInserts(geometry)
</script>

{#if geometry.right}
  <div class="text-center">The BOM includes parts for both left and right sides.</div>
{/if}

<div class="max-w-lg mx-auto md:columns-2 md:max-w-none">
  <div class="pt-2 break-inside-avoid">
    <h4 class="text-xl font-semibold mt-4 text-teal-500 dark:text-teal-300">Keys and Switches</h4>
    <ul class="mt-2">
      {#each keycaps(keys) as k}
        <li class="item">
          <div class="icon-container"><div class="icon"><Icon size="24" name="keycap" /></div></div>
          <div class={UNIFORM.includes(k.profile) ? 'title-full' : 'title'}>
            <div>
              <span class="amount">{k.count}</span>
              <span>{k.aspect}u {KEY_DESC[k.profile].name} Keycaps</span>
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
      {#each sockets(keys) as s}
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
              <span class="amount">{multiplier}</span>
              <span>{BOARD_PROPERTIES[conf.microcontroller].name} Boards</span>
            </div>
          </div>
        </li>
      {/if}
      {#each connectors(geometry) as conn}
        <li class="item">
          <div class="icon-container">
            <div class="icon"><Icon size="24" name={conn.icon} /></div>
          </div>
          <div class="title-full">
            <div>
              <span class="amount">{Math.round(conn.count)}</span>
              <span>{conn.item}</span>
            </div>
          </div>
        </li>
      {/each}
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
            <span class="amount">{_nScrewInserts + 2 * multiplier}</span>
            <span>{conf.screwSize} x {screwInsertHeight(conf)} Flat Head Screws</span>
          </div>
          <div class="info">For attaching the bottom plate and microcontroller holder</div>
        </li>
        <li class="item">
          <div class="icon-container"><div class="icon"><Icon size="24" name="screw" /></div></div>
          <div class="title">
            <span class="amount">{multiplier}</span>
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
              <span class="amount">{2 * multiplier}</span>
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
              <span class="amount">{multiplier}</span>
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
              <span class="amount">{_nScrewInserts + (conf.microcontroller ? 3 * multiplier : 0)}</span>
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
          <span class="amount">1</span>
          <span>Pair 3D Printed Components</span>
        </div>
      </li>
      <li class="item">
        <div class="icon-container">
          <div class="icon"><Icon size="24" path={mdi.mdiMoonWaxingGibbous} /></div>
        </div>
        <div class="title">
          <span class="amount">{nFeet(geometry)}</span>
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

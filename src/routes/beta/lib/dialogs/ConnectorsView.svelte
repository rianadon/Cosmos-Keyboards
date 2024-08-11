<script lang="ts">
  import Icon from '$lib/presentation/Icon.svelte'
  import Select from '$lib/presentation/Select.svelte'
  import type { ConnectorMaybeCustom, CustomConnector } from '$lib/worker/config.cosmos'
  import {
    mdiAudioInputStereoMinijack,
    mdiBorderRadius,
    mdiTrashCan,
    mdiUnfoldMoreHorizontal,
    mdiUnfoldMoreVertical,
    mdiUsbPort,
    mdiVectorRectangle,
  } from '@mdi/js'
  import DecimalInput from '../editor/DecimalInput.svelte'
  import Checkbox from '$lib/presentation/Checkbox.svelte'

  export let connectors: ConnectorMaybeCustom[]

  const sortConnectors = (a: ConnectorMaybeCustom, b: ConnectorMaybeCustom) => {
    const v = (conn: ConnectorMaybeCustom) => {
      if (conn.preset == 'trrs') return 0
      if (!conn.preset) return 1
      return 2
    }
    return v(a) - v(b)
  }

  function deleteConnector(c: ConnectorMaybeCustom) {
    const newConnectors = [...connectors]
    newConnectors.splice(newConnectors.indexOf(c), 1)
    connectors = newConnectors
  }

  function addConnector() {
    const newConnector: ConnectorMaybeCustom = { preset: 'usb', size: 'average' }
    connectors = [...connectors, newConnector].sort(sortConnectors)
  }

  function updateConnector(
    c: ConnectorMaybeCustom,
    fn: (c: ConnectorMaybeCustom) => void | ConnectorMaybeCustom
  ) {
    const newConnectors = JSON.parse(JSON.stringify(connectors))
    const newConn = newConnectors[connectors.indexOf(c)]
    const replacement = fn(newConn)
    if (replacement && typeof replacement == 'object') newConnectors[connectors.indexOf(c)] = replacement
    connectors = newConnectors.sort(sortConnectors)
  }

  function initConnector(c: ConnectorMaybeCustom, ev: Event) {
    let newPreset: any = (ev.target as HTMLInputElement).value.toLowerCase()
    if (newPreset == 'custom') newPreset = undefined

    updateConnector(c, (newConn) => {
      if (newPreset == 'usb') return { preset: 'usb', size: 'average' }
      if (!newPreset) return { width: 12, height: 7, x: 0, y: 5, radius: 0 }
      return { preset: newPreset }
    })
  }

  function setConnectorSize(c: ConnectorMaybeCustom, ev: Event) {
    updateConnector(c, (c) => {
      if (c.preset != 'usb') return
      c.size = (ev.target as HTMLInputElement).value.toLowerCase() as any
    })
  }

  function changeCustom(c: ConnectorMaybeCustom, field: 'x' | 'y' | 'width' | 'height' | 'radius') {
    return (ev: CustomEvent) =>
      updateConnector(c, (conn) => {
        if (conn.preset) return
        conn[field] = ev.detail
      })
  }

  function icon(c: ConnectorMaybeCustom) {
    if (c.preset == 'usb') return mdiUsbPort
    if (c.preset == 'trrs') return mdiAudioInputStereoMinijack
    return mdiVectorRectangle
  }

  const setCustomX = (c: ConnectorMaybeCustom, e: Event) =>
    updateConnector(c, (c) => {
      if (!c.preset) return
      c.x = (e.target as HTMLInputElement).checked ? 0 : undefined
    })
</script>

<ul class="my-4 text-left">
  {#each connectors as c}
    <li class="bg-slate-200/50 dark:bg-slate-900/50 py-1 pl-2 pr-2 rounded-2 my-2 flex items-center">
      <Icon size="20" class="text-teal-600" path={icon(c)} />
      <div>
        <div class="flex items-center">
          <Select class="w-28" value={c.preset || 'custom'} on:change={(e) => initConnector(c, e)}>
            <option value="trrs">TRRS</option>
            <option value="usb">USB</option>
            <option value="custom">Custom</option>
          </Select>
          {#if c.preset == 'usb'}
            <div class="ml-2" />
            Size: <Select class="w-28" value={c.size} on:change={(e) => setConnectorSize(c, e)}>
              <option value="slim">Slim</option>
              <option value="average">Average</option>
              <option value="big">Big</option>
            </Select>
          {/if}
          {#if c.preset}
            <!-- svelte-ignore a11y-label-has-associated-control -->
            <label class="flex items-center ml-2">
              <Checkbox basic value={typeof c.x != 'undefined'} on:change={(e) => setCustomX(c, e)} />
              Custom Position
            </label>
          {/if}
        </div>
        {#if !c.preset}
          <div class="pl-4 mt-2">
            <div class="flex items-center mb-1">
              <Icon name="expand-horizontal" class="text-teal-600 mr-2  " />
              <span class="inline-block w-20">Width:</span>
              <DecimalInput class="w-24" value={c.width} on:change={changeCustom(c, 'width')} />
              <Icon name="expand-vertical" class="text-teal-600 mr-2 ml-4" />
              <span class="inline-block w-20">Height:</span>
              <DecimalInput class="w-24" value={c.height} on:change={changeCustom(c, 'height')} />
            </div>
            <div class="flex items-center mb-1">
              <Icon path={mdiUnfoldMoreVertical} class="text-teal-600 mr-2  " />
              <span class="inline-block w-20">Position X:</span>
              <DecimalInput class="w-24" value={c.x} on:change={changeCustom(c, 'x')} />
              <Icon path={mdiUnfoldMoreHorizontal} class="text-teal-600 mr-2 ml-4" />
              <span class="inline-block w-20">Position Y:</span>
              <DecimalInput class="w-24" value={c.y} on:change={changeCustom(c, 'y')} />
            </div>
            <div class="flex items-center mb-1">
              <Icon path={mdiBorderRadius} class="text-teal-600 mr-2  " />
              <span class="inline-block w-20">Radius:</span>
              <DecimalInput class="w-24" value={c.radius} on:change={changeCustom(c, 'radius')} />
            </div>
          </div>
        {:else if typeof c.x !== 'undefined'}
          <div class="pl-4 flex items-center mt-2 mb-1">
            <Icon path={mdiUnfoldMoreVertical} class="text-teal-600 mr-2  " />
            Position X: <DecimalInput
              class="w-24"
              value={c.x}
              on:change={(e) => updateConnector(c, (c) => (c.x = e.detail))}
            />
          </div>
        {/if}
      </div>
      <div class="flex-1 flex justify-end gap-1">
        <button class="button-thin" on:click={() => deleteConnector(c)}
          ><Icon path={mdiTrashCan} /></button
        >
      </div>
    </li>
  {/each}
  <button class="button mx-auto" on:click={() => addConnector()}>Add</button>
</ul>

<style>
  .button {
    --at-apply: 'bg-slate-300 dark:bg-gray-900  hover:bg-teal-500 dark:hover:bg-pink-700 dark:text-white font-bold py-2 px-4 rounded focus:outline-none border border-transparent focus:border-pink-500 flex items-center gap-2';
  }
  .button2 {
    --at-apply: 'bg-slate-300 dark:bg-purple-900  hover:bg-teal-500 dark:hover:bg-pink-700 dark:text-white font-bold py-1 px-1 rounded focus:outline-none border border-transparent focus:border-pink-500 flex items-center gap-2';
  }
  .button-thin {
    --at-apply: 'bg-slate-300 dark:bg-gray-900  hover:bg-teal-500 dark:hover:bg-pink-700 dark:text-white font-bold py-1 px-1 rounded focus:outline-none border border-transparent focus:border-pink-500 flex items-center gap-2';
  }
</style>

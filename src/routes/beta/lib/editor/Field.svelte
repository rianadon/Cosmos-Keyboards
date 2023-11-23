<script lang="ts">
  import type { FieldSchema } from './schema'
  import AngleInput from './AngleInput.svelte'
  import FloatInput from './FloatInput.svelte'
  import DecimalInput from './DecimalInput.svelte'
  import Popover from 'svelte-easy-popover'
  import Icon from '$lib/presentation/Icon.svelte'
  import Checkbox from '$lib/presentation/Checkbox.svelte'
  import * as mdi from '@mdi/js'
  import { fade } from 'svelte/transition'
  import { hasPro } from '@pro'

  export let schema: FieldSchema
  export let value: any

  let referenceElement: HTMLElement
  let referenceElementPM: HTMLElement

  function nonGroups(options: Options) {
    return options.filter((o) => !o.group)
  }

  type Options = Exclude<FieldSchema['nOptions'], undefined>
  interface OptionGroup {
    label: string
    options: Options
  }

  function groups(options: Options) {
    const groups: OptionGroup[] = []
    for (const opt of options) {
      if (!opt.group) continue
      let group = groups.find((g) => g.label == opt.group)
      if (!group) {
        group = { label: opt.group, options: [] }
        groups.push(group)
      }
      group.options.push(opt)
    }
    return groups
  }
</script>

{#if !schema.pro || hasPro}
  <!-- svelte-ignore a11y-label-has-associated-control -->
  <label class="my-2 flex items-center">
    <div class="w-8 flex-none text-teal-700 dark:text-teal-100">
      <Icon name={schema.icon} />
    </div>
    <span class="block w-72"
      >{schema.name}
      {#if schema.help}
        <div class="s-help" bind:this={referenceElement}>
          <Icon path={mdi.mdiHelpCircle} size="20px" />
        </div>
        <Popover
          triggerEvents={['hover', 'focus']}
          {referenceElement}
          placement="top"
          spaceAway={4}
        >
          <div
            class="rounded bg-gray-200 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 px-2 py-1 mx-2"
            in:fade={{ duration: 100 }}
            out:fade={{ duration: 250 }}
          >
            {schema.help}
          </div>
        </Popover>
      {/if}
      {#if schema.plusminus}
        <span class="text-teal-500 dark:text-teal-400" bind:this={referenceElementPM}>
          <Icon class="inline-block" size="16" path={mdi.mdiPlusMinus} />
        </span>
        <Popover
          triggerEvents={['hover', 'focus']}
          referenceElement={referenceElementPM}
          placement="top"
          spaceAway={4}
        >
          <div
            class="rounded bg-gray-200 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 px-2 py-1 mx-2"
            in:fade={{ duration: 100 }}
            out:fade={{ duration: 250 }}
          >
            Setting this field positive or negative produces good designs
          </div>
        </Popover>
      {/if}
      {#if schema.pro}
        <span class="text-teal-500 dark:text-teal-400 font-bold ml-2">PRO</span>
      {/if}
    </span>
    {#if schema.type === 'angle'}
      <AngleInput bind:value on:change />
    {:else if schema.type === 'decimal'}
      <DecimalInput class="mx-2 px-2 w-44" bind:value on:change units={schema.mm ? 'mm' : ''} />
    {:else if schema.type === 'float'}
      <FloatInput class="mx-2 px-2 w-44" bind:value on:change />
    {:else if schema.type == 'int'}
      <input
        class="input px-2"
        type="number"
        min={schema.min}
        max={schema.max}
        bind:value
        on:change
      />
    {:else if schema.type === 'bool'}
      <Checkbox bind:value on:change />
    {:else if schema.options}
      <div class="inline-block relative">
        <select class="input pl-2 pr-8" bind:value on:change>
          {#each schema.options as { value, name }}
            <option {value}>{name}</option>
          {/each}
        </select>
        <div
          class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-700 dark:text-gray-100"
        >
          <Icon path={mdi.mdiChevronDown} size="20px" />
        </div>
      </div>
    {:else if schema.nOptions}
      <div class="inline-block relative">
        <select class="input pl-2 pr-8" bind:value on:change>
          {#each nonGroups(schema.nOptions) as { n, name }}
            <option value={n}>{name}</option>
          {/each}
          {#each groups(schema.nOptions) as group}
            <optgroup label={group.label}>
              {#each group.options as { n, name }}
                <option value={n}>{name}</option>
              {/each}
            </optgroup>
          {/each}
        </select>
        <div
          class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-700 dark:text-gray-100"
        >
          <Icon path={mdi.mdiChevronDown} size="20px" />
        </div>
      </div>
    {:else}
      <input class="input px-2" bind:value />
    {/if}
  </label>
{/if}

<style>
  .input {
    --at-apply: 'focus:border-teal-500 border border-transparent text-gray-700 focus:outline-none';
    --at-apply: 'border-gray-200 dark:border-transparent bg-gray-100 dark:bg-gray-700 dark:text-gray-100';
    --at-apply: 'appearance-none w-44 rounded mx-2';
    --at-apply: 'text-ellipsis';
  }
</style>

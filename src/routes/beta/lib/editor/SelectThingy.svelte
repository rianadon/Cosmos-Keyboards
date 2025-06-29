<script lang="ts">
  import { createSelect, createSync, melt, type SelectOptionProps } from '@melt-ui/svelte'
  import Icon from '$lib/presentation/Icon.svelte'
  import { mdiCheck, mdiChevronDown, mdiChevronUp } from '@mdi/js'
  import { createEventDispatcher, SvelteComponent, type ComponentType } from 'svelte'

  type Option = { key: string; label: string }

  let syncing = false
  const dispatch = createEventDispatcher()
  function onSelectedChange({ next }: { next: any }) {
    if (syncing) return next
    dispatch('change', next.value)
    return next
  }

  export let options: Option[] | Record<string, Option[]>
  const allOptions = Array.isArray(options) ? options : Object.values(options).flat()

  const toOption = (option: Option | undefined): SelectOptionProps<string> =>
    option
      ? { value: option.key, label: option.label, disabled: false }
      : { value: '', label: '', disabled: true }

  export let value: string
  export let clazz: string = ''
  export let pink = false

  const {
    elements: { menu, trigger, option, group, groupLabel },
    states: { open, selectedLabel, selected },
    helpers: { isSelected },
  } = createSelect<string>({
    forceVisible: true,
    onSelectedChange,
    positioning: {
      placement: 'bottom-start',
      gutter: -30,
      fitViewport: true,
    },
  })

  // This DX is pretty bad.
  const sync = createSync({ selected })

  function onValueChange(val: string) {
    syncing = true
    sync.selected(toOption(allOptions.find((opt) => opt.key == val)), (v) => v && (value = v.value))
    syncing = false
  }
  $: onValueChange(value)

  export let component: ComponentType<SvelteComponent<{ option: Option }>>
  export let labelComponent:
    | ComponentType<SvelteComponent<{ option: { label?: string; value: string } }>>
    | undefined = undefined
  export let minWidth = 380

  export { clazz as class }
</script>

<div class="relative">
  <button use:melt={$trigger} class={clazz || 's-input pl-2 pr-8 truncate text-start'}>
    {#if labelComponent && $selected}
      <svelte:component this={labelComponent} option={$selected} />
    {:else}
      {$selectedLabel || 'Choose One'}
    {/if}
  </button>
  <div class="absolute right-4 top-1/2 z-10 -translate-y-1/2 pointer-events-none">
    {#if $open}
      <Icon path={mdiChevronUp} size="20px" />
    {:else}
      <Icon path={mdiChevronDown} size="20px" />
    {/if}
  </div>
</div>
{#if $open}
  <!-- transition:fly={{ duration: 100, y: -5 }} -->
  <!-- svelte-ignore a11y-no-noninteractive-tabindex -->
  <div
    class="z-10 ml--6 flex flex-col gap-0 overflow-y-auto dark:bg-gray-700 px-2 py-2 rounded-md shadow shadow-gray-800/30 dark:shadow-black/30"
    class:bg-gray-100={!pink}
    class:bg-[#EFE8FF]={pink}
    style="min-width: {minWidth}px"
    use:melt={$menu}
  >
    {#if Array.isArray(options)}
      {#each options as opt}
        <div
          use:melt={$option(toOption(opt))}
          class="li relative cursor-pointer scroll-my-2 rounded-md
        hover:bg-pink-100
          data-[disabled]:opacity-50"
          class:selected={$isSelected(opt.key)}
        >
          {#if $isSelected(opt.key)}
            <div class="check">
              <Icon path={mdiCheck} size="1em" />
            </div>
          {/if}
          <svelte:component this={component} option={opt} />
        </div>
      {/each}
    {:else}
      {#each Object.entries(options) as [key, arr]}
        <div use:melt={$group(key)}>
          <div class="py-0.5 pl-4 pr-4 font-semibold opacity-50" use:melt={$groupLabel(key)}>
            {key}
          </div>
          {#each arr as opt}
            <div
              use:melt={$option(toOption(opt))}
              class="li relative cursor-pointer scroll-my-2 rounded-md
        hover:bg-pink-100
          data-[disabled]:opacity-50"
              class:selected={$isSelected(opt.key)}
            >
              {#if $isSelected(opt.key)}
                <div class="check">
                  <Icon path={mdiCheck} size="1em" />
                </div>
              {/if}
              <svelte:component this={component} option={opt} />
            </div>
          {/each}
        </div>
      {/each}
    {/if}
  </div>
{/if}

<style>
  .check {
    --at-apply: 'absolute left-1 top-1/2';
    translate: 0 calc(-50% + 1px);
  }
  .selected {
    --at-apply: 'bg-teal-500/50';
  }
  .li:not(.selected) {
    --at-apply: 'data-[highlighted]:bg-pink-200 data-[highlighted]:text-pink-900';
  }
</style>

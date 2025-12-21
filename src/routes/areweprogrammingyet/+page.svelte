<script>
  import { base } from '$app/paths'
  import Icon from '$lib/presentation/Icon.svelte'
  import { mdiCheckCircle, mdiCloseCircle } from '@mdi/js'
  import Header from '$lib/Header.svelte'
  import { page } from '$app/stores'
  import { browser } from '$app/environment'

  const statusByPlatform = {
    QMK: [
      { text: 'Auto-generated matrix mapping', complete: true },
      { text: 'Use keys in Cosmos as the keymap', complete: true },
      { text: 'Support for Via', complete: true },
      { text: 'GitHub Actions for building', complete: true },
      { text: 'Generate code for encoders', complete: true },
      { text: 'Generate code for trackballs', complete: true },
      { text: 'Generate code for Cirque trackpads', complete: true },
      { text: 'Generate code for displays', complete: true },
      { text: 'Generate code for Procyon trackpads', complete: true },
      { text: 'Generate code for Azoteq trackpads', complete: true },
      { text: 'Generate code for joysticks', complete: false },
      { text: 'Support for Vial', complete: false },
    ],
    ZMK: [
      { text: 'Auto-generated matrix mapping', complete: true },
      { text: 'Use keys in Cosmos as the keymap', complete: true },
      { text: 'GitHub Actions for building', complete: true },
      { text: 'Generate code for encoders', complete: true },
      { text: 'Generate code for trackballs', complete: true },
      { text: 'Generate code for Cirque trackpads', complete: true },
      { text: 'Support for ZMK studio', complete: true },
      { text: 'Generate code for displays', complete: true },
      { text: 'Generate code for Procyon trackpads', complete: false },
      { text: 'Generate code for Azoteq trackpads', complete: false },
      { text: 'Generate code for joysticks', complete: false },
    ],
  }

  $: embedded = browser && $page.url.searchParams.has('embed')
</script>

<svelte:head>
  <title>Are we Programming Yet? • Cosmos Keyboards</title>
  <link rel="canonical" href="https://ryanis.cool/cosmos/" />
  <link rel="icon" href="{base}/favicon.png" />
</svelte:head>

<svelte:body class="bg-brand-dark font-urbanist" />

{#if !embedded}
  <Header />
{/if}

<main class="pt-10 py-24">
  <h1 class="text-5xl sm:text-6xl font-bold text-brand-pink mb-6 text-center">
    Are we Programming yet?
  </h1>

  <p
    class="text-lg sm:text-xl text-center max-w-3xl mx-auto mb-20 text-gray-300"
    class:mb-10!={embedded}
  >
    Cosmos can now automatically generate your keyboard firmware! See below for what's currently
    supported, and make sure to read the
    <a
      href="{base}/docs/firmware/"
      class="text-brand-pink underline hover:text-brand-lightpink transition-colors">documentation</a
    >
    to learn more.
  </p>

  <div class="grid grid-cols-1 md:grid-cols-2 gap-20 max-w-4xl mx-auto px-4 sm:px-6">
    {#each Object.entries(statusByPlatform) as [platform, items]}
      <section>
        <h2
          class="text-3xl sm:text-4xl font-semibold text-brand-green mb-6 sm:mb-10"
          class:mb-4!={embedded}
        >
          {platform}
        </h2>
        <ul class="space-y-4 sm:space-y-6">
          {#each items as item}
            <li class="flex items-start text-lg sm:text-xl">
              <span
                class={`mr-4 mt-1 ${item.complete ? 'text-brand-green' : 'text-brand-lightpink'}`}
                aria-label={item.complete ? 'Completed' : 'Incomplete'}
              >
                <Icon path={item.complete ? mdiCheckCircle : mdiCloseCircle} size="24px" />
              </span>
              <span class={item.complete ? 'text-white' : 'text-gray-500'}>
                {item.text}
              </span>
            </li>
          {/each}
        </ul>
      </section>
    {/each}
  </div>
</main>

<script lang="ts">
  import Icon from '$lib/presentation/Icon.svelte'
  import { mdiFileUploadOutline } from '@mdi/js'

  // @ts-ignore
  import confetti from 'canvas-confetti'

  let fileInput: HTMLInputElement
  let error: string | undefined = undefined
  let recovered: string | undefined = undefined
  let isSTEP = false
  let dragging = false

  async function parseFile(file: File) {
    const array = new Uint8Array(await file.arrayBuffer())
    isSTEP = array[0] == 0x49 && array[1] == 0x53 && array[2] == 0x4f // Starts with "ISO"
    if (isSTEP) {
      const text = await file.text()
      const name = text.match(/FILE_NAME\('(.*?)'/)
      recovered = name ? name[1] : ''
    } else {
      let str = ''
      for (let i = 132; i < array.length; i += 50) {
        if (array[i] == 0) break
        str += String.fromCharCode(array[i])
        if (array[i + 1] == 0) break
        str += String.fromCharCode(array[i + 1])
      }
      recovered = str
    }
  }

  function onFile(file: File) {
    error = undefined
    parseFile(file).catch((e) => {
      error = 'Error reading file: ' + e
    })
  }

  function dropHandler(ev: DragEvent) {
    dragging = false
    const transfer = ev.dataTransfer
    if (!transfer) return

    if (transfer.items) {
      ;[...transfer.items].forEach((item) => {
        if (item.kind === 'file') {
          const file = item.getAsFile()
          if (file) onFile(file)
        }
      })
    } else {
      ;[...transfer.files].forEach(onFile)
    }
  }

  function openHandler(ev: Event) {
    if (fileInput.files) [...fileInput.files].forEach(onFile)
  }

  function formatURL(url: string) {
    if (url.length < 50) return url
    return url.substring(0, 40) + '…' + url.substring(url.length - 10)
  }

  $: filetype = isSTEP ? 'STEP' : 'STL'

  $: if (recovered && recovered.startsWith('http')) {
    confetti({
      particleCount: 100,
      spread: 150,
      origin: { y: 0.95 },
      gravity: 1.5,
    })
  }
</script>

<div class="my-2 text-center">
  {#if error}
    <p class="bg-red-300 rounded inline-block px-4 py-1 my-2">{error}</p>
  {/if}
  <br />
  <div
    class="bg-gray-100 w-full h-52 max-w-100 inline-flex flex-col items-center justify-center rounded-2 mb-4"
    class:bg-teal-200={dragging}
    on:drop|preventDefault={dropHandler}
    on:dragover|preventDefault={() => (dragging = true)}
    on:dragleave={() => (dragging = false)}
    on:dragexit={() => (dragging = false)}
  >
    <Icon path={mdiFileUploadOutline} size="2rem" class="text-gray-700" />
    <p class="mt-4 mb-1">Drag your STL or STEP file here</p>
    <p class="text-sm">
      or <button class="button" on:click={() => fileInput.click()}>choose a file</button> to analyze
    </p>
    <input type="file" class="hidden" bind:this={fileInput} on:change={openHandler} />
  </div>
  {#if typeof recovered !== 'undefined'}
    <div>
      {#if recovered.length && recovered.startsWith('http')}
        <p class="inline-block bg-pink-100 rounded-1 px-8 py-2">
          Your recovered link is <a href={recovered}>{formatURL(recovered)}</a>.
        </p>
      {:else if recovered.length}
        <p class="mb-2">The embedded data in the {filetype} file isn't a URL. Instead, it's:</p>
        <div class="font-mono bg-gray-100 max-w-prose break-all mx-auto rounded text-sm">
          {recovered}
        </div>
      {:else}
        <p class="mx-auto max-w-prose mb-2 text-red-600">
          This {filetype} file doesn't have an embedded URL.
        </p>
        {#if !isSTEP}
          <p class="mx-auto max-w-prose text-red-600 text-sm">
            Either the URL was too long to fit in the file or it was created from an earlier version
            of Cosmos. Try using the STL file for the case.
          </p>
        {/if}
      {/if}
    </div>
  {/if}
</div>

<style>
  a[href] {
    --at-apply: 'text-pink-500 dark:text-pink-400 hover:underline';
  }

  .button {
    --at-apply: 'hover:text-teal-500 hover:dark:text-teal-400 underline';
  }
</style>

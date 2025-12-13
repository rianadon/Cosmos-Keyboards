<script lang="ts">
  import type monaco from 'monaco-editor'
  import { onDestroy, onMount } from 'svelte'
  import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
  import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'
  import { type FullCuttleform, newFullGeometry, newGeometry } from '$lib/worker/config'
  import { toCode } from './toCode'
  import { serializeEditor } from '../serialize'
  import { WorkerPool } from '../workerPool'
  import ETrsf from '$lib/worker/modeling/transformation-ext'
  import { clickedKey, codeError, confError, hoveredKey, protoConfig } from '$lib/store'
  import libSource from '$target/editorDeclarations.d.ts?raw'
  import type { CosmosKeyboard } from '$lib/worker/config.cosmos'

  export let cosmosConf: CosmosKeyboard
  export let darkMode: boolean

  let element: HTMLElement | null = null
  let editor: monaco.editor.IStandaloneCodeEditor
  let Monaco: typeof import('monaco-editor')
  let content: string
  export let hashContent: string | undefined
  export let initialContent: string | undefined
  let tooLong = false

  export let conf: FullCuttleform
  $: if (content) run(content)
  $: Monaco && Monaco.editor.setTheme(darkMode ? 'cuttleform-dark' : 'vs')

  const pool = new WorkerPool<typeof import('$lib/runner/api')>(1, () => {
    return new Worker(new URL('$lib/runner?worker', import.meta.url), { type: 'module' })
  })

  async function arun(content: string) {
    const { newConf, err } = await pool.executeNow((w) => w.run(content))
    if (err) {
      codeError.set(err)
      return
    }
    codeError.set(null)
    if (JSON.stringify(newConf) != JSON.stringify(conf)) {
      if (!newConf || (!newConf.unibody && (!newConf.left || !newConf.right))) {
        confError.set([{ type: 'wrongformat', side: 'right' }])
        return
      }
      try {
        for (const conf of Object.values(newConf)) {
          // Check that we can do some simple stuff
          for (const k of conf.keys) k.position = new ETrsf(k.position.history)
          newGeometry(conf).keyHolesTrsfs
        }
      } catch (err) {
        codeError.set(err as Error)
        return
      }
      conf = newConf!
    }
  }

  function run(content: string) {
    arun(content).catch((e) => console.warn(e))
  }
  const LIB_URI = 'ts:filename/definitions.d.ts'

  function updateHash(content: string) {
    initialContent = content
    hashContent = serializeEditor(content)
    tooLong = hashContent.length >= 3000
    if (tooLong) {
      console.log('hash length is', hashContent.length)
      hashContent = undefined
    }
  }

  onMount(async () => {
    // @ts-ignore
    self.MonacoEnvironment = {
      getWorker: function (_moduleId: any, label: string) {
        if (label === 'typescript' || label === 'javascript') {
          return new tsWorker()
        }
        return new editorWorker()
      },
    }

    Monaco = (await import('./customMonaco')).default
    Monaco.languages.typescript.typescriptDefaults.addExtraLib(libSource, LIB_URI)

    Monaco.editor.defineTheme('cuttleform-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#1F2938',
      },
    })

    const initialCode = initialContent || toCode(cosmosConf)
    updateHash(initialCode)
    protoConfig.set(undefined as any)
    clickedKey.set(null)
    hoveredKey.set(null)
    editor = Monaco.editor.create(element!, {
      value: initialCode,
      language: 'typescript',
    })

    // Wait for typescript to initialize, then fetch the worker
    let worker:
      | ((...uris: monaco.Uri[]) => Promise<monaco.languages.typescript.TypeScriptWorker>)
      | null = null
    for (let i = 0; i < 100; i++) {
      try {
        worker = await Monaco.languages.typescript.getTypeScriptWorker()
        break
      } catch (e) {
        await new Promise((r) => setTimeout(r, 100))
      }
    }
    if (!worker) throw new Error('Timed out waiting for TypeScript to initialize.')
    const model = editor.getModel()!
    const client = await worker(model.uri)

    model.onDidChangeContent(() => {
      console.log('change')
      client.getEmitOutput(model.uri.toString()).then((e) => {
        content = e.outputFiles[0].text
        updateHash(editor.getValue())
      })
    })

    client.getEmitOutput(model.uri.toString()).then((e) => {
      content = e.outputFiles[0].text
    })
  })

  onDestroy(() => {
    editor.dispose()
    pool.reset()
  })
</script>

{#if tooLong}
  <p class="mb-4 mt-2">Your code will <b>NOT</b> be saved! It is too long to fit in the URL.</p>
{/if}

<p class="mb-1 mt-2 text-gray-500 dark:text-gray-300">
  Expert mode allows you to fully configure any part of your keyboard. Read <a href="docs/expert/"
    >the documentation</a
  > to learn how to use this mode.
</p>
<p class="mb-4">
  <b>NEW!</b>
  <span class="text-gray-500 dark:text-gray-300"
    >Switch to Basic/Advanced to continue editing this keyboard.</span
  >
</p>
<div bind:this={element} class="h-[30rem] w-[32rem]" />

<style>
  a[href]:not(.inline-block) {
    --at-apply: 'text-teal-500 dark:text-teal-400';
  }

  a[href]:not(.inline-block):hover {
    text-decoration: underline;
  }
</style>

<script lang="ts">
  import { fade } from 'svelte/transition'
  import Login from './lib/Login.svelte'
  import Viewer3D from './lib/viewers/Viewer3D.svelte'
  import Thick3D from './lib/viewers/ViewerThickness.svelte'
  import ViewerLayout from './lib/viewers/ViewerLayout.svelte'
  import ViewerMatrix from './lib/viewers/ViewerMatrix.svelte'
  import ViewerBottom from './lib/viewers/ViewerBottom.svelte'
  import ViewerTiming from './lib/viewers/ViewerTiming.svelte'
  import KeyboardMesh from '$lib/3d/KeyboardMesh.svelte'
  import Popover from 'svelte-easy-popover'
  import Icon from '$lib/presentation/Icon.svelte'
  import Checkbox from '$lib/presentation/Checkbox.svelte'
  import * as mdi from '@mdi/js'
  import { boundingSize, fromGeometry } from '$lib/loaders/geometry'
  import { estimateFilament, SUPPORTS_DENSITY } from './lib/filament'
  import * as flags from '$lib/flags'
  import { trackEvent } from '$lib/telemetry'
  import Performance from './lib/Performance.svelte'

  import UrlView from './lib/dialogs/URLView.svelte'
  import BomView from './lib/dialogs/BomView.svelte'
  import KleView from './lib/dialogs/KleView.svelte'
  import cuttleform from '$assets/cuttleform.json'
  import Dialog from './lib/dialogs/Dialog.svelte'
  import Footer from './lib/Footer.svelte'
  import Editor from './lib/editor/CodeEditor.svelte'
  import Preset from '$lib/presentation/Preset.svelte'
  import FilamentChart from './lib/FilamentChart.svelte'
  import DarkTheme from './lib/DarkTheme.svelte'
  import { serialize, deserialize } from './lib/serialize'

  import { download } from './lib/browser'
  import { WorkerPool, type TaskError } from './lib/workerPool'
  import {
    newGeometry,
    type Cuttleform,
    type CuttleformProto,
    type Geometry,
  } from '$lib/worker/config'
  import { checkConfig, isPro, type ConfError, isRenderable } from '$lib/worker/check'
  import VisualEditor from './lib/editor/VisualEditor.svelte'
  import { Vector3, type BufferGeometry } from 'three'
  import { estimatedCenter } from '$lib/worker/geometry'
  import { codeError, flip, protoConfig, user, theme, showHand, stiltsMsg } from '$lib/store'
  import { onDestroy } from 'svelte'
  import { browser } from '$app/environment'
  import { hasPro } from '@pro'
  import GlbExport from './lib/GlbExport.svelte'

  let supportGeometries: BufferGeometry[] = []
  let center = [-35.510501861572266, -17.58449935913086, 35.66889877319336] as [
    number,
    number,
    number
  ]
  let size = new Vector3(140, 120, 100)
  let filament
  let referenceElement
  let referenceElementTools
  let referenceElementStitch
  let darkMode: boolean

  let proOpen = false
  let editorContent: string
  let hideWall = false

  // @ts-ignore
  let state: { keyboard: string; options: CuttleformProto } = deserialize(
    browser ? location.hash.substring(1) : '',
    cuttleform
  )
  let initialEditorContent = state.content

  function onHashChange() {
    console.log('change')
    //  state = deserialize(location.hash.substring(1), cuttleform);
  }

  let logs = []

  let ocError: TaskError | undefined
  let modelOpacity = 1
  let confError: ConfError | undefined
  let showSupports = false
  let showAllFormats = false

  let mode = state.content ? 'advanced' : 'basic'
  let viewer = '3d'
  let transparency = 95
  let errorMsg = false
  $: cTransparency = showSupports ? 0 : transparency
  $: plateTopOpacity = Math.pow(
    plateBotBuf
      ? Math.min(cTransparency / 50, Math.pow(cTransparency / 100, 0.2))
      : cTransparency / 100,
    2
  )
  $: plateScrewOpacity = Math.pow(
    plateBotBuf ? Math.min(cTransparency / 50, 1) : cTransparency / 100,
    2
  )

  let downloading = false
  let urlView = false
  let bomView = false
  let kleView = false

  const pool = new WorkerPool<typeof import('$lib/worker/api')>(4, () => {
    return new Worker(new URL('$lib/worker?worker', import.meta.url), { type: 'module' })
  })
  onDestroy(() => pool.reset())
  let webMeshId = ''

  $: if ($protoConfig || (mode == 'advanced' && editorContent))
    try {
      config // Hack to force updates when config changes
      if (mode != 'advanced') {
        console.log(
          'Setting hash',
          serialize({
            keyboard: 'cf',
            options: $protoConfig,
          })
        )
        window.location.hash = serialize({
          keyboard: 'cf',
          options: $protoConfig,
        })
      } else if (editorContent) {
        console.log('new editor content')
        if (window.location.hash.startsWith('#expert'))
          window.history.replaceState(null, '', '#' + editorContent)
        else window.location.hash = editorContent
      }
    } catch (e) {
      console.error(e)
    }

  //$: config = cuttleConf(state.options)
  let config: Cuttleform
  let geometry: Geometry | null = null
  $: if (config && browser) process(config, $theme).catch((e) => console.error(e))

  let generatingSTEP = false
  let generatingSTL = false
  let generatingError: Error | undefined

  function downloadSTEP(flip: boolean) {
    const begin = window.performance.now()
    generatingSTEP = true
    pool
      .executeNow((w) => w.getSTEP(config, flip, true) as Promise<Blob>)
      .then(addMetadataToSTEP)
      .then(
        (blob) => {
          trackEvent('cosmos-step', {
            model: 'keyboard',
            time: window.performance.now() - begin,
          })
          download(blob, 'keyboard' + (flip ? '-left' : '-right') + '.step')
          generatingError = undefined
          generatingSTEP = false
        },
        (e) => {
          generatingSTEP = false
          console.error(e)
          generatingError = e
        }
      )
  }

  async function addMetadataToSTEP(blob: Blob) {
    const text = await blob.text()
    const replaced = text
      .replace("FILE_DESCRIPTION(('Open CASCADE Model')", "FILE_DESCRIPTION(('Cosmos Model')")
      .replace("FILE_NAME('Open CASCADE Shape Model'", `FILE_NAME('${location.href}'`)
    return new Blob([replaced], { type: blob.type })
  }

  function downloadSTL(model: string, flip: boolean) {
    const begin = window.performance.now()
    generatingSTL = true
    pool
      .executeNow((w) => w.getSTL(config, model, flip) as Promise<Blob>)
      .then(
        (blob) => {
          trackEvent('cosmos-stl', { model, time: window.performance.now() - begin })
          download(blob, model + (flip ? '-left' : '-right') + '.stl')
          generatingError = undefined
          generatingSTL = false
        },
        (e) => {
          generatingSTL = false
          console.error(e)
          generatingError = e
        }
      )
  }

  /** Unused: While technically valid, prusaslicer does not like trailing metadata. */
  async function addMetadataToSTL(blob: Blob) {
    const contents = await blob.arrayBuffer()
    const trailing = '\0Exported from ' + location.href
    return new Blob([contents, trailing], { type: blob.type })
  }

  let wristBuf: BufferGeometry | undefined
  let plateTopBuf: BufferGeometry | undefined
  let plateBotBuf: BufferGeometry | undefined
  let webBuf: BufferGeometry | undefined
  let keyBuf: BufferGeometry | undefined
  let wallBuf: BufferGeometry | undefined
  let screwBaseBuf: BufferGeometry | undefined
  let screwPlateBuf: BufferGeometry | undefined
  let holderBuf: BufferGeometry | undefined
  $: wristGeo = wristBuf
    ? [
        {
          geometry: wristBuf,
          // material: new KeyMaterial(cTransparency/100)
        },
      ]
    : []

  function areDifferent(c1, c2) {
    const differences = []

    for (const prop of new Set([...Object.keys(c1), ...Object.keys(c2)])) {
      if (JSON.stringify(c1[prop]) != JSON.stringify(c2[prop])) differences.push(prop)
    }
    return differences
  }

  let oldConfig = null
  async function process(conf: Cuttleform, theme) {
    if (oldConfig) {
      const differences = areDifferent(oldConfig, conf)
      if (differences.length == 0) return
      oldConfig = conf

      if (differences.length == 1 && differences[0] == 'wristRest') {
        try {
          ocError = undefined
          modelOpacity = 0.6
          center = estimatedCenter(geometry, config.wristRest)
          const wristMesh = await pool.executeNow((w) => w.generateWristRest(conf), 'Wrist Rest')
          wristBuf = fromGeometry(wristMesh.mesh, cTransparency)
          modelOpacity = 1
          ocError = undefined
        } catch (e) {
          console.error(e)
          ocError = e
        }
        return
      }
    } else {
      oldConfig = conf
    }

    geometry = newGeometry(conf)
    confError = checkConfig(conf, geometry)
    if (confError && (confError.type != 'intersection' || confError.what == 'hole')) {
      // modelOpacity = 0
      return
    }

    const settings = conf

    // Reset the state
    ocError = undefined
    console.log('Generating!')
    modelOpacity = 0.2

    pool.reset()
    try {
      const intersectionsPromise = pool.execute(
        (w) => w.intersections(settings) as Promise<ConfError | undefined>,
        'Intersections'
      )
      const wallPromise = pool.execute((w) => w.generateWalls(settings), 'Walls')
      const webPromise = pool.execute((w) => w.generateWeb(settings), 'Web')
      const keyPromise = pool.execute((w) => w.generateKeys(settings), 'Keys')
      const platePromise = pool.execute((w) => w.generatePlate(settings), 'Plate')

      screwBaseBuf = undefined
      screwPlateBuf = undefined
      // wristBuf = undefined
      holderBuf = undefined
      wallBuf = undefined
      webBuf = undefined
      keyBuf = undefined
      plateTopBuf = undefined
      plateBotBuf = undefined

      let cutPromise, holderPromise, screwPromise, wristRestPromise, cutPlatePromise
      if (!flags.fast) {
        cutPromise = pool.execute((w) => w.cutWall(settings), 'Cut wall')
        holderPromise = pool.execute((w) => w.generateBoardHolder(settings), 'Holder')
        screwPromise = pool.execute((w) => w.generateScrewInserts(settings), 'Inserts')
        wristRestPromise = pool.execute((w) => w.generateWristRest(settings), 'Wrist Rest')
        if (config.shell.type == 'stilts')
          cutPlatePromise = pool.execute((w) => w.generatePlate(settings, true), 'Full Plate')
      }

      center = estimatedCenter(geometry, !!config.wristRest)
      confError = await intersectionsPromise
      const wallMesh = await wallPromise
      const webMesh = await webPromise
      const keyMesh = await keyPromise
      let plateMesh = await platePromise

      webBuf = fromGeometry(webMesh.mesh)
      keyBuf = fromGeometry(keyMesh.mesh)
      size = boundingSize([keyBuf!, webBuf!])
      const wallMeshMesh = fromGeometry(wallMesh.mesh)
      wallBuf = wallMeshMesh
      plateTopBuf = fromGeometry(plateMesh.top.mesh)
      plateBotBuf = fromGeometry(plateMesh.bottom.mesh)
      modelOpacity = 0.6

      if (!flags.fast) {
        let holderMesh, screwPlateMesh, screwBaseMesh, cutMesh, wristMesh
        const queue = [holderPromise, screwPromise, cutPromise, wristRestPromise]
        if (config.shell.type == 'stilts') queue.push(cutPlatePromise)
        const errors: Error[] = []
        while (queue.length) {
          const { result, finished, error } = await Promise.race(
            queue.map((p) =>
              p.then(
                (res) => ({ result: res, finished: p }),
                (error) => ({ error, finished: p })
              )
            )
          )
          queue.splice(queue.indexOf(finished), 1)
          if (error) {
            errors.push(error)
            continue
          }
          if (finished == holderPromise) {
            holderMesh = result
            if (conf.microcontroller) holderBuf = fromGeometry(holderMesh.mesh)
          } else if (finished == screwPromise) {
            console.log(result)
            screwBaseMesh = result.baseInserts
            screwPlateMesh = result.plateInserts
            screwBaseBuf = fromGeometry(screwBaseMesh.mesh)
            screwPlateBuf = fromGeometry(screwPlateMesh.mesh)
          } else if (finished == cutPromise) {
            cutMesh = result
            wallBuf = fromGeometry(cutMesh.mesh)
          } else if (finished == wristRestPromise) {
            wristMesh = result
            wristBuf = fromGeometry(wristMesh.mesh)
          } else if (finished == cutPlatePromise) {
            plateMesh = result
            plateTopBuf = fromGeometry(plateMesh.top.mesh)
            plateBotBuf = fromGeometry(plateMesh.bottom.mesh)
          }
        }
        if (errors.length) throw errors[0]

        const volume =
          cutMesh.mass + webMesh.mass + keyMesh.mass + screwBaseMesh.mass + screwPlateMesh.mass
        const supportVolume =
          cutMesh.supports.volume + webMesh.supports.volume + keyMesh.supports.volume
        filament = estimateFilament(volume, supportVolume)
        supportGeometries = [
          fromGeometry(cutMesh.supports)!,
          fromGeometry(webMesh.supports)!,
          fromGeometry(keyMesh.supports)!,
        ]
        // supportGeometries.forEach(g => g.material = new CaseMaterial(0.8, 0.5))
      }
      modelOpacity = 1
      ocError = undefined
    } catch (e) {
      console.error(e)
      ocError = e
    }
  }

  function loadPreset(s: any) {
    for (const [k1, o1] of Object.entries(s)) {
      for (const [k2, o2] of Object.entries(o1)) {
        state.options[k1][k2] = o2
      }
    }
    state = state
  }

  function setMode(newMode: string) {
    if (mode === 'advanced' && newMode !== 'advanced') {
      if (!confirm('Are you sure you wish to exit expert mode? Your work will not be saved.'))
        return
      initialEditorContent = undefined // So the editor resets
    }
    mode = newMode
  }
</script>

<svelte:window on:popstate={onHashChange} />

{#if flags.performance}<Performance />{/if}

<header class="px-8 pb-8 pt-12 flex items-center mb-4">
  <h1 class="dark:text-slate-100 text-4xl font-semibold flex-1">
    Cosmos Keyboard Configurator <span class="text-purple-500 dark:text-pink-400"
      >{hasPro ? 'BETA' : 'OSS'}</span
    >
  </h1>
  <!--<a class="text-gray-800 dark:text-gray-100 mx-2 md:mx-4" href="/docs">
       <Book size="2em" />
       </a>
       <a class="text-gray-800 dark:text-gray-100 mx-2 md:mx-4" href="/">
       <Github size="2em" />
       </a>-->

  <a
    class="mr-6 flex items-center gap-2 border-2 px-3 py-1 rounded border-gray-500/20 hover:border-gray-500 transition-border-color text-gray-600 dark:text-gray-200"
    href="docs/"
  >
    Docs & FAQ
  </a>
  {#if flags.login && hasPro}
    <Login bind:dialogOpen={proOpen} />
  {/if}
</header>
<main class="px-8 dark:text-slate-100 flex flex-col xs:flex-row-reverse">
  <div class="flex-1">
    {#if state.keyboard == 'lightcycle'}
      <div class="border-2 border-yellow-400 py-2 px-4 m-2 rounded bg-white dark:bg-gray-900">
        Generating the Lightcycle case takes an extremeley long time, so it is disabled by default.
        Turn on <span class="whitespace-nowrap bg-gray-200 dark:bg-gray-800 px-2 rounded"
          >Include Case</span
        > to generate it.
      </div>
    {/if}
    <div class="viewer relative xs:sticky h-[100vh] top-0">
      <div class="flex gap-1 justify-center items-center h-[42px]">
        <Preset
          purple
          class="relative z-10 !px-2"
          on:click={() => (viewer = '3d')}
          selected={viewer == '3d'}>3D</Preset
        >
        <Preset
          purple
          class="relative z-10 !px-2"
          on:click={() => (viewer = 'top')}
          selected={viewer == 'top'}>Keys</Preset
        >
        <Preset
          purple
          class="relative z-10 !px-2"
          on:click={() => (viewer = 'programming')}
          selected={viewer == 'programming'}>Program</Preset
        >
        <div class="preset-overflow hidden xl:block">
          <Preset
            purple
            class="relative z-10 !px-2"
            on:click={() => (viewer = 'board')}
            selected={viewer == 'board'}>Base</Preset
          >
          <Preset
            purple
            class="relative z-10 !px-2"
            on:click={() => (viewer = 'thick')}
            selected={viewer == 'thick'}>Thickness</Preset
          >
          {#if flags.timing}<Preset
              purple
              class="relative z-10 !px-2"
              on:click={() => (viewer = 'timing')}
              selected={viewer == 'timing'}>Timing</Preset
            >{/if}
        </div>
        <Preset
          purple
          class="xl:hidden relative z-10 !px-2 flex items-center gap-2"
          selected={viewer == 'board' || viewer == 'thick' || viewer == 'timing'}
          bind:button={referenceElementTools}><Icon path={mdi.mdiToolboxOutline} /> ...</Preset
        >
        <input
          class="relative z-10 mx-2"
          type="range"
          min="0"
          max="100"
          bind:value={transparency}
        />
        {#if flags.hand}<Preset
            purple
            square
            class="relative z-10"
            on:click={() => ($showHand = !$showHand)}
            selected={$showHand}><Icon path={mdi.mdiHandBackRightOutline} /></Preset
          >{/if}
        <Preset purple square class="relative z-10 !px-2" on:click={() => ($flip = !$flip)}
          ><Icon path={mdi.mdiFlipHorizontal} /></Preset
        >
      </div>
      <div class="xl:hidden" style="--z-index: 50">
        <Popover
          triggerEvents={['click', 'focus']}
          referenceElement={referenceElementTools}
          placement="bottom-end"
          spaceAway={4}
        >
          <div
            class="bg-white/50 dark:bg-gray-800/50 px-2 py-1 mr-[-.5rem] rounded"
            in:fade={{ duration: 50 }}
            out:fade={{ duration: 150 }}
          >
            <Preset
              purple
              class="!px-2"
              on:click={() => (viewer = 'board')}
              selected={viewer == 'board'}>Base</Preset
            >
            <Preset
              purple
              class="!px-2"
              on:click={() => (viewer = 'thick')}
              selected={viewer == 'thick'}>Thickness</Preset
            >
            {#if flags.timing}<Preset
                purple
                class="relative z-10 !px-2"
                on:click={() => (viewer = 'timing')}
                selected={viewer == 'timing'}>Timing</Preset
              >{/if}
          </div>
        </Popover>
      </div>
      {#if viewer == '3d'}
        <Viewer3D
          {geometry}
          transparency={cTransparency}
          conf={isRenderable(confError) ? config : undefined}
          is3D
          isExpert={mode == 'advanced'}
          {showSupports}
          {center}
          {size}
          style="opacity: {modelOpacity}"
          enableZoom={true}
          flip={$flip}
          showHand={$showHand}
          error={confError}
        >
          <KeyboardMesh kind="case" geometry={keyBuf} />
          <KeyboardMesh kind="case" geometry={screwBaseBuf} />
          <KeyboardMesh
            kind="case"
            geometry={holderBuf}
            brightness={0.5}
            opacity={0.9}
            visible={!showSupports}
          />
          {#if !flags.noWall && !hideWall}<KeyboardMesh kind="case" geometry={wallBuf} />{/if}
          <KeyboardMesh kind="case" geometry={webBuf} />
          <KeyboardMesh kind="key" geometry={plateTopBuf} opacity={plateTopOpacity} />
          <KeyboardMesh
            kind="key"
            geometry={plateBotBuf}
            opacity={Math.pow((cTransparency - 50) / 50, 3)}
          />
          <KeyboardMesh kind="key" geometry={screwPlateBuf} opacity={plateScrewOpacity} />
          <KeyboardMesh kind="key" geometry={wristBuf} opacity={cTransparency / 100} />
          {#if showSupports}
            {#each supportGeometries as geo}
              <KeyboardMesh kind="case" geometry={geo} brightness={0.5} opacity={0.8} />
            {/each}
          {/if}
        </Viewer3D>
      {:else if viewer == 'thick'}
        <Thick3D
          {geometry}
          transparency={cTransparency}
          conf={isRenderable(confError) ? config : undefined}
          is3D
          isExpert={mode == 'advanced'}
          {center}
          {size}
          style="opacity: {modelOpacity}"
          enableZoom={true}
          flip={$flip}
          showHand={$showHand}
          error={confError}
          {darkMode}
        >
          <KeyboardMesh kind="case" geometry={keyBuf} />
          <KeyboardMesh kind="case" geometry={screwBaseBuf} />
          <KeyboardMesh
            kind="case"
            geometry={holderBuf}
            brightness={0.5}
            opacity={0.9}
            visible={!showSupports}
          />
          {#if !flags.noWall && !hideWall}<KeyboardMesh kind="case" geometry={wallBuf} />{/if}
          <KeyboardMesh kind="key" geometry={plateTopBuf} opacity={plateTopOpacity} />
          <KeyboardMesh
            kind="key"
            geometry={plateBotBuf}
            opacity={Math.pow((cTransparency - 50) / 50, 3)}
          />
          <KeyboardMesh kind="key" geometry={screwPlateBuf} opacity={plateScrewOpacity} />
          <KeyboardMesh kind="key" geometry={wristBuf} opacity={cTransparency / 100} />
          {#if showSupports}
            {#each supportGeometries as geo}
              <KeyboardMesh kind="case" geometry={geo} brightness={0.5} opacity={0.8} />
            {/each}
          {/if}
        </Thick3D>
      {:else if viewer == 'top'}
        <ViewerLayout {geometry} {darkMode} conf={config} {confError} />
      {:else if viewer == 'programming'}
        <ViewerMatrix {geometry} {darkMode} conf={config} {confError} />
      {:else if viewer == 'board'}
        <ViewerBottom {geometry} {darkMode} conf={config} {confError} />
      {:else if viewer == 'timing'}
        <ViewerTiming {pool} {darkMode} />
      {/if}
      {#if filament && config.shell?.type == 'basic'}
        <div
          class="absolute bottom-0 right-0 text-right mb-2 bg-white/50 dark:bg-gray-800/50 rounded px-2 py-0.5"
        >
          {filament.length.toFixed(1)}m
          <span class="text-gray-600 dark:text-gray-100">of filament</span>
          <button class="s-help" bind:this={referenceElement}>
            <Icon path={mdi.mdiInformation} size="20px" />
          </button>
          <Popover
            triggerEvents={['hover', 'focus']}
            {referenceElement}
            placement="top"
            spaceAway={4}
            on:change={({ detail: { isOpen } }) => (showSupports = isOpen)}
          >
            <div
              class="flex gap-4 items-end rounded bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 px-2 py-1 mx-4 text-gray-600 dark:text-gray-100"
              in:fade={{ duration: 100 }}
              out:fade={{ duration: 250 }}
            >
              <FilamentChart fractionKeyboard={filament.fractionKeyboard} />
              <div>
                <p class="whitespace-nowrap mb-2">
                  Estimated using <span class="font-semibold text-teal-500 dark:text-teal-400"
                    >100% infill</span
                  >,<br /><span class="font-semibold text-purple-500 dark:text-purple-400"
                    >{SUPPORTS_DENSITY * 100}% supports density</span
                  >.
                </p>
                <p class="whitespace-nowrap mb-1">
                  This will cost about <span class="font-semibold text-black dark:text-white"
                    >${filament.cost.toFixed(2)}</span
                  >.
                </p>
                <p class="whitespace-nowrap text-sm">
                  The keyboard itself uses {filament.keyboard.length.toFixed(1)}m.
                </p>
              </div>
            </div>
          </Popover>
        </div>
      {/if}
      {#if $codeError && viewer == '3d'}
        <div class="absolute text-white m-4 left-0 right-0 rounded p-4 top-[10%] bg-red-700">
          <h3 class="font-bold">There is an error with your code.</h3>
          <p class="mb-2">{$codeError.message}</p>
        </div>
      {:else if confError && viewer == '3d'}
        <div
          class="errorMsg"
          class:expand={errorMsg}
          class:custom={$protoConfig && $protoConfig.thumbCluster.oneofKind == 'customThumb'}
          class:bg-red-700={confError.type != 'wallBounds'}
          class:bg-yellow-700={confError.type == 'wallBounds'}
        >
          {#if errorMsg}<h3 class="font-bold">There is a problem with the configuration.</h3>{/if}
          {#if confError.type == 'invalid'}
            <p class="mb-2">
              In your configuration, the property <code>{confError.item}</code> has the wrong data type.
            </p>
            <p class="mb-2">
              Its value was found to be <code>{JSON.stringify(confError.value)}</code>, but it
              should be one of: <code>{confError.valid.join(', ')}</code>.
            </p>
          {:else if confError.type == 'wrong'}
            <p class="mb-2">
              In your configuration, the property <code>{confError.item}</code> has the wrong data type.
            </p>
            <p class="mb-2">
              Its value was found to be <code>{JSON.stringify(confError.value)}</code>.
            </p>
          {:else if confError.type == 'oob'}
            <p class="mb-2">
              In your configuration, the element with value <code>{confError.idx}</code> in
              <code>{confError.item}</code> is out of bounds.
            </p>
            <p class="mb-2">The value must be less than <code>{confError.len}</code>.</p>
          {:else if confError.type == 'exception'}
            <p class="mb-2">When {confError.when}: <code>{confError.error.message}</code>.</p>
          {:else if confError.type == 'nan'}
            <p class="mb-2">
              One of the key positions has a value that's not a number. This often happens after an
              update that adds new configuration options, so double check the Advanced tab and make
              sure that every setting is set.
            </p>
          {:else if confError.type == 'nokeys'}
            <p class="mb-2">
              You silly goose! You can't make a keyboard without keys. <br />That's like riding a
              snowboard without snow.
            </p>
          {:else if confError.type == 'missing'}
            <p class="mb-2">
              In your configuration, the property <code>{confError.item}</code> is missing.
            </p>
            {#if confError.key}
              <p class="mb-2">Check the key with this configuration:</p>
              <pre class="text-xs"><code>{JSON.stringify(confError.key, null, 2)}</code></pre>
            {/if}
          {:else if errorMsg}
            <div>
              {#if confError.type == 'intersection'}
                {#if confError.what == 'keycap' && (confError.i < 0 || confError.j < 0)}
                  <p class="mb-2">
                    One of the keycaps intersects the walls{#if confError.travel}&nbsp;when pressed
                      down {confError.travel[0]}mm{/if}.
                  </p>
                {:else if confError.what == 'keycap'}
                  <p class="mb-2">
                    Two of the keycaps intersect, either in their current positions or when pressed
                    down{#if confError.travel}&nbsp;with
                      {confError.travel[0]}mm of travel{/if}.
                  </p>
                {:else if confError.what == 'socket'}
                  <p class="mb-2">Two of the key sockets intersect.</p>
                {/if}
                <p class="mb-2">
                  If you're using Advanced mode, you can try adjusting the stagger, increasing the
                  spacing, or adding outwards arc to correct the issue.
                  {#if confError.what != 'socket'}You can also try decreasing webMinThicknessFactor
                    in expert mode.{/if}
                </p>
                <p class="mb-2">
                  If the issue is within the thumb cluster, increase the vertical and horizontal
                  spacings in Advanced mode or switch to custom thumbs mode.
                </p>
              {:else if confError.type == 'wallBounds'}
                <p class="mb-2">
                  One of the keys sticks out past the wall boundary. The keyboard will print, but
                  you may see a small hole in this spot.
                </p>
                <p>To correct this issue, try adjusting the stagger or moving the keys around.</p>
              {/if}
            </div>
            <div class="flex-0 pl-2 absolute top-[1rem] right-[1.5rem]">
              <button on:click={() => (errorMsg = !errorMsg)}
                ><Icon path={mdi.mdiArrowCollapseUp} /></button
              >
            </div>
          {:else}
            <div>
              {#if confError.type == 'intersection'}
                {#if confError.what == 'keycap' && (confError.i < 0 || confError.j < 0)}
                  Keycap + Walls Intersect
                {:else if confError.what == 'keycap'}
                  Keycaps Intersect
                {:else if confError.what == 'socket'}
                  Sockets Intersect
                {/if}
              {:else if confError.type == 'wallBounds'}
                Key Sticks Past Walls
              {/if}
            </div>
            <div class="flex-0 pl-2">
              <button on:click={() => (errorMsg = !errorMsg)}
                ><Icon path={mdi.mdiArrowExpandDown} /></button
              >
            </div>
          {/if}
        </div>
      {:else if ocError && viewer == '3d'}
        <div class="absolute text-white m-4 left-0 right-0 rounded p-4 top-[10%] bg-red-700">
          <p>There are some rough edges in this tool, and you've found one of them.</p>
          <p class="mb-2">The set of options you've chosen cannot be previewed.</p>
          <p class="mb-2">Here's some technical information:</p>
          <p class="text-sm"><code>During processing of <b>{ocError.task}</b></code></p>
          <p class="text-sm">
            <code
              >{ocError}<br />{ocError.stack
                ? ocError.stack.split('\n').slice(0, 5).join('\n')
                : ''}</code
            >
          </p>
        </div>
      {:else if config?.shell?.type == 'stilts'}
        {#if $stiltsMsg}
          <div
            class="absolute text-white m-4 left-0 right-0 rounded p-4 top-[5%] bg-yellow-700 flex"
          >
            <div>
              <p>
                Stilts mode is <b>very</b> tempermental. Not every model will work with it. Try to
                keep very smooth curves between keys, and
                <button class="underline" on:click={() => (hideWall = !hideWall)}
                  >{hideWall ? 'show' : 'hide'} the walls</button
                > to check for bad geometry.
              </p>
              <p class="text-sm mt-2">
                While I like hearing what kind of bugs you find, please don't tell be about bugs in
                stilts mode. There are too many to keep track of and countless weeks to be spent
                trying to fix them.
              </p>
            </div>
            <div class="flex-0 pl-2">
              <button on:click={() => ($stiltsMsg = !$stiltsMsg)}
                ><Icon path={mdi.mdiArrowCollapseUp} /></button
              >
            </div>
          </div>
        {:else}
          <div
            class="absolute text-white m-4 right-[80px] rounded p-4 top-[10%] bg-yellow-700 flex"
          >
            <div>
              <p>Stilts mode is <b>very</b> tempermental.</p>
            </div>
            <div class="flex-0 pl-2">
              <button on:click={() => ($stiltsMsg = !$stiltsMsg)}
                ><Icon path={mdi.mdiArrowExpandDown} /></button
              >
            </div>
          </div>
        {/if}
      {/if}
    </div>
  </div>
  <div class="xs:w-80 md:w-[32rem]">
    {#if viewer == 'programming'}
      <button class="infobutton" on:click={() => (kleView = true)}>Download KLE Layout</button>
      <p class="mt-4 mb-2">Some things that will happen here in the future:</p>
      <ul class="list-disc pl-4">
        <li>The thumb cluster matrix will be wired more efficiently</li>
        <li>The thumb cluster matrix will be connected to the larger key matrix</li>
        <li>The generator will make a QMK template for you to use</li>
        <li>And maybe a generated assembly / wiring guide</li>
      </ul>
    {:else}
      <div class="flex items-center justify-between mr-2">
        <div>
          <Preset
            purple
            on:click={() => setMode('basic')}
            name="Basic"
            selected={mode == 'basic'}
          />
          <Preset
            purple
            on:click={() => setMode('intermediate')}
            name="Advanced"
            selected={mode == 'intermediate'}
          />
          <Preset
            purple
            on:click={() => setMode('advanced')}
            name="Expert"
            selected={mode == 'advanced'}
          />
        </div>
        <button class="button" on:click={() => (downloading = true)}>Download</button>
      </div>
      <div class="flex justify-between pr-2 mt-1">
        <button class="infobutton" on:click={() => (urlView = true)}>What's in the URL?</button>
        <div>
          <button class="infobutton" on:click={() => (bomView = true)}
            >View Bill of Materials</button
          >
        </div>
      </div>

      {#if mode == 'basic' || mode == 'intermediate'}
        <VisualEditor
          basic={mode == 'basic'}
          cuttleformConf={state.options}
          bind:conf={config}
          bind:geometry
          on:preset={(m) => loadPreset(m.detail)}
          on:goAdvanced={() => (mode = 'intermediate')}
        />
      {:else}
        <Editor
          bind:initialContent={initialEditorContent}
          bind:hashContent={editorContent}
          {darkMode}
          manuformConf={state.options}
          bind:conf={config}
        />
      {/if}
    {/if}
  </div>
</main>
<footer class="px-8 pb-8 pt-16">
  <Footer />
</footer>
{#if urlView}
  <Dialog on:close={() => (urlView = false)}>
    <span slot="title">What's in the URL?</span>
    <div slot="content"><UrlView {mode} {editorContent} /></div>
  </Dialog>
{/if}
{#if bomView}
  <Dialog big on:close={() => (bomView = false)}>
    <span slot="title">Bill of Materials</span>
    <div slot="content">
      {#if !config}
        <div class="bg-red-200 m-4 rounded p-4 dark:bg-red-700">
          Bill of Materials will not be available until the configuration is evaluated.
        </div>
      {:else if !isRenderable(confError)}
        <div class="bg-red-200 m-4 rounded p-4 dark:bg-red-700">
          Bill of Materials will not be available until you fix the errors in your configuration.
        </div>
      {:else}
        {#if config.shell.type != 'basic'}
          <div class="bg-yellow-200 m-4 rounded p-4 dark:bg-yellow-700">
            Screw information is not yet finished non-standard cases. Make sure to check the model
            for any additional screws needed.
          </div>
        {/if}
        <BomView {geometry} conf={config} />
      {/if}
    </div>
  </Dialog>
{/if}
{#if kleView}
  <Dialog big on:close={() => (kleView = false)}>
    <span slot="title">KLE Export</span>
    <div slot="content">
      <KleView conf={config} />
    </div>
  </Dialog>
{/if}
{#if downloading}
  <Dialog
    on:close={() => {
      downloading = false
      showAllFormats = false
    }}
  >
    <span slot="title">Download Your Model</span>
    <div slot="content" class="text-center">
      {#if isPro(config) && !($user.success && $user.sponsor)}
        <p class="mb-2">
          You're using some <span class="text-teal-500 dark:text-teal-400 font-bold">PRO</span> features
          in this model.
        </p>
        <p>To download this model, sign up for a Pro account.</p>
        {#if flags.login}
          <button
            class="flex items-center gap-2 border-2 px-3 py-1 rounded hover:shadow-md transition-shadow border-yellow-400 hover:bg-yellow-400/30 hover:shadow-yellow-400/30 mt-6 mx-auto"
            on:click={() => {
              downloading = false
              proOpen = true
            }}
          >
            <Icon
              path={mdi.mdiStarShooting}
              size="20px"
              class="text-yellow-500 dark:text-yellow-300"
            />
            Get PRO
          </button>
        {:else}
          <p class="mt-2">
            Since I have not rolled out Pro accounts, please ping me on Discord with a link to your
            model and I'll send you the files.
          </p>{/if}
      {:else}
        <h2 class="mb-2 text-xl text-teal-500 dark:text-teal-300 font-semibold">
          STL Files: For 3D Printing
        </h2>
        <p class="mb-4 text-gray-500 dark:text-gray-200 max-w-lg mx-auto">
          I recommend using PrusaSlicer or Cura for slicing if you can. Otherwise, ask in the <a
            class="text-teal-500 dark:text-teal-300 hover:underline"
            href="https://discord.gg/nXjqkfgtGy">Discord server</a
          > if your slicer has been tested!
        </p>
        <div class="columns-2">
          <div class="break-inside-avoid">
            <h3 class="mb-2 text-lg semibold text-black dark:text-white">Case/Shell</h3>
            <div class="inline-flex items-center gap-2">
              <button
                class="button flex items-center gap-2"
                on:click={() => downloadSTL('model', true)}
                ><Icon path={mdi.mdiHandBackLeft} />Left</button
              >
              <button
                class="button flex items-center gap-2"
                on:click={() => downloadSTL('model', false)}
                ><Icon path={mdi.mdiHandBackRight} />Right</button
              >
            </div>
          </div>
          <div class="break-inside-avoid">
            <h3 class="mb-2 mt-4 text-lg semibold text-black dark:text-white">Plate</h3>
            {#if config.shell.type == 'tilt' || config.shell.type == 'stilts'}
              <div class="inline-flex items-center gap-2">
                <button
                  class="button flex items-center gap-2"
                  on:click={() => downloadSTL('platetop', true)}
                  ><Icon path={mdi.mdiHandBackLeft} />L / Top</button
                >
                <button
                  class="button flex items-center gap-2"
                  on:click={() => downloadSTL('platetop', false)}
                  ><Icon path={mdi.mdiHandBackRight} />R / Top</button
                >
              </div>
              <div class="inline-flex items-center gap-2 mt-2">
                <button
                  class="button flex items-center gap-2"
                  on:click={() => downloadSTL('platebottom', true)}
                  ><Icon path={mdi.mdiHandBackLeft} />L / Bot</button
                >
                <button
                  class="button flex items-center gap-2"
                  on:click={() => downloadSTL('platebottom', false)}
                  ><Icon path={mdi.mdiHandBackRight} />R / Bot</button
                >
              </div>
              <div class="text-sm opacity-70 text-center mt-2 pb-1">
                Download both the Top and Bot models
              </div>
            {:else}
              <div class="inline-flex items-center gap-2">
                <button
                  class="button flex items-center gap-2"
                  on:click={() => downloadSTL('plate', true)}
                  ><Icon path={mdi.mdiHandBackLeft} />Left</button
                >
                <button
                  class="button flex items-center gap-2"
                  on:click={() => downloadSTL('plate', false)}
                  ><Icon path={mdi.mdiHandBackRight} />Right</button
                >
              </div>
            {/if}
          </div>
          {#if config.microcontroller}
            <div class="break-inside-avoid">
              <h3 class="mb-2 mt-4 text-lg semibold text-black dark:text-white">
                Microcontroller Holder
              </h3>
              <div class="inline-flex items-center gap-2">
                <button
                  class="button flex items-center gap-2"
                  on:click={() => downloadSTL('holder', true)}
                  ><Icon path={mdi.mdiHandBackLeft} />Left</button
                >
                <button
                  class="button flex items-center gap-2"
                  on:click={() => downloadSTL('holder', false)}
                  ><Icon path={mdi.mdiHandBackRight} />Right</button
                >
              </div>
            </div>
          {/if}
          {#if hasPro}
            <div class="break-inside-avoid">
              <h3 class="mb-2 mt-4 text-lg semibold text-black dark:text-white">Wrist Rest</h3>
              {#if $user.success && $user.sponsor}
                {#if config?.wristRest}
                  <div class="inline-flex items-center gap-2">
                    <button
                      class="button flex items-center gap-2"
                      on:click={() => downloadSTL('wristrest', true)}
                      ><Icon path={mdi.mdiHandBackLeft} />Left</button
                    >
                    <button
                      class="button flex items-center gap-2"
                      on:click={() => downloadSTL('wristrest', false)}
                      ><Icon path={mdi.mdiHandBackRight} />Right</button
                    >
                  </div>
                {:else}
                  None configured
                {/if}
              {:else}
                <p class="mb-2">
                  You need a <span class="text-teal-500 dark:text-teal-400 font-bold">PRO</span> account
                  to download wrist rests.
                </p>
              {/if}
            </div>
          {/if}
        </div>
        <h2 class="mb-2 mt-8 text-xl text-teal-500 dark:text-teal-300 font-semibold">
          STEP Files: For CAD Programs
        </h2>
        <p class="mb-4 text-gray-500 dark:text-gray-200 max-w-lg mx-auto">
          These models are editable in Fusion and Onshape and include all parts. Check the <a
            class="text-teal-500 dark:text-teal-300 hover:underline"
            href="https://discord.gg/nXjqkfgtGy">#faq</a
          > channel in Discord for importing instructions.
        </p>
        <div class="inline-flex items-center gap-2">
          <button class="button flex items-center gap-2" on:click={() => downloadSTEP(true)}
            ><Icon path={mdi.mdiHandBackLeft} />Left</button
          >
          <button class="button flex items-center gap-2" on:click={() => downloadSTEP(false)}
            ><Icon path={mdi.mdiHandBackRight} />Right</button
          >
        </div>
        {#if hasPro}
          {#if !($user.success && $user.sponsor)}
            <p class="mt-2">
              A <span class="text-teal-500 dark:text-teal-400 font-bold">PRO</span> account will add
              wrist rests will to this file.
            </p>
          {:else if !config?.wristRest}
            <p class="mt-2">
              Wrist rests will not be added to this assembly. Check "Show Wrists" rests in
              basic/advanced view to enable them or add them to your expert mode configuration.
            </p>
          {/if}
        {/if}
        {#if showAllFormats}
          <GlbExport {pool} {config} />
        {:else}
          <p class="mt-6 mb-[-1rem]">
            <button
              on:click={() => (showAllFormats = true)}
              class="text-gray-700 dark:text-gray-400 hover:text-teal-500 hover:dark:text-teal-300 hover:underline"
              >More formats...</button
            >
          </p>
        {/if}
        {#if generatingSTEP || generatingSTL}
          <p class="mt-4">Generating... Please be patient.</p>
        {:else if generatingError}
          <div
            class="bg-red-200 m-4 mb-2 rounded p-4 dark:bg-red-700 font-mono text-sm whitespace-pre-wrap"
          >
            {generatingError.message}
          </div>
          <p>Check the browser console for more details.</p>
        {/if}
      {/if}
    </div>
  </Dialog>
{/if}

<DarkTheme bind:darkMode />

<style>
  :global(html) {
    --at-apply: 'dark:bg-gray-800 dark:text-white';
  }

  @media (min-height: 480px) {
    .viewer {
      height: calc(100vh - 136px);
      top: 68px;
    }
  }

  @media (max-width: 520px) {
    .viewer {
      --at-apply: 'max-h-[50vh] mb-4 top-0';
    }
  }

  .button {
    --at-apply: 'bg-purple-300 dark:bg-gray-900 hover:bg-purple-400 dark:hover:bg-pink-900 text-black dark:text-white font-bold py-2 px-4 rounded focus:outline-none border border-transparent focus:border-pink-500';
  }

  .infobutton {
    --at-apply: 'bg-purple-100 dark:bg-gray-900/50 hover:bg-purple-200 dark:hover:bg-pink-900/70 rounded px-4 py-1 focus:outline-none border border-transparent focus:border-pink-500';
  }

  .errorMsg {
    --at-apply: 'absolute text-white m-4 right-[80px] rounded p-4 top-[5%] flex';
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
</style>

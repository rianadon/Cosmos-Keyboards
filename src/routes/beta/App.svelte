<script lang="ts">
  import { fade } from 'svelte/transition'
  import Login from './lib/Login.svelte'
  import Viewer3D from './lib/viewers/NewViewer3D.svelte'
  import Thick3D from './lib/viewers/ViewerThickness.svelte'
  import ViewerLayout from './lib/viewers/ViewerLayout.svelte'
  import ViewerMatrix from './lib/viewers/ViewerMatrix.svelte'
  import ViewerBottom from './lib/viewers/ViewerBottom.svelte'
  import ViewerTiming from './lib/viewers/ViewerTiming.svelte'
  import GroupMatrix from '$lib/3d/GroupMatrix.svelte'
  import Popover from 'svelte-easy-popover'
  import Icon from '$lib/presentation/Icon.svelte'
  import * as mdi from '@mdi/js'
  import { boundingSize } from '$lib/loaders/geometry'
  import { estimateFilament, SUPPORTS_DENSITY, type FilamentEstimate } from './lib/filament'
  import * as flags from '$lib/flags'
  import Performance from './lib/Performance.svelte'

  import UrlView from './lib/dialogs/URLView.svelte'
  import BomView from './lib/dialogs/BomView.svelte'
  import KleView from './lib/dialogs/KleView.svelte'
  import HandFitView from './lib/dialogs/HandFitView.svelte'
  import cuttleform from '$assets/cuttleform.json'
  import Dialog from '$lib/presentation/Dialog.svelte'
  import Footer from './lib/Footer.svelte'
  import Editor from './lib/editor/CodeEditor.svelte'
  import Preset from '$lib/presentation/Preset.svelte'
  import FilamentChart from './lib/FilamentChart.svelte'
  import DarkTheme from './lib/DarkTheme.svelte'
  import { serialize, deserialize } from './lib/serialize'
  import { WorkerPool, type TaskError } from './lib/workerPool'
  import {
    newFullGeometry,
    newGeometry,
    type Cuttleform,
    type CuttleformProto,
    type FullCuttleform,
    type Geometry,
  } from '$lib/worker/config'
  import { checkConfig, type ConfError, isRenderable, isWarning } from '$lib/worker/check'
  import VisualEditor from './lib/editor/VisualEditor.svelte'
  import VisualEditor2 from './lib/editor/VisualEditor2.svelte'
  import { Vector3, BufferGeometry, Matrix4 } from 'three'
  import { estimatedCenter } from '$lib/worker/geometry'
  import {
    codeError,
    flip,
    protoConfig,
    user,
    theme,
    showHand,
    stiltsMsg,
    developer,
    showTiming,
    noWall,
    noBase,
    tempConfig,
    confError,
  } from '$lib/store'
  import { onDestroy } from 'svelte'
  import { browser } from '$app/environment'
  import { hasPro } from '@pro'
  import ViewerDev from './lib/viewers/ViewerDev.svelte'
  import DownloadDialog from './lib/dialogs/DownloadDialog.svelte'
  import { decodeConfigIdk } from '$lib/worker/config.serialize'
  import { fromCosmosConfig } from '$lib/worker/config.cosmos'
  import KMesh from '$lib/3d/KeyboardMeshBetter.svelte'
  import KeyboardModel from '$lib/3d/KeyboardModel.svelte'
  import type { ShapeMesh } from 'replicad'
  import Keyboard from '$lib/3d/Keyboard.svelte'
  import Microcontroller from '$lib/3d/Microcontroller.svelte'
  import {
    kbdOffset,
    type FullGeometry,
    type FullKeyboardMeshes,
  } from './lib/viewers/viewer3dHelpers'
  import { notNull, objKeys } from '$lib/worker/util'
  import { T } from '@threlte/core'
  import type { ProcessPool } from 'src/model_gen/processPool'

  let center = [-35.510501861572266, -17.58449935913086, 35.66889877319336] as [
    number,
    number,
    number
  ]
  let size = new Vector3(140, 120, 100)
  let filament: FilamentEstimate | undefined
  let referenceElement
  let referenceElementTools: HTMLButtonElement
  let darkMode: boolean

  let proOpen = false
  let editorContent: string
  let hideWall = false

  // @ts-ignore
  let state: { keyboard: string; options: Keyboard } = deserialize(
    browser ? location.hash.substring(1) : '',
    deserialize('cm', null)
  )
  let initialEditorContent = state.content

  function onHashChange() {
    console.log('change')
    //  state = deserialize(location.hash.substring(1), cuttleform);
  }

  let ocError: TaskError | undefined
  let generatorProgress = 1
  let showSupports = false

  let mode = state.content ? 'advanced' : 'basic'
  let viewer = '3d'
  let transparency = 95
  let errorMsg = false

  let downloading = false
  let urlView = false
  let bomView = false
  let kleView = false
  let showFit = false

  $: cTransparency = showSupports ? 0 : transparency

  const pool = new WorkerPool<typeof import('$lib/worker/api')>(3, () => {
    return new Worker(new URL('$lib/worker?worker', import.meta.url), { type: 'module' })
  })
  const tempPool = new WorkerPool<typeof import('$lib/worker/api')>(1, () => {
    return new Worker(new URL('$lib/worker?worker', import.meta.url), { type: 'module' })
  })
  onDestroy(() => {
    pool.reset()
    tempPool.reset()
  })

  $: if ($protoConfig || (mode == 'advanced' && editorContent))
    try {
      config // Hack to force updates when config changes
      if (mode != 'advanced') {
        console.log(
          'Setting hash',
          serialize({
            keyboard: 'cm',
            options: $protoConfig,
          })
        )
        window.location.hash = serialize({
          keyboard: 'cm',
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
  let config: FullCuttleform
  let geometry: FullGeometry = {}
  $: if (config && browser) {
    process(config, true).catch((e) => console.error(e))
  }

  $: if ($tempConfig && browser) {
    debounceprocess(fromCosmosConfig($tempConfig)).catch((e) => console.error(e))
  }

  async function debounceprocess(config: FullCuttleform) {
    if (tempPool.someAvailable()) await process(config, false)
    else geometry = newFullGeometry(config) // Otherwise still update geometry so keyboard changes
  }

  let meshes: FullKeyboardMeshes = {}

  function areDifferent(c1: any, c2: any) {
    if (c1 == undefined && c2 == undefined) return []
    if (c1 == undefined && c2 != undefined) return ['everything']
    if (c1 != undefined && c2 == undefined) return ['everything']
    const differences = []

    for (const prop of new Set([...Object.keys(c1), ...Object.keys(c2)])) {
      if (JSON.stringify(c1[prop]) != JSON.stringify(c2[prop])) differences.push(prop)
    }
    return differences
  }

  function areDifferent2(c1: FullCuttleform, c2: FullCuttleform) {
    return [
      ...new Set([
        ...areDifferent(c1.left, c2.left),
        ...areDifferent(c1.right, c2.right),
        ...areDifferent(c1.unibody, c2.unibody),
      ]),
    ]
  }

  const calcOtherPromises = (conf: Cuttleform, side: 'left' | 'right' | 'unibody') => ({
    intersectionsPromise: pool.execute(
      (w) => w.intersections(conf, side) as Promise<ConfError | undefined>,
      'Intersections'
    ),
    cutPromise: pool.execute((w) => w.cutWall(conf), 'Cut wall'),
    holderPromise: pool.execute((w) => w.generateBoardHolder(conf), 'Holder'),
    screwPromise: pool.execute((w) => w.generateScrewInserts(conf), 'Inserts'),
    wristRestPromise: pool.execute((w) => w.generateWristRest(conf), 'Wrist Rest'),
    cutPlatePromise: pool.execute((w) => w.generatePlate(conf, true), 'Full Plate'),
  })

  let oldTempConfig: FullCuttleform | null = null
  let oldConfig: FullCuttleform | null = null
  async function process(conf: FullCuttleform, full: boolean) {
    const kbdNames = objKeys(conf).filter((k) => !!conf[k])
    if (oldConfig && geometry && full) {
      console.log('PROCESSING')
      const differences = areDifferent2(oldConfig, conf)
      if (differences.length == 0) return
      oldConfig = conf
      oldTempConfig = conf

      if (
        differences.length == 1 &&
        (differences[0] == 'wristRest' || differences[0] == 'wristRestOrigin')
      ) {
        try {
          ocError = undefined
          generatorProgress = 0.5
          // center = estimatedCenter(geometry, config.wristRest)
          const wristMeshes = await Promise.all(
            kbdNames.map((k) => pool.executeNow((w) => w.generateWristRest(conf[k]!), 'Wrist Rest'))
          )
          wristMeshes.forEach((wristMesh, i) => {
            meshes[kbdNames[i]]!.wristBuf = wristMesh.mesh ?? undefined
          })
          generatorProgress = 1
          ocError = undefined
        } catch (e) {
          console.error(e)
          ocError = e as TaskError
        }
        return
      }
    } else if (full) {
      oldConfig = conf
      oldTempConfig = conf
    } else {
      if (oldTempConfig) {
        const differences = areDifferent2(oldTempConfig, conf)
        if (differences.length == 0) return
      }
      oldTempConfig = conf
    }

    console.log('GENERATING')
    const newGeo = newFullGeometry(conf)
    geometry = newGeo
    console.log('conf incoming', conf)
    let err: ConfError | undefined
    for (const kbd of kbdNames) {
      err = checkConfig(conf[kbd]!, newGeo[kbd]!, true, kbd)
      if (err) break
    }
    confError.set(err)
    if (err) return

    // Reset the state
    ocError = undefined
    console.log('Generating!')
    // modelOpacity = 0.2

    const pl = full ? pool : tempPool
    if (full) pool.reset()
    try {
      const quickPromises = kbdNames.map((k) =>
        pl.execute((w) => w.generateQuick(conf[k]!), 'Preview')
      )
      const otherPromises =
        !flags.fast && full ? kbdNames.map((k) => calcOtherPromises(conf[k]!, k)) : []

      if (full)
        center = estimatedCenter(
          newGeo.right ?? newGeo.unibody!,
          !!(config.right ?? config.unibody!).wristRest
        )
      const quickResults = await Promise.all(quickPromises)
      quickResults.forEach((prom, i) => {
        meshes[kbdNames[i]] = {
          ...meshes[kbdNames[i]],
          webBuf: prom.web.mesh,
          keyBufs: prom.keys.keys.map((k) => ({
            ...k,
            matrix: new Matrix4().copy(k.matrix),
          })),
          wallBuf: prom.wall.mesh,
          plateTopBuf: prom.plate.top.mesh,
          plateBotBuf: prom.plate.bottom.mesh || undefined,
          holderBuf: undefined,
          screwBaseBuf: undefined,
          screwPlateBuf: undefined,
        }
        // size = boundingSize([...keyBufs!, webBuf!])
      })
      if (kbdNames.includes('right')) delete meshes.unibody
      else {
        delete meshes.left
        delete meshes.right
      }

      if (!flags.fast && full) {
        const queue = otherPromises.flatMap((p, i) =>
          Object.values(p).map((q) => ({ i, kbd: kbdNames[i], prom: q }))
        )
        const initialLength = queue.length
        const errors: Error[] = []
        console.log('DIFFERENCES Set to 0.2', full)
        generatorProgress = 0.2
        while (queue.length) {
          const { result, finished, error } = await Promise.race(
            queue.map((p) =>
              p.prom.then(
                (res) => ({ result: res, finished: p }),
                (error) => ({ error, finished: p })
              )
            )
          )
          queue.splice(queue.indexOf(finished), 1)
          generatorProgress = 0.2 + ((initialLength - queue.length) / initialLength) * 0.8
          if (error) {
            errors.push(error)
            continue
          }
          if (finished.prom == otherPromises[finished.i].intersectionsPromise) {
            confError.set(result)
          } else if (finished.prom == otherPromises[finished.i].holderPromise) {
            if (conf[finished.kbd]!.microcontroller) meshes[finished.kbd]!.holderBuf = result.mesh
          } else if (finished.prom == otherPromises[finished.i].screwPromise) {
            meshes[finished.kbd]!.screwBaseBuf = result.plateInserts.mesh
            meshes[finished.kbd]!.screwPlateBuf = result.baseInserts.mesh
          } else if (finished.prom == otherPromises[finished.i].cutPromise) {
            meshes[finished.kbd]!.wallBuf = result.mesh
          } else if (finished.prom == otherPromises[finished.i].wristRestPromise) {
            meshes[finished.kbd]!.wristBuf = result.mesh
          } else if (finished.prom == otherPromises[finished.i].cutPlatePromise) {
            meshes[finished.kbd]!.plateTopBuf = result.top.mesh
            meshes[finished.kbd]!.plateBotBuf = result.bottom.mesh || undefined
          }
        }
        if (errors.length) throw errors[0]

        const volume =
          (await otherPromises[0].cutPromise).mass +
          quickResults[0].web.mass +
          quickResults[0].keys.mass +
          (await otherPromises[0].screwPromise).plateInserts.mass +
          (await otherPromises[0].screwPromise).baseInserts.mass
        const supportVolume =
          (await otherPromises[0].cutPromise).supports.volume +
          quickResults[0].web.supports.volume +
          quickResults[0].keys.supports.volume
        filament = estimateFilament(volume, supportVolume)

        for (let i = 0; i < kbdNames.length; i++) {
          meshes[kbdNames[i]]!.supportGeometries = [
            (await otherPromises[i].cutPromise).supports,
            quickResults[i].web.supports,
            quickResults[i].keys.supports as any,
          ]
        }
      }
      if (full) generatorProgress = 1
      ocError = undefined
    } catch (e) {
      console.error(e)
      ocError = e as TaskError
    }
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
    ><span class="text-teal-500 dark:text-teal-400 absolute text-6xl mt--4">V3</span>
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
        <div class="preset-overflow <xl:hidden">
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
          {#if $showTiming}<Preset
              purple
              class="relative z-10 !px-2"
              on:click={() => (viewer = 'timing')}
              selected={viewer == 'timing'}>Timing</Preset
            >{/if}
          {#if $developer}
            <Preset
              purple
              class="relative z-10 !px-2"
              on:click={() => (viewer = 'dev')}
              selected={viewer == 'dev'}>Dev</Preset
            >
          {/if}
        </div>
        <Preset
          purple
          class="xl:hidden relative z-10 !px-2 flex items-center gap-2"
          selected={['board', 'thick', 'timing', 'dev'].includes(viewer)}
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
            {#if $showTiming}<Preset
                purple
                class="relative z-10 !px-2"
                on:click={() => (viewer = 'timing')}
                selected={viewer == 'timing'}>Timing</Preset
              >{/if}
            {#if $developer}
              <Preset
                purple
                class="relative z-10 !px-2"
                on:click={() => (viewer = 'dev')}
                selected={viewer == 'dev'}>Dev</Preset
              >
            {/if}
          </div>
        </Popover>
      </div>
      {#if viewer == '3d'}
        <Viewer3D
          {darkMode}
          {geometry}
          transparency={cTransparency}
          conf={isRenderable($confError) ? config?.right ?? config?.unibody : undefined}
          isExpert={mode == 'advanced'}
          {showSupports}
          {center}
          {size}
          bind:showFit
          enableZoom={true}
          flip={$flip}
          showHand={$showHand}
          progress={generatorProgress}
        >
          {#each notNull(Object.values(meshes)) as mesh, i}
            <T.Group
              position.x={kbdOffset(objKeys(meshes)[i])}
              scale.x={objKeys(meshes)[i] == 'left' ? -1 : 1}
            >
              <KeyboardModel
                {hideWall}
                {transparency}
                {showSupports}
                geometry={geometry[objKeys(meshes)[i]]}
                meshes={mesh}
              />
            </T.Group>
          {/each}
        </Viewer3D>
      {:else if viewer == 'thick'}
        <Thick3D
          {geometry}
          conf={isRenderable($confError) ? config : undefined}
          is3D
          {center}
          {size}
          enableZoom={true}
          flip={$flip}
          {darkMode}
        >
          {#if !$noBase}<Microcontroller {config} {geometry} {showSupports} />{/if}
          {#each keyBufs || [] as key}
            <GroupMatrix matrix={key.matrix}>
              <KMesh
                kind="case"
                scale={key.flip && $flip ? [-1, 1, 1] : [1, 1, 1]}
                geometry={key.mesh}
              />
            </GroupMatrix>
          {/each}
          {#if !$noWall && !hideWall}<KMesh kind="case" geometry={wallBuf} />{/if}
          {#if !$noBase}
            <KMesh kind="case" geometry={screwBaseBuf} />
            <KMesh kind="key" geometry={plateTopBuf} opacity={plateTopOpacity} renderOrder="10" />
            <KMesh
              kind="key"
              geometry={plateBotBuf}
              opacity={Math.pow((cTransparency - 50) / 50, 3)}
              renderOrder="10"
            />
            <KMesh kind="key" geometry={screwPlateBuf} opacity={plateScrewOpacity} />
            <KMesh kind="key" geometry={wristBuf} opacity={cTransparency / 100} />
            <KMesh
              kind="case"
              geometry={holderBuf}
              brightness={0.5}
              opacity={0.9}
              visible={!showSupports}
            />
          {/if}
          {#if showSupports}
            {#each supportGeometries as geo}
              <KMesh kind="case" geometry={geo} brightness={0.5} opacity={0.8} />
            {/each}
          {/if}
        </Thick3D>
      {:else if viewer == 'top'}
        <ViewerLayout
          {geometry}
          {darkMode}
          conf={config?.right ?? config?.unibody}
          confError={$confError}
        />
      {:else if viewer == 'programming'}
        <ViewerMatrix
          {geometry}
          {darkMode}
          conf={config?.right ?? config?.unibody}
          confError={$confError}
        />
      {:else if viewer == 'board'}
        <ViewerBottom
          {geometry}
          {darkMode}
          conf={config?.right ?? config?.unibody}
          confError={$confError}
        />
      {:else if viewer == 'timing'}
        <ViewerTiming {pool} {darkMode} />
      {:else if viewer == 'dev'}
        <ViewerDev />
      {/if}
      {#if filament && (config?.right ?? config?.unibody).shell?.type == 'basic'}
        <div
          class="absolute bottom-0 right-0 text-right mb-2 bg-white/50 dark:bg-gray-800/50 rounded px-2 py-0.5 z-10"
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
      {:else if $confError && viewer == '3d'}
        <div
          class="errorMsg"
          class:expand={errorMsg}
          class:bg-red-700={!isWarning($confError)}
          class:bg-yellow-700={isWarning($confError)}
        >
          {#if errorMsg}<h3 class="font-bold">There is a problem with the configuration.</h3>{/if}
          {#if $confError.type == 'invalid'}
            <p class="mb-2">
              In your configuration, the property <code>{$confError.item}</code> has the wrong data type.
            </p>
            <p class="mb-2">
              Its value was found to be <code>{JSON.stringify($confError.value)}</code>, but it
              should be one of: <code>{$confError.valid.join(', ')}</code>.
            </p>
          {:else if $confError.type == 'wrong'}
            <p class="mb-2">
              In your configuration, the property <code>{$confError.item}</code> has the wrong data type.
            </p>
            <p class="mb-2">
              Its value was found to be <code>{JSON.stringify($confError.value)}</code>.
            </p>
          {:else if $confError.type == 'oob'}
            <p class="mb-2">
              In your configuration, the element with value <code>{$confError.idx}</code> in
              <code>{$confError.item}</code> is out of bounds.
            </p>
            <p class="mb-2">The value must be less than <code>{$confError.len}</code>.</p>
          {:else if $confError.type == 'exception'}
            <p class="mb-2">When {$confError.when}: <code>{$confError.error.message}</code>.</p>
          {:else if $confError.type == 'nan'}
            <p class="mb-2">
              One of the key positions has a value that's not a number. This often happens after an
              update that adds new configuration options, so double check the Advanced tab and make
              sure that every setting is set.
            </p>
          {:else if $confError.type == 'nokeys'}
            <p class="mb-2">
              You silly goose! You can't make a keyboard without keys. <br />That's like riding a
              snowboard without snow.
            </p>
          {:else if $confError.type == 'missing'}
            <p class="mb-2">
              In your configuration, the property <code>{$confError.item}</code> is missing.
            </p>
            {#if $confError.key}
              <p class="mb-2">Check the key with this configuration:</p>
              <pre class="text-xs"><code>{JSON.stringify($confError.key, null, 2)}</code></pre>
            {/if}
          {:else if errorMsg}
            <div>
              {#if $confError.type == 'intersection'}
                {#if $confError.what == 'keycap' && ($confError.i < 0 || $confError.j < 0)}
                  <p class="mb-2">
                    One of the keycaps intersects the walls{#if $confError.travel}&nbsp;when pressed
                      down {$confError.travel[0]}mm{/if}.
                  </p>
                {:else if $confError.what == 'keycap'}
                  <p class="mb-2">
                    Two of the keycaps intersect, either in their current positions or when pressed
                    down{#if $confError.travel}&nbsp;with
                      {$confError.travel[0]}mm of travel{/if}.
                  </p>
                {:else if $confError.what == 'part'}
                  <p class="mb-2">
                    Two of the parts
                    {#if config && ((config?.right ?? config?.unibody).keys[$confError.i].type == 'mx-pcb' || (config?.right ?? config?.unibody).keys[$confError.j].type == 'mx-pcb')}
                      (switches or PCBs)
                    {:else}
                      (switches)
                    {/if} intersect.
                  </p>
                {:else if $confError.what == 'socket' && ($confError.i < 0 || $confError.j < 0)}
                  <p class="mb-2">
                    One of the sockets intersects the walls. This is ok, but the exported model will
                    contains errors and might create problems when slicing.
                  </p>
                {:else if $confError.what == 'socket'}
                  <p class="mb-2">
                    Two of the key sockets intersect. This is ok, but the exported model will
                    contain errors and might create problems when slicing.
                  </p>
                {/if}
                <p class="mb-2">
                  If you're using Advanced mode, you can try adjusting the stagger, increasing the
                  spacing, or adding outwards arc to correct the issue.
                  {#if $confError.what != 'socket'}You can also try decreasing webMinThicknessFactor
                    in expert mode.{/if}
                </p>
                <p class="mb-2">
                  If the issue is within the thumb cluster, increase the vertical and horizontal
                  spacings in Advanced mode or switch to custom thumbs mode.
                </p>
              {:else if $confError.type == 'wallBounds'}
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
              {#if $confError.type == 'intersection'}
                {#if $confError.what == 'keycap' && ($confError.i < 0 || $confError.j < 0)}
                  Keycap + Walls Intersect
                {:else if $confError.what == 'keycap'}
                  Keycaps Intersect
                {:else if $confError.what == 'part'}
                  Parts Intersect
                {:else if $confError.what == 'socket' && ($confError.i < 0 || $confError.j < 0)}
                  Socket + Walls Intersect
                {:else if $confError.what == 'socket'}
                  Sockets Intersect
                {/if}
              {:else if $confError.type == 'wallBounds'}
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
      {:else if (config?.right ?? config?.unibody)?.shell?.type == 'stilts'}
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
        <VisualEditor2
          basic={mode == 'basic'}
          cosmosConf={state.options}
          bind:conf={config}
          bind:geometry={geometry.right}
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
      {:else if !isRenderable($confError)}
        <div class="bg-red-200 m-4 rounded p-4 dark:bg-red-700">
          Bill of Materials will not be available until you fix the errors in your configuration.
        </div>
      {:else}
        {#if (config?.right ?? config?.unibody).shell.type != 'basic'}
          <div class="bg-yellow-200 m-4 rounded p-4 dark:bg-yellow-700">
            Screw information is not yet finished non-standard cases. Make sure to check the model
            for any additional screws needed.
          </div>
        {/if}
        <BomView geometry={geometry.right} conf={config} />
      {/if}
    </div>
  </Dialog>
{/if}
{#if kleView}
  <Dialog big on:close={() => (kleView = false)}>
    <span slot="title">KLE Export</span>
    <div slot="content">
      <KleView conf={config?.right ?? config?.unibody} />
    </div>
  </Dialog>
{/if}
{#if showFit}
  <Dialog big on:close={() => (showFit = false)}>
    <span slot="title">Fit Stagger to Hand</span>
    <div slot="content">
      <HandFitView on:apply={() => (showFit = false)} />
    </div>
  </Dialog>
{/if}
{#if downloading}
  <DownloadDialog
    config={config?.right ?? config?.unibody}
    {pool}
    on:close={() => (downloading = false)}
    on:gopro={() => {
      downloading = false
      proOpen = true
    }}
  />
{/if}

<DarkTheme bind:darkMode />

<style>
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
</style>

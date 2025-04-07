<script lang="ts">
  import { fade } from 'svelte/transition'
  import Login from './lib/Login.svelte'
  import Viewer3D from './lib/viewers/Viewer3D.svelte'
  import Thick3D from './lib/viewers/ViewerThickness.svelte'
  import ViewerLayout from './lib/viewers/ViewerLayout.svelte'
  import ViewerMatrix from './lib/viewers/ViewerMatrix.svelte'
  import ViewerPea from './lib/viewers/ViewerPea.svelte'
  import ViewerBottom from './lib/viewers/ViewerBottom.svelte'
  import ViewerTiming from './lib/viewers/ViewerTiming.svelte'
  import PeaConfig from './lib/editor/PeaConfig.svelte'
  import Popover from 'svelte-easy-popover'
  import Icon from '$lib/presentation/Icon.svelte'
  import * as mdi from '@mdi/js'
  import { estimateFilament, SUPPORTS_DENSITY, type FilamentEstimate } from './lib/filament'
  import * as flags from '$lib/flags'
  import Performance from './lib/Performance.svelte'
  import { base } from '$app/paths'

  import AssemblyView from './lib/dialogs/AssemblyView.svelte'
  import UrlView from './lib/dialogs/URLView.svelte'
  import BomView from './lib/dialogs/BomView.svelte'
  import KleView from './lib/dialogs/KleView.svelte'
  import HandFitView from './lib/dialogs/HandFitView.svelte'
  import Dialog from '$lib/presentation/Dialog.svelte'
  import Footer from './lib/Footer.svelte'
  import Editor from './lib/editor/CodeEditor.svelte'
  import Preset from '$lib/presentation/Preset.svelte'
  import FilamentChart from './lib/FilamentChart.svelte'
  import DarkTheme from './lib/DarkTheme.svelte'
  import { serialize, deserialize, type State } from './lib/serialize'
  import { WorkerPool, type TaskError } from './lib/workerPool'
  import {
    fullEstimatedCenter,
    fullEstimatedSize,
    newFullGeometry,
    setBottomZ,
    type Cuttleform,
    type FullCenter,
    type FullCuttleform,
  } from '$lib/worker/config'
  import { checkConfig, type ConfErrors, isRenderable, isWarning, salientError } from '$lib/worker/check'
  import VisualEditor2 from './lib/editor/VisualEditor2.svelte'
  import { Matrix4 } from 'three'
  import {
    codeError,
    protoConfig,
    showHand,
    stiltsMsg,
    developer,
    showTiming,
    noWall,
    noBase,
    tempConfig,
    confError,
    view,
    noBlanks,
    noLabels,
    showGrid,
    showHelp,
    assemblyIsNew,
  } from '$lib/store'
  import { onDestroy } from 'svelte'
  import { browser } from '$app/environment'
  import { hasPro } from '@pro'
  import ViewerDev from './lib/viewers/ViewerDev.svelte'
  import DownloadDialog from './lib/dialogs/DownloadDialog.svelte'
  import { fromCosmosConfig, toFullCosmosConfig } from '$lib/worker/config.cosmos'
  import KeyboardModel from '$lib/3d/KeyboardModel.svelte'
  import { type FullGeometry, type FullKeyboardMeshes } from './lib/viewers/viewer3dHelpers'
  import { notNull, objEntriesNotNull, objKeys } from '$lib/worker/util'
  import { T } from '@threlte/core'
  import Checkbox from '$lib/presentation/Checkbox.svelte'
  import type { unibody } from '$lib/worker/modeling/transformation-ext'
  import ConfError from './lib/ConfError.svelte'
  import { SORTED_VENDORS } from '@pro/assemblyService'
  import { microcontrollerConnectors } from '$lib/geometry/microcontrollers'

  const DEF_CENTER = [-35.510501861572266, -17.58449935913086, 35.66889877319336] as [
    number,
    number,
    number
  ]
  let centers: FullCenter = {
    left: { left: DEF_CENTER, unibody: DEF_CENTER },
    both: {
      left: [0, DEF_CENTER[1], DEF_CENTER[2]],
      right: [0, DEF_CENTER[1], DEF_CENTER[2]],
      unibody: [0, DEF_CENTER[1], DEF_CENTER[2]],
    },
    right: { right: DEF_CENTER, unibody: DEF_CENTER },
  }
  $: center = centers[$view]
  let sizes = fullEstimatedSize(undefined)
  $: size = sizes[$view]
  let filament: FilamentEstimate | undefined
  let referenceElement
  let referenceElementTools: HTMLButtonElement
  let referenceElementPrefs: HTMLButtonElement
  let darkMode: boolean
  let prefsOpen: boolean
  let assemblyOpen: boolean
  let lemonSwitch: boolean

  let proOpen = false
  let editorContent: string
  let hideWall = false
  let lastRenderNumber = 0
  let fullMatrix: any = undefined

  // @ts-ignore
  let state: State = deserialize(browser ? location.hash.substring(1) : '', () =>
    deserialize('cm', null)
  )
  if (state.error)
    confError.set([{ type: 'exception', error: state.error, side: 'right', when: 'parsing URL' }])
  $: $confError.forEach((e) => {
    if (e && e.type == 'exception') console.error(e.error)
  })
  console.log('state', state)
  let initialEditorContent = state.content

  function onHashChange() {
    const newHash = location.hash.substring(1)
    const oldHash = stateToHash()
    if (!newHash.startsWith('cf')) {
      console.log('URL CHANGE: Change state? =', oldHash != newHash)
      if (oldHash != newHash) {
        // The page navigated!
        state = deserialize(location.hash.substring(1), () => deserialize('cm', null))
        const newMode = state.content ? 'advanced' : 'basic'
        if (state.content) initialEditorContent = state.content
        if (mode === 'advanced' && newMode !== 'advanced') {
          initialEditorContent = undefined // So the editor resets
        }
        if (newMode != 'advanced' && viewer == 'programming') {
          protoConfig.set(state.options)
          config = fromCosmosConfig(state.options)
        }
        mode = newMode
      }
    }
  }

  let ocError: TaskError | undefined
  let generatorProgress = 1
  let showSupports = false

  let mode = state.content ? 'advanced' : 'basic'
  let viewer = '3d'
  let transparency = 95

  let downloading = false
  let urlView = false
  let bomView = false
  let kleView = false
  let showFit = false
  let showUpgraded = true

  $: cTransparency = showSupports ? 0 : transparency

  const pool = new WorkerPool<typeof import('$lib/worker/api')>(4, () => {
    return new Worker(new URL('$lib/worker?worker', import.meta.url), { type: 'module' })
  })
  const tempPool = new WorkerPool<typeof import('$lib/worker/api')>(1, () => {
    return new Worker(new URL('$lib/worker?worker', import.meta.url), { type: 'module' })
  })
  onDestroy(() => {
    pool.reset()
    tempPool.reset()
  })

  function stateToHash() {
    if (mode != 'advanced')
      return serialize({
        keyboard: 'cm',
        options: $protoConfig,
      })
    return editorContent
  }

  $: if ($protoConfig || (mode == 'advanced' && editorContent))
    try {
      config // Hack to force updates when config changes
      if (mode != 'advanced') {
        console.log('Setting hash', stateToHash())
        if (window.location.hash.startsWith('#cf'))
          window.history.replaceState(null, '', '#' + stateToHash())
        else window.location.hash = stateToHash()
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
  let microcontrollerGeometry: FullGeometry = {}
  $: if (config && browser) {
    debounceprocess2(config)
  }

  // Try to process ASAP, but if render queue is full wait 1 second then render
  // in that 1 second, new renders can steal the work, cancelling the previous render task
  let processTimer = 0
  async function debounceprocess2(config: FullCuttleform) {
    console.log('FULL PROCESS', pool.someAvailable())
    if (pool.someAvailable()) process(config, true).catch((e) => console.error(e))
    else {
      // Use the temp renderer to make a render
      microcontrollerGeometry = geometry = newFullGeometry(config)
      if (tempPool.someAvailable()) await process(config, false)

      if (processTimer) clearTimeout(processTimer)
      processTimer = window.setTimeout(() => process(config, true).catch((e) => console.error(e)), 500)
    }
  }

  $: if ($tempConfig && browser) {
    debounceprocess(fromCosmosConfig($tempConfig), $tempConfig.fromProto).catch((e) => console.error(e))
  }

  async function debounceprocess(config: FullCuttleform, fromProto: boolean) {
    if (fromProto) return
    console.log('TEMP PROCESS', tempPool.someAvailable())
    if (tempPool.someAvailable()) await process(config, false)
    else geometry = newFullGeometry(config) // Otherwise still update geometry so keyboard changes
  }

  let meshes: FullKeyboardMeshes = {}

  function cloneConfig(c: FullCuttleform) {
    return {
      left: c.left ? { ...c.left, shell: { ...c.left.shell } } : undefined,
      right: c.right ? { ...c.right, shell: { ...c.right.shell } } : undefined,
      unibody: c.unibody ? { ...c.unibody, shell: { ...c.unibody.shell } } : undefined,
    }
  }

  function areDifferent(c1: any, c2: any) {
    if (c1 == undefined && c2 == undefined) return []
    if (c1 == undefined && c2 != undefined) return ['everything']
    if (c1 != undefined && c2 == undefined) return ['everything']
    const differences = []

    for (const prop of new Set([...Object.keys(c1), ...Object.keys(c2)])) {
      if (prop == 'bottomZ') continue
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
      (w) => w.intersections(conf, side) as Promise<ConfErrors>,
      'Intersections'
    ),
    cutPromise: pool.execute((w) => w.cutWall(conf), 'Cut wall'),
    holderPromise: pool.execute((w) => w.generateBoardHolder(conf), 'Holder'),
    screwPromise: pool.execute((w) => w.generateScrewInserts(conf), 'Inserts'),
    wristRestPromise:
      hasPro && pool.execute((w) => w.generateWristRest(conf, side == 'left'), 'Wrist Rest'),
    secondWristRestPromise:
      hasPro &&
      side == 'unibody' &&
      pool.execute((w) => w.generateMirroredWristRest(conf), 'Wrist Rest 2'),
    cutPlatePromise: pool.execute((w) => w.generatePlate(conf, true), 'Full Plate'),
  })

  function updateCenters(config: FullCuttleform, geo: FullGeometry) {
    centers = fullEstimatedCenter(geo)
    center = centers[$view]
    sizes = fullEstimatedSize(geo)
    console.log('sizes are', sizes)
    size = sizes[$view]
  }

  let oldTempConfig: FullCuttleform | null = null
  let oldConfig: FullCuttleform | null = null
  async function process(conf: FullCuttleform, full: boolean) {
    const kbdNames = objKeys(conf)
      .filter((k) => !!conf[k])
      .sort((a, b) => b.localeCompare(a)) // Make sure right keyboard comes first
    if (oldConfig && geometry && full) {
      const differences = areDifferent2(oldConfig, conf)
      console.log('differences', differences)
      if (differences.length == 0) return
      oldConfig = cloneConfig(conf)
      oldTempConfig = cloneConfig(conf)

      if (
        differences.every((d) => d == 'wristRestLeft' || d == 'wristRestRight' || d == 'wristRestOrigin')
      ) {
        const renderNumber = ++lastRenderNumber
        console.log('PROCESSING WRIST REST', renderNumber)
        try {
          ocError = undefined
          generatorProgress = 0.5
          updateCenters(config, geometry)
          if (conf.unibody) {
            pool.reset(2)
            const wristMeshes = await Promise.all([
              pool.execute((w) => w.generateWristRest(conf.unibody!), 'Wrist Rest'),
              pool.execute((w) => w.generateMirroredWristRest(conf.unibody!), 'Wrist Rest 2'),
            ])
            if (renderNumber >= lastRenderNumber) {
              meshes.unibody!.wristBuf = wristMeshes[0].mesh ?? undefined
              meshes.unibody!.secondWristBuf = wristMeshes[1].mesh ?? undefined
            }
          } else {
            pool.reset(kbdNames.length)
            const wristMeshes = await Promise.all(
              kbdNames.map((k) =>
                pool.execute((w) => w.generateWristRest(conf[k]!, k == 'left'), 'Wrist Rest')
              )
            )
            if (renderNumber >= lastRenderNumber) {
              wristMeshes.forEach((wristMesh, i) => {
                meshes[kbdNames[i]]!.wristBuf = wristMesh.mesh ?? undefined
              })
            }
          }
          generatorProgress = 1
          ocError = undefined
        } catch (e) {
          console.error(e)
          ocError = e as TaskError
        }
        return
      }
    } else if (full) {
      oldConfig = cloneConfig(conf)
      oldTempConfig = cloneConfig(conf)
    } else {
      if (oldTempConfig) {
        const differences = areDifferent2(oldTempConfig, conf)
        if (differences.length == 0) return
      }
      oldTempConfig = cloneConfig(conf)
    }

    let originalErr: ConfErrors = []
    for (const kbd of kbdNames) {
      originalErr = checkConfig(conf[kbd]!, undefined, false, kbd)
      if (originalErr.length) break
    }
    if (kbdNames.length == 0) originalErr = [{ type: 'nokeys', side: 'unibody' }]
    if (!!conf.left != !!conf.right)
      originalErr = [{ type: 'nokeys', side: !conf.left ? 'left' : 'right' }]
    confError.set(originalErr)
    if (!isRenderable(originalErr)) return

    const renderNumber = ++lastRenderNumber
    console.log('PROCESSING', renderNumber)
    try {
      setBottomZ(conf)
    } catch (e) {
      confError.set([
        {
          type: 'exception',
          error: e as Error,
          side: 'right',
          when: 'Setting keyboard bottom',
        },
      ])
      return
    }
    const newGeo = newFullGeometry(conf)
    geometry = newGeo
    microcontrollerGeometry = newGeo
    console.log('GENERATING. conf incoming', conf)
    for (const kbd of kbdNames) {
      originalErr = checkConfig(conf[kbd]!, newGeo[kbd]!, full, kbd)
      if (originalErr.length) break
    }
    confError.set(originalErr)
    if (!isRenderable(originalErr)) return

    // Reset the state
    ocError = undefined
    console.log('Generating!')
    // modelOpacity = 0.2

    const pl = full ? pool : tempPool
    if (full) pool.reset()
    try {
      const quickPromises = kbdNames.map((k) => pl.execute((w) => w.generateQuick(conf[k]!), 'Preview'))
      const otherPromises =
        !flags.fast && full ? kbdNames.map((k) => calcOtherPromises(conf[k]!, k)) : []

      if (full) {
        generatorProgress = 0.1
        updateCenters(config, newGeo)
      }
      const quickResults = await Promise.all(quickPromises)
      if (renderNumber >= lastRenderNumber) {
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
      }

      if (!flags.fast && full) {
        const queue = otherPromises.flatMap((p, i) =>
          notNull(Object.values(p)).map((q) => ({ i, kbd: kbdNames[i], prom: q }))
        )
        const initialLength = queue.length
        const errors: Error[] = []
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
          if (renderNumber >= lastRenderNumber)
            generatorProgress = 0.2 + ((initialLength - queue.length) / initialLength) * 0.8
          if (error) {
            errors.push(error)
            continue
          }
          if (finished.prom == otherPromises[finished.i].intersectionsPromise) {
            originalErr = [...originalErr, ...result]
            confError.set(originalErr)
          } else if (renderNumber >= lastRenderNumber) {
            if (finished.prom == otherPromises[finished.i].holderPromise) {
              if (conf[finished.kbd]!.microcontroller) meshes[finished.kbd]!.holderBuf = result.mesh
            } else if (finished.prom == otherPromises[finished.i].screwPromise) {
              meshes[finished.kbd]!.screwBaseBuf = result.baseInserts.mesh
              meshes[finished.kbd]!.screwPlateBuf = result.plateInserts.mesh
            } else if (finished.prom == otherPromises[finished.i].cutPromise) {
              meshes[finished.kbd]!.wallBuf = result.mesh
            } else if (finished.prom == otherPromises[finished.i].wristRestPromise) {
              meshes[finished.kbd]!.wristBuf = result.mesh
            } else if (finished.prom == otherPromises[finished.i].secondWristRestPromise) {
              meshes[finished.kbd]!.secondWristBuf = result.mesh
            } else if (finished.prom == otherPromises[finished.i].cutPlatePromise) {
              meshes[finished.kbd]!.plateTopBuf = result.top.mesh
              meshes[finished.kbd]!.plateBotBuf = result.bottom.mesh || undefined
            }
          }
        }
        if (errors.length) throw errors[0]

        let volume = 0
        let supportVolume = 0
        for (let i = 0; i < otherPromises.length; i++) {
          volume +=
            (await otherPromises[i].cutPromise).mass +
            quickResults[i].web.mass +
            quickResults[i].keys.mass +
            (await otherPromises[i].screwPromise).plateInserts.mass +
            (await otherPromises[i].screwPromise).baseInserts.mass
          supportVolume +=
            (await otherPromises[i].cutPromise).supports.volume +
            quickResults[i].web.supports.volume +
            quickResults[i].keys.supports.volume
        }

        if (renderNumber >= lastRenderNumber) {
          filament = estimateFilament(volume, supportVolume)
          for (let i = 0; i < kbdNames.length; i++) {
            meshes[kbdNames[i]]!.supportGeometries = [
              (await otherPromises[i].cutPromise).supports,
              quickResults[i].web.supports,
              quickResults[i].keys.supports as any,
            ]
          }
        }
      }
      if (full && renderNumber >= lastRenderNumber) generatorProgress = 1
      ocError = undefined
    } catch (e) {
      console.error(e)
      ocError = e as TaskError
    }
  }

  function setMode(newMode: string) {
    if (mode === 'advanced' && newMode !== 'advanced') {
      // if (!confirm('Are you sure you wish to exit expert mode? Your work will not be saved.')) return
      try {
        state.options = toFullCosmosConfig(config, true)
        initialEditorContent = undefined // So the editor resets
      } catch (e) {
        console.error(e)
        alert('Could not convert your expert mode config. Was there an error in it?')
      }
    }
    mode = newMode
  }

  $: hasLemon = (config?.right || config?.unibody)?.microcontroller?.startsWith('lemon')
  function switchUC(uc: string) {
    $protoConfig.microcontroller = uc
    lemonSwitch = false

    try {
      const { mirrorConnectors, connectors } = microcontrollerConnectors(
        $protoConfig.microcontroller,
        $protoConfig.connectors
      )
      $protoConfig.connectors = connectors
      $protoConfig.mirrorConnectors = mirrorConnectors
      config = fromCosmosConfig($protoConfig)
    } catch (e) {
      alert('Error generating with a Lemon. reverting...')
    }
  }

  $: keyboardEntries = objEntriesNotNull(meshes).filter(
    ([s, v]) => s == 'unibody' || $view == 'both' || $view == s
  )
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

  <a class="hoverbtn" href="https://cosmos-store.ryanis.cool?utm_source=generator">
    <Icon path={mdi.mdiShopping} />
    Store
  </a>
  <a class="hoverbtn" href="showcase/">
    <Icon path={mdi.mdiSealVariant} />
    Showcase
  </a>
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
{#if assemblyOpen}
  <AssemblyView
    {size}
    {center}
    meshes={keyboardEntries}
    geometry={microcontrollerGeometry}
    on:close={() => (assemblyOpen = false)}
  />
{:else}
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
          <input class="relative z-10 mx-2" type="range" min="0" max="100" bind:value={transparency} />
          {#if flags.hand}<Preset
              purple
              square
              class="relative z-10"
              on:click={() => ($showHand = !$showHand)}
              selected={$showHand}><Icon path={mdi.mdiHandBackRightOutline} /></Preset
            >{/if}
          <Preset
            purple
            square
            class="relative z-10 !px-2"
            bind:button={referenceElementPrefs}
            on:click={() => (prefsOpen = !prefsOpen)}
            selected={prefsOpen}><Icon path={mdi.mdiCogOutline} /></Preset
          >
        </div>
        <div style="--z-index: 1000">
          <Popover
            referenceElement={referenceElementPrefs}
            placement="bottom-end"
            spaceAway={4}
            bind:isOpen={prefsOpen}
          >
            <div
              class="bg-[#f8f5ff]/80 dark:bg-gray-900/80 backdrop-blur-md px-2 py-1 mr-[-.5rem] rounded-2 text-small select-none"
              in:fade={{ duration: 50 }}
              out:fade={{ duration: 150 }}
            >
              <div>
                <button
                  title="View Left Side Only"
                  class="basicbutton px-2 rounded-l"
                  on:click={() => ($view = 'left')}
                  class:selected={$view == 'left'}><Icon name="kb-left" /></button
                >
                <button
                  title="View Both Sides"
                  class="basicbutton px-2"
                  on:click={() => ($view = 'both')}
                  class:selected={$view == 'both'}><Icon name="kbs" /></button
                >
                <button
                  title="View Right Side Only"
                  class="basicbutton px-2 rounded-r"
                  on:click={() => ($view = 'right')}
                  class:selected={$view == 'right'}><Icon name="kb-right" /></button
                >
              </div>
              <label class="flex items-center mt-2 mb-4">
                <Checkbox small purple basic bind:value={$showGrid} /> Show Grid
              </label>
              <label class="flex items-center my-2">
                <Checkbox small purple basic bind:value={$noWall} /> Hide Wall
              </label>
              <label class="flex items-center my-2">
                <Checkbox small purple basic bind:value={$noBase} /> Hide Base
              </label>
              <label class="flex items-center my-2">
                <Checkbox small purple basic bind:value={$noLabels} /> Hide Labels
              </label>
              <label class="flex items-center my-2">
                <Checkbox small purple basic bind:value={$noBlanks} /> Hide Shapers
              </label>
              <button
                class="text-center text-sm w-full opacity-70"
                on:click={() => {
                  $showHelp = true
                  prefsOpen = false
                }}>Show Help</button
              >
            </div>
          </Popover>
        </div>
        <div class="xl:hidden" style="--z-index: 50">
          <Popover
            triggerEvents={['click']}
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
            geometry={microcontrollerGeometry}
            transparency={cTransparency}
            conf={isRenderable($confError) ? config?.right ?? config?.unibody : undefined}
            isExpert={mode == 'advanced'}
            {showSupports}
            {center}
            bind:showFit
            enableZoom={true}
            showHand={$showHand}
            progress={generatorProgress}
            {size}
          >
            {#each keyboardEntries as [kbd, mesh] (kbd)}
              {@const cent = center[kbd]}
              {#if cent}
                <T.Group position={[-cent[0], -cent[1], -cent[2]]} scale.x={kbd == 'left' ? -1 : 1}>
                  <KeyboardModel
                    side={kbd}
                    {hideWall}
                    {transparency}
                    {showSupports}
                    microcontrollerGeometry={microcontrollerGeometry[kbd]}
                    meshes={mesh}
                  />
                </T.Group>
              {/if}
            {/each}
          </Viewer3D>
        {:else if viewer == 'thick'}
          <Thick3D
            geometry={isRenderable($confError) ? geometry : undefined}
            {center}
            enableZoom={true}
            {darkMode}
            {size}
          >
            {#each keyboardEntries as [kbd, mesh] (kbd)}
              {@const cent = center[kbd]}
              {#if cent}
                <T.Group position={[-cent[0], -cent[1], -cent[2]]} scale.x={kbd == 'left' ? -1 : 1}>
                  <KeyboardModel
                    side={kbd}
                    noWeb
                    {hideWall}
                    {transparency}
                    {showSupports}
                    microcontrollerGeometry={microcontrollerGeometry[kbd]}
                    meshes={mesh}
                  />
                </T.Group>
              {/if}
            {/each}
          </Thick3D>
        {:else if viewer == 'top'}
          <ViewerLayout {geometry} {darkMode} conf={config} confError={$confError} />
        {:else if viewer == 'programming'}
          {#if hasLemon}
            <ViewerPea {geometry} {darkMode} confError={$confError} bind:fullMatrix />
          {:else}
            <ViewerMatrix {geometry} {darkMode} confError={$confError} />
          {/if}
        {:else if viewer == 'board'}
          <ViewerBottom {geometry} {darkMode} confError={$confError} />
        {:else if viewer == 'timing'}
          <ViewerTiming {pool} {darkMode} />
        {:else if viewer == 'dev'}
          <ViewerDev />
        {/if}
        {#if filament && isRenderable($confError) && (config?.right ?? config?.unibody).shell?.type == 'basic'}
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
                    Estimated {#if config.right}for 2 halves{/if} using
                    <span class="font-semibold text-teal-500 dark:text-teal-400">100% infill</span>,<br
                    /><span class="font-semibold text-purple-500 dark:text-purple-400"
                      >{SUPPORTS_DENSITY * 100}% supports density</span
                    >.
                  </p>
                  <p class="whitespace-nowrap mb-1">
                    This will cost about <span class="font-semibold text-black dark:text-white"
                      >${filament.cost.toFixed(2)}</span
                    >.
                  </p>
                  <p class="whitespace-nowrap text-sm">
                    The keyboard itself uses {filament.keyboard.length.toFixed(1)}m ({filament.keyboard.mass.toFixed(
                      0
                    )}g).
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
        {:else if $confError.length && viewer == '3d'}
          <ConfError {config} {mode} />
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
            <div class="absolute text-white m-4 left-0 right-0 rounded p-4 top-[5%] bg-yellow-700 flex">
              <div>
                <p>
                  Stilts mode is <b>very</b> tempermental. Not every model will work with it. Try to keep
                  very smooth curves between keys, and
                  <button class="underline" on:click={() => (hideWall = !hideWall)}
                    >{hideWall ? 'show' : 'hide'} the walls</button
                  > to check for bad geometry.
                </p>
                <p class="text-sm mt-2">
                  While I like hearing what kind of bugs you find, please don't tell be about bugs in
                  stilts mode. There are too many to keep track of and countless weeks to be spent trying
                  to fix them.
                </p>
              </div>
              <div class="flex-0 pl-2">
                <button on:click={() => ($stiltsMsg = !$stiltsMsg)}
                  ><Icon path={mdi.mdiArrowCollapseUp} /></button
                >
              </div>
            </div>
          {:else}
            <div class="absolute text-white m-4 right-[80px] rounded p-4 top-[10%] bg-yellow-700 flex">
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
        {#if flags.lemons && !hasLemon}
          <button
            class="relative bg-teal-500/10 hover:bg-teal-500/30 rounded mt-8 px-4 py-2 ml--2 text-start"
            on:click={() => (lemonSwitch = true)}
          >
            <span class="font-medium">Autogenerate your firmware with Lemon microcontrollers.</span>
            <div class="mt-2 flex gap-4 items-center">
              <div class="text-sm">
                <span class="opacity-70"
                  >Because of the Lemon's structured I/Os, Cosmos can automate mapping your keyboard
                  matrix and generating a firmware.</span
                >
                <span class="ml-0.5" />
              </div>
              <div
                class="rounded-full bg-teal-200 dark:bg-teal-600 flex items-center justify-center w-8 h-8 flex-none"
              >
                <Icon size={24} path={mdi.mdiChevronRight} />
              </div>
            </div></button
          >
        {/if}
        {#if hasLemon}
          {#if fullMatrix}
            <PeaConfig {config} {geometry} matrix={fullMatrix} />
          {:else}
            <p class="mt-4 mb-2">Autogenerate your firmware with peaMK!</p>
            <ol class="list-decimal ml-6">
              <li>Download and flash peaMK to your microcontroller.</li>
              <li>Press the indicated blue key (on the right) on your keyboard.</li>
              <li>If a key doesn't work, double check your wiring.</li>
              <li>When all keys have been pressed Cosmos will auto-generate your firmware.</li>
            </ol>
          {/if}
        {:else}
          <p class="mt-4 mb-2">Some things that will happen here in the future:</p>
          <ul class="list-disc pl-4">
            <li>The thumb cluster matrix will be wired more efficiently</li>
            <li>The thumb cluster matrix will be connected to the larger key matrix</li>
            <li>The generator will make a QMK template for you to use</li>
            <li>And maybe a generated assembly / wiring guide</li>
          </ul>
        {/if}
      {:else}
        <div class="flex items-center justify-between mr-2">
          <div>
            <Preset purple on:click={() => setMode('basic')} name="Basic" selected={mode == 'basic'} />
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
            <button class="infobutton" on:click={() => (bomView = true)}>View Bill of Materials</button>
          </div>
        </div>

        {#if flags.assembly && hasPro}
          <button
            class="relative bg-teal-500/10 hover:bg-teal-500/30 rounded mt-8 px-4 py-2 ml--2 text-start"
            class:hover:animate-wiggle={$assemblyIsNew}
            on:click={() => (assemblyOpen = true) && ($assemblyIsNew = false)}
          >
            {#if $assemblyIsNew}
              <div class="absolute right-2 top--3 bg-teal-600 text-white px-2 rotate-5 rounded">NEW</div>
            {/if}
            <b class="text-teal-600 dark:text-teal-400">No Time to Tinker?</b>
            <span class="font-medium">Buy Keyboard Assembled and Ready to Use.</span>
            <div class="mt-2 flex gap-4 items-center">
              <div class="text-sm">
                <span class="opacity-70"
                  >You can now get your hands on your dream keyboard faster &amp; easier. Ships globally
                  in 1–2 weeks from</span
                >
                <span class="ml-0.5" />
                {#each SORTED_VENDORS as vendor}
                  <Icon class="inline mx-0.5 mt--0.5" size="1.3em" name="flag-{vendor.flag}" />
                {/each}
              </div>
              <div
                class="rounded-full bg-teal-200 dark:bg-teal-600 flex items-center justify-center w-8 h-8 flex-none"
              >
                <Icon size={24} path={mdi.mdiChevronRight} />
              </div>
            </div>
          </button>
        {:else}
          <div class="bg-teal-500/10 rounded my-4 px-4 py-2 mx--2">
            <b class="text-teal-600">Coming Soon!</b>
            <span class="font-medium">Buy Your Keyboard Assembled and Ready to Use.</span>
            <p class="text-sm mt-2 opacity-70">
              I'll be pairing up with a couple keyboard makers/enthusiasts so you can get your hands on
              your dream keyboard faster &amp; easier. <a
                class="underline"
                href="{base}/docs/assembly-service/">Learn more.</a
              >
            </p>
          </div>
        {/if}

        {#if mode == 'basic' || mode == 'intermediate'}
          {#if !state.error}
            <VisualEditor2
              basic={mode == 'basic'}
              cosmosConf={state.options}
              bind:conf={config}
              on:goAdvanced={() => (mode = 'intermediate')}
            />
          {/if}
        {:else}
          <Editor
            bind:initialContent={initialEditorContent}
            bind:hashContent={editorContent}
            {darkMode}
            cosmosConf={state.options}
            bind:conf={config}
          />
        {/if}
      {/if}
    </div>
  </main>
{/if}
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
            Screw information is not yet finished non-standard cases. Make sure to check the model for
            any additional screws needed.
          </div>
        {/if}
        <BomView {geometry} />
      {/if}
    </div>
  </Dialog>
{/if}
{#if kleView}
  <Dialog big on:close={() => (kleView = false)}>
    <span slot="title">KLE Export</span>
    <div slot="content">
      <KleView conf={config} geo={geometry} />
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
    {config}
    {pool}
    on:close={() => (downloading = false)}
    on:gopro={() => {
      downloading = false
      proOpen = true
    }}
  />
{/if}
{#if lemonSwitch}
  <Dialog on:close={() => (lemonSwitch = false)}>
    <span slot="title">Switch to a Lemon microcontroller?</span>
    <div slot="content" class="text-center">
      {#if mode === 'advanced'}
        Sorry, you'll need to manually change the microcontroller in your Expert mode code.
      {:else}
        <p class="mb-4">
          Learn more about the microcontrollers on the <a
            class="underline"
            href="https://ryanis.cool/cosmos/lemon">Lemon microcontroller homepage</a
          >.
        </p>
        <button class="button" on:click={() => switchUC('lemon-wired')}>Lemon Wired</button>
        <button class="button" on:click={() => switchUC('lemon-wireless')}>Lemon Wireless</button>
      {/if}
    </div>
  </Dialog>
{/if}
<!-- {#if state.upgradedFrom == 'cf' && showUpgraded}
  <Dialog big on:close={() => (showUpgraded = false)}>
    <span slot="title">Your model has been upgraded!</span>
    <div slot="content">Hey.</div>
  </Dialog>
{/if} -->

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

  .basicbutton {
    --at-apply: 'bg-purple-100 dark:bg-gray-900/50 hover:bg-purple-200 dark:hover:bg-pink-900/70 py-1 focus:outline-none border border-transparent focus:border-pink-500';
  }
  .basicbutton.selected {
    --at-apply: 'bg-purple-400 dark:bg-pink-700';
  }

  input[type='range'] {
    --at-apply: 'appearance-none bg-transparent';
  }

  input[type='range']::-moz-range-track {
    --at-apply: 'appearance-none bg-[#EFE8FF] dark:bg-slate-900 h-2 rounded';
  }

  input[type='range']::-webkit-slider-runnable-track {
    --at-apply: 'appearance-none bg-[#EFE8FF] dark:bg-slate-900 h-2 rounded';
  }

  input[type='range']::-moz-range-thumb {
    --at-apply: "appearance-none w-6 h-6 bg-purple-300 dark:bg-pink-600 rounded-full border-transparent bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJibGFjayIgc3Ryb2tlLXdpZHRoPSIxLjYiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBhdGggZD0iTTMuOSA4LjIgMyAxOC40QzMgMTguOCAzIDE5LjIgMy4yIDE5LjVMMy40IDE5LjlBMiAyIDAgMDA1LjIgMjFIMTguOEEyIDIgMCAwMDIwLjYgMTkuOUwyMC44IDE5LjVDMjAuOSAxOS4yIDIxIDE4LjggMjEgMTguNEwyMC4xIDguMkE0IDQgMCAwMDE5LjMgNi4xTDE3IDNTMTQgMy41IDEyIDMuNSA3IDMgNyAzTDQuNyA2LjFBNCA0IDAgMDAzLjkgOC4yWk03IDNzMyAuNSA1IC41IDUtLjUgNS0uNWwxIDlzLTMgMS02IDEtNi0xLTYtMWwxLTl6TTYgMTJsLTIuNSA4TTE4IDEybDIuNSA4Ii8+PC9zdmc+')] dark:bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLXdpZHRoPSIxLjgiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBhdGggZD0iTTMuOSA4LjIgMyAxOC40QzMgMTguOCAzIDE5LjIgMy4yIDE5LjVMMy40IDE5LjlBMiAyIDAgMDA1LjIgMjFIMTguOEEyIDIgMCAwMDIwLjYgMTkuOUwyMC44IDE5LjVDMjAuOSAxOS4yIDIxIDE4LjggMjEgMTguNEwyMC4xIDguMkE0IDQgMCAwMDE5LjMgNi4xTDE3IDNTMTQgMy41IDEyIDMuNSA3IDMgNyAzTDQuNyA2LjFBNCA0IDAgMDAzLjkgOC4yWk03IDNzMyAuNSA1IC41IDUtLjUgNS0uNWwxIDlzLTMgMS02IDEtNi0xLTYtMWwxLTl6TTYgMTJsLTIuNSA4TTE4IDEybDIuNSA4Ii8+PC9zdmc+')]";
    background-size: 1.3rem 1.3rem;
    background-position: center 40%;
    background-repeat: no-repeat;
  }

  input[type='range']::-webkit-slider-thumb {
    --at-apply: "appearance-none w-6.8 h-6.8 bg-purple-300 dark:bg-pink-600 rounded-full border-transparent mt--2.4 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJibGFjayIgc3Ryb2tlLXdpZHRoPSIxLjYiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBhdGggZD0iTTMuOSA4LjIgMyAxOC40QzMgMTguOCAzIDE5LjIgMy4yIDE5LjVMMy40IDE5LjlBMiAyIDAgMDA1LjIgMjFIMTguOEEyIDIgMCAwMDIwLjYgMTkuOUwyMC44IDE5LjVDMjAuOSAxOS4yIDIxIDE4LjggMjEgMTguNEwyMC4xIDguMkE0IDQgMCAwMDE5LjMgNi4xTDE3IDNTMTQgMy41IDEyIDMuNSA3IDMgNyAzTDQuNyA2LjFBNCA0IDAgMDAzLjkgOC4yWk03IDNzMyAuNSA1IC41IDUtLjUgNS0uNWwxIDlzLTMgMS02IDEtNi0xLTYtMWwxLTl6TTYgMTJsLTIuNSA4TTE4IDEybDIuNSA4Ii8+PC9zdmc+')] dark:bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLXdpZHRoPSIxLjgiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBhdGggZD0iTTMuOSA4LjIgMyAxOC40QzMgMTguOCAzIDE5LjIgMy4yIDE5LjVMMy40IDE5LjlBMiAyIDAgMDA1LjIgMjFIMTguOEEyIDIgMCAwMDIwLjYgMTkuOUwyMC44IDE5LjVDMjAuOSAxOS4yIDIxIDE4LjggMjEgMTguNEwyMC4xIDguMkE0IDQgMCAwMDE5LjMgNi4xTDE3IDNTMTQgMy41IDEyIDMuNSA3IDMgNyAzTDQuNyA2LjFBNCA0IDAgMDAzLjkgOC4yWk03IDNzMyAuNSA1IC41IDUtLjUgNS0uNWwxIDlzLTMgMS02IDEtNi0xLTYtMWwxLTl6TTYgMTJsLTIuNSA4TTE4IDEybDIuNSA4Ii8+PC9zdmc+')]";
    background-size: 1.3rem 1.3rem;
    background-position: center 40%;
    background-repeat: no-repeat;
  }

  input[type='range']::-moz-range-thumb:hover {
    --at-apply: 'bg-purple-400 dark:bg-pink-800';
  }
  input[type='range']::-webkit-slider-thumb:hover {
    --at-apply: 'bg-purple-400 dark:bg-pink-800';
  }

  :global(.inline-flag) {
    --at-apply: 'inline skew-x--5';
  }

  .hoverbtn {
    --at-apply: 'mr-3 flex items-center justify-start gap-2 border-2 max-w-9 hover:max-w-32 px-1.5 hover:px-3 py-1 rounded border-gray-500/20 hover:border-gray-500 transition-border-color text-gray-600 dark:text-gray-200 transition-all overflow-hidden';
  }
  :global(.hoverbtn svg) {
    --at-apply: 'flex-none';
  }
</style>

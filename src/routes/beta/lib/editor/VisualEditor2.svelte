<script lang="ts">
  import {
    cuttleConf,
    type CuttleformProto,
    type Geometry,
    cScrewHeight,
    cosmosFingers,
    approximateCosmosThumbOrigin,
    decodeTuple,
    encodeTuple,
    type FullCuttleform,
    newFullGeometry,
  } from '$lib/worker/config'
  import {
    MICROCONTROLLER_NAME,
    PLATE_ART,
    PROFILE,
    SCREW_SIZE,
    type ConnectorType,
    type MicrocontrollerName,
    type Profile,
  } from '../../../../../target/cosmosStructs'
  import Section from './Section.svelte'
  import DecimalInput from './DecimalInput.svelte'
  import AngleInput from './AngleInput.svelte'
  import cuttleform from '$assets/cuttleform.json'
  import Preset from '$lib/presentation/Preset.svelte'
  import InfoBox from '$lib/presentation/InfoBox.svelte'
  import { TupleStore } from './tuple'

  import { createEventDispatcher } from 'svelte'
  import { protoConfig, tempConfig } from '$lib/store'
  import { hasPro } from '@pro'
  import {
    BOARD_PROPERTIES,
    MICROCONTROLLER_SIZES,
    sortMicrocontrollers,
    microcontrollerConnectors,
  } from '$lib/geometry/microcontrollers'
  import {
    fromCosmosConfig,
    mirrorCluster,
    partVariant,
    toCosmosConfig,
    type ConnectorMaybeCustom,
    type CosmosKey,
    type CosmosKeyboard,
    type PartType,
  } from '$lib/worker/config.cosmos'
  import Field from '$lib/presentation/Field.svelte'
  import Checkbox from '$lib/presentation/Checkbox.svelte'
  import CheckboxOpt from '$lib/presentation/CheckboxOptDef.svelte'
  import Select from '$lib/presentation/Select.svelte'
  import { capitalize, mapObj, mapObjNotNull, notNull, objEntries, objKeys } from '$lib/worker/util'
  import { profileName, sortProfiles, type FullGeometry } from '../viewers/viewer3dHelpers'
  import { encodeVariant, PART_INFO } from '$lib/geometry/socketsParts'
  import DecimalInputInherit from './DecimalInputInherit.svelte'
  import {
    clusterAngle,
    clusterSeparation,
    connectorsString,
    getNKeys,
    getSize,
    getThumbN,
    hasInnerCol,
    hasKey,
    hasOuterCol,
    isFnKey,
    isNumKey,
    isThumb,
    setClusterAngle,
    setClusterSeparation,
    setClusterSize,
    setThumbCluster,
    toggleFnRow,
    toggleInnerCol,
    toggleNumRow,
    toggleOuterCol,
  } from './visualEditorHelpers'
  import {
    mdiCodeJson,
    mdiPencil,
    mdiArrowLeft,
    mdiArrowRight,
    mdiDotsVertical,
    mdiChevronDown,
  } from '@mdi/js'
  import Icon from '$lib/presentation/Icon.svelte'
  import Dialog from '$lib/presentation/Dialog.svelte'
  import ConnectorsView from '../dialogs/ConnectorsView.svelte'
  import * as flags from '$lib/flags'
  import SizeEditView from '../dialogs/SizeEditView.svelte'
  import SelectThingy from './SelectThingy.svelte'
  import SelectPartInner from './SelectPartInner.svelte'
  import SelectPartLabel from './SelectPartLabel.svelte'
  import SelectProfileInner from './SelectProfileInner.svelte'
  import SelectProfileLabel from './SelectProfileLabel.svelte'
  import SelectMicrocontrollerInner from './SelectMicrocontrollerInner.svelte'
  import { trackEvent } from '$lib/telemetry'
  import { footIndices } from '$lib/worker/geometry'

  export let cosmosConf: CosmosKeyboard
  export let conf: FullCuttleform
  export let basic: boolean
  export let geometry: FullGeometry

  let connectorView = false
  let sizeEditView = false

  $: protoConfig.set(cosmosConf)
  $: conf = fromCosmosConfig($protoConfig)

  const dispatch = createEventDispatcher()

  function goAdvanced() {
    dispatch('goAdvanced')
  }

  let lastMicrocontroller: MicrocontrollerName = 'kb2040-adafruit'
  let lastConnectors: ConnectorMaybeCustom[] = [{ preset: 'trrs' }, { preset: 'usb', size: 'average' }]
  let lastScrews: number[] = [-1, -1, -1, -1, -1, -1, -1]

  function setSize(rows: number, cols: number, addExtraRow = true) {
    const originalSize = getSize($protoConfig, 'right')!
    protoConfig.update((k) => {
      setClusterSize(k, 'left', rows, cols, addExtraRow)
      setClusterSize(k, 'right', rows, cols, addExtraRow)
      return k
    })
    if (originalSize.rows == 0) {
      $protoConfig.wristRestEnable = true
      $protoConfig.microcontroller = lastMicrocontroller
      $protoConfig.connectors = lastConnectors
      $protoConfig.screwIndices = lastScrews
    } else {
      lastMicrocontroller = $protoConfig.microcontroller
      lastConnectors = $protoConfig.connectors
      lastScrews = $protoConfig.screwIndices
    }
    if (rows == 0) {
      $protoConfig.wristRestEnable = false
      $protoConfig.microcontroller = null
      $protoConfig.connectors = []
      $protoConfig.screwIndices = []
    }
  }

  function isSize(c: CosmosKeyboard, rows: number, cols: number) {
    const leftSize = getSize(c, 'left')
    const rightSize = getSize(c, 'right')
    return (
      (!leftSize || (leftSize.rows == rows && leftSize.cols == cols)) &&
      (!rightSize || (rightSize.rows == rows && rightSize.cols == cols))
    )
  }

  function setShell(type: string) {
    if (type == 'basic')
      $protoConfig.shell = {
        type: 'basic',
        lip: false,
      }
    else if (type == 'tilt')
      $protoConfig.shell = {
        type: 'tilt',
        tilt: $rotationY * 0.4,
        raiseBy: 3,
        pattern: [10, 5],
      }
    else if (type == 'stilts')
      $protoConfig.shell = {
        type: 'stilts',
        inside: false,
      }
    else throw new Error('unknown shell type')
  }

  /** Update the connector based on microcontroller bluetooth status */
  function updateMicrocontroller(ev: CustomEvent) {
    $protoConfig.microcontroller = ev.detail
    if (!basic) return

    const { mirrorConnectors, connectors } = microcontrollerConnectors(
      $protoConfig.microcontroller,
      $protoConfig.connectors
    )
    $protoConfig.connectors = connectors
    $protoConfig.mirrorConnectors = mirrorConnectors
  }

  function updatePlate() {
    // @ts-ignore
    $protoConfig.plate = { ...$protoConfig.plate }
  }

  let lastSwitch: Record<'choc' | 'mx', PartType['type']> = { choc: 'choc-v1', mx: 'mx-better' }
  let lastProfile: Record<string, Exclude<Profile, null>> = { choc: 'choc', mx: 'xda' }

  function updateKeycaps(ev: CustomEvent) {
    $protoConfig.profile = ev.detail
    $protoConfig.keyBasis = $protoConfig.profile
    const switchType = PART_INFO[$protoConfig.partType.type].keycap
    const profileType = $protoConfig.profile == 'choc' ? 'choc' : 'mx'
    console.log(switchType, profileType)
    if (switchType && switchType != profileType) {
      lastSwitch[switchType] = $protoConfig.partType.type!
      $protoConfig.partType.type = lastSwitch[profileType]!
    }
  }

  function updateSwitch(ev: CustomEvent) {
    $protoConfig.partType.type = ev.detail
    const switchType = PART_INFO[$protoConfig.partType.type].keycap
    const profileType = $protoConfig.profile == 'choc' ? 'choc' : 'mx'
    if (switchType && switchType != profileType) {
      lastProfile[profileType] = $protoConfig.profile
      $protoConfig.profile = lastProfile[switchType]
      $protoConfig.keyBasis = $protoConfig.profile
    }
  }

  const flipRotTuple = (t: bigint) => encodeTuple(decodeTuple(t).map((x, i) => (i == 0 ? x : -x)))
  function updateRotation(t: bigint) {
    if (!$protoConfig) return

    const fr = (t: bigint | undefined) => flipRotTuple(t || 0n)

    const fingers = $protoConfig.clusters.filter((c) => c.name == 'fingers')!
    if (fingers.length == 2 && (fingers[0].rotation || 0n) != fr(fingers[1].rotation)) return
    if (t < 0 || fingers.every((f) => t == (f.side == 'left' ? fr(f.rotation) : f.rotation || 0n)))
      return
    protoConfig.update((proto) => {
      fingers.forEach((f) => (f.rotation = f.side == 'left' ? fr(t) : t))
      return proto
    })
  }

  function updateWrPosition(t: bigint) {
    if (!$protoConfig) return
    if (t < 0 || t == ($protoConfig.wristRestPosition || 0n)) return
    protoConfig.update((proto) => {
      proto.wristRestPosition = t
      return proto
    })
  }

  function editJointlySeparately(cluster: 'fingers' | 'thumbs') {
    protoConfig.update((proto) => {
      const secondCluster = proto.clusters.find((c) => c.side == 'left' && c.name == cluster)
      if (secondCluster) {
        if (confirm('This will overwrite the left side of the keyboard with the right. Continue?'))
          proto.clusters.splice(proto.clusters.indexOf(secondCluster), 1)
      } else {
        proto.clusters.splice(
          cluster == 'fingers' ? 2 : 3,
          0,
          mirrorCluster(proto.clusters.find((c) => c.side == 'right' && c.name == cluster)!)
        )
      }
      return proto
    })
  }

  function totalScrewInserts(c: CosmosKeyboard, multiplier: number) {
    return c.screwIndices.length * multiplier
  }
  $: tScrewInserts = totalScrewInserts($protoConfig, 2)

  function setScrewsEnabled(e: Event) {
    if ((e.target as HTMLInputElement).checked) $protoConfig.screwIndices = new Array(7).fill(-1)
    else $protoConfig.screwIndices = []
  }

  function setNScrews(e: CustomEvent) {
    const newN = Number(e.detail)
    const oldN = $protoConfig.screwIndices.length
    if (newN > oldN) {
      $protoConfig.screwIndices = [...$protoConfig.screwIndices, ...new Array(newN - oldN).fill(-1)]
    } else if (newN < oldN) {
      $protoConfig.screwIndices = $protoConfig.screwIndices.slice(0, newN)
    }
  }
  function enterScrewIndices() {
    const ind = $protoConfig.screwIndices.join(',')
    const computedScrewInd = mapObjNotNull(geometry, (g) => g.screwIndices)
    const nScrews = Math.min(...Object.values(geometry).map((g) => g.allWallCriticalPoints().length))
    const newInd = prompt(
      `Enter the indices of the screw holes (0–${nScrews}) separated by commas. For information on what these indices mean, refer to the expert mode documentation.\n\nThe computed screw indices are:\n` +
        Object.entries(computedScrewInd)
          .map(([k, s]) => `${k}: ${s.join(',')}`)
          .join('\n'),
      ind
    )
    if (newInd) {
      const splitInd = newInd.split(',').map(Number)
      if (splitInd.some(isNaN)) return
      $protoConfig.screwIndices = splitInd
    }
  }

  function setNFeet(e: CustomEvent) {
    if (!$protoConfig.plate) return
    const newN = Number(e.detail)
    const oldN = $protoConfig.plate?.footIndices.length
    if (newN > oldN) {
      $protoConfig.plate = {
        ...$protoConfig.plate,
        footIndices: [...$protoConfig.plate.footIndices, ...new Array(newN - oldN).fill(-1)],
      }
    } else if (newN < oldN) {
      $protoConfig.plate = {
        ...$protoConfig.plate,
        footIndices: $protoConfig.plate.footIndices.slice(0, newN),
      }
    }
  }
  function enterFootIndices() {
    if (!$protoConfig.plate) return
    const ind = $protoConfig.plate?.footIndices.join(',')
    const computedFootInd = mapObjNotNull(geometry, (g) => g.footIndices)
    const nFeet = Math.min(...Object.values(geometry).map((g) => g.footWalls.length))
    const newInd = prompt(
      `Enter the indices of the foot holes (0–${nFeet}) separated by commas. For information on what these indices mean, refer to the expert mode documentation.\n\nThe computed foot indices are:\n` +
        Object.entries(computedFootInd)
          .map(([k, s]) => `${k}: ${s.join(',')}`)
          .join('\n'),
      ind
    )
    if (newInd) {
      const splitInd = newInd.split(',').map(Number)
      if (splitInd.some(isNaN)) return
      $protoConfig.plate = { ...$protoConfig.plate, footIndices: splitInd }
    }
  }

  function setTiltPillarsEnabled(e: Event) {
    if ($protoConfig.shell.type != 'tilt') return
    if ((e.target as HTMLInputElement).checked) $protoConfig.shell.pattern = [10, 5]
    else $protoConfig.shell.pattern = null
  }

  function enterPattern() {
    if ($protoConfig.shell.type != 'tilt') return
    const ind = $protoConfig.shell.pattern?.join(',')
    const newInd = prompt(
      'Enter the lengths of pillars and gaps in the pattern separated by commas. For example: 10, 5.',
      ind
    )
    if (newInd) {
      const splitInd = newInd.split(',').map(Number)
      if (splitInd.some(isNaN)) return
      $protoConfig.shell.pattern = splitInd
    }
  }

  function setThumb(
    type: 'carbonfet' | 'manuform' | 'orbyl' | 'curved',
    side: 'left' | 'right',
    e?: Event
  ) {
    const n = e ? Number((e.target as HTMLInputElement).value) : undefined
    protoConfig.update((p) => setThumbCluster(p, type, side, n))
  }

  function setNoThumb(side: 'left' | 'right') {
    protoConfig.update((p) => {
      p.clusters.find((c) => c.side == side && c.name == 'thumbs')!.clusters = []
      return p
    })
  }

  function setUnibody(ev: Event) {
    protoConfig.update((proto) => {
      proto.unibody = (ev.target as HTMLInputElement).checked
      if (proto.unibody) {
        setClusterSeparation(proto, 30)
        // Double the number of screw indices
        proto.screwIndices = proto.screwIndices.concat(new Array(proto.screwIndices.length).fill(-1))
      } else {
        // Move everything so wrist rest goes to position 10
        const wristRestMovement = 10 - decodeTuple(proto.wristRestPosition)[0] / 10
        setClusterSeparation(proto, clusterSeparation(proto) + wristRestMovement * 2)
        // Halve the number of screw indices
        proto.screwIndices = proto.screwIndices.slice(0, Math.ceil(proto.screwIndices.length / 2))
      }
      return proto
    })
  }

  function changeKeyVariant(e: Event, elem: string) {
    const newValue = (e.target as HTMLInputElement).value
    protoConfig.update((proto) => {
      const oldVariant = partVariant(proto.partType)
      oldVariant[elem] = newValue
      proto.partType.variant = encodeVariant(proto.partType.type, oldVariant)
      return proto
    })
  }

  function rearPins(conf: CosmosKeyboard): number {
    if (conf.microcontroller == null) return 0
    return BOARD_PROPERTIES[conf.microcontroller].rearPins?.length || 0
  }
  function castellated(conf: CosmosKeyboard): boolean {
    if (conf.microcontroller == null) return false
    return BOARD_PROPERTIES[conf.microcontroller].castellated || false
  }

  function attempt<T>(f: () => T) {
    try {
      return f()
    } catch {
      return '{error}'
    }
  }

  $: rightThumbCluster = $protoConfig.clusters.find((c) => c.name == 'thumbs' && c.side == 'right')!
  $: leftThumbCluster = $protoConfig.clusters.find((c) => c.name == 'thumbs' && c.side == 'left')
  $: rightFingersCl = $protoConfig.clusters.find((c) => c.name == 'fingers' && c.side == 'right')!
  $: leftFingersCl = $protoConfig.clusters.find((c) => c.name == 'fingers' && c.side == 'left')
  $: tempFingersCluster = $tempConfig.clusters.find((c) => c.name == 'fingers')!

  $: whichRight = getThumbN($protoConfig, 'right')
  $: whichLeft = getThumbN($protoConfig, 'left')

  const rotationStore = new TupleStore(-1n, 45, true)
  const [rotationX, rotationY, rotationZ, _] = rotationStore.components()
  rotationStore.tuple.subscribe((t) => updateRotation(t))
  $: rotationStore.update(tempFingersCluster.rotation || 0n)
  $: tempFingers = $tempConfig.clusters.filter((c) => c.name == 'fingers')
  $: rotationsAreDifferent =
    tempFingers.length == 2 &&
    (tempFingers[0].rotation || 0n) != flipRotTuple(tempFingers[1].rotation || 0n)

  const wrPositionStore = new TupleStore(-1n, 10)
  const [wrPositionX, wrPositionY, wrPositionZ, _2] = wrPositionStore.components()
  wrPositionStore.tuple.subscribe((t) => updateWrPosition(t))
  $: wrPositionStore.update($protoConfig.wristRestPosition || 0n)

  $: clusterSep = clusterSeparation($tempConfig)
  const setClusterSep = (ev: CustomEvent) =>
    protoConfig.update((proto) => setClusterSeparation(proto, ev.detail))

  $: clusterAng = clusterAngle($tempConfig)
  const setClusterAng = (ev: CustomEvent) =>
    protoConfig.update((proto) => setClusterAngle(proto, ev.detail))
</script>

<Section name="Upper Keys">
  <button class="absolute top-0 right-2 button" on:click={() => editJointlySeparately('fingers')}
    ><Icon path={mdiPencil} />{#if leftFingersCl}Edit Jointly{:else}Edit Separately{/if}</button
  >
  <!-- <Preset on:click={() => setSize(3, 4)} selected={isSize($protoConfig, 3, 4)}>3 × 5</Preset>
  <Preset on:click={() => setSize(3, 5)} selected={isSize($protoConfig, 3, 5)}>3 × 6</Preset>
  <Preset on:click={() => setSize(4, 5)} selected={isSize($protoConfig, 4, 5)}>4 × 5</Preset>
  <Preset on:click={() => setSize(4, 6)} selected={isSize($protoConfig, 4, 6)}>4 × 6</Preset>
  <Preset on:click={() => setSize(5, 5)} selected={isSize($protoConfig, 5, 5)}>5 × 5</Preset>
  <Preset on:click={() => setSize(5, 6)} selected={isSize($protoConfig, 5, 6)}>5 × 6</Preset>
  <Preset on:click={() => setSize(0, 0)} selected={isSize($protoConfig, 0, 0)}
    ><span class="relative top-[-0.1em]">&empty;</span></Preset
  > -->
  <!-- <div class="flex gap-1 items-center">
    <div class="mx-2">Rows</div>
    <Preset>4</Preset>
    <Preset selected><span class="font-mono text-xs relative top--0.5 mr-1">num</span>5</Preset>
    <Preset><span class="font-mono text-xs relative top--0.5 mr-1">fn</span>6</Preset>
    <div class="mr-2 ml-6">Columns</div>
    <Preset selected>5</Preset>
    <Preset>6</Preset>
    <Preset>7</Preset>
  </div> -->
  <div class="flex gap-1">
    <Preset
      class="flex pl-2! pr-3! gap-1 items-center"
      on:click={() => protoConfig.update(toggleOuterCol)}
      selected={hasOuterCol($protoConfig)}
      ><Icon class="opacity-70 mr--3" size="22" name="column" /><Icon
        class="opacity-70"
        size="18"
        path={mdiArrowLeft}
      />Out</Preset
    >
    <Preset
      class="flex pl-2! pr-3! gap-2 items-center"
      on:click={() => protoConfig.update(toggleNumRow)}
      selected={hasKey($protoConfig, isNumKey)}
      ><Icon class="opacity-70" size="22" name="row" />Num</Preset
    >
    <Preset
      class="flex pl-2! pr-3! gap-2 items-center"
      on:click={() => protoConfig.update(toggleFnRow)}
      selected={hasKey($protoConfig, isFnKey)}
      ><Icon class="opacity-70 relative" size="22" name="row" />Fn</Preset
    >
    <Preset
      class="flex pl-2! pr-3! gap-1 items-center"
      on:click={() => protoConfig.update(toggleInnerCol)}
      selected={hasInnerCol($protoConfig)}
      ><Icon class="opacity-70 mr--3" size="22" name="column" /><Icon
        class="opacity-70"
        size="18"
        path={mdiArrowRight}
      />Inner</Preset
    >
    <Preset
      on:click={() => (isSize($protoConfig, 0, 0) ? setSize(5, 5) : setSize(0, 0))}
      selected={isSize($protoConfig, 0, 0)}><span class="relative top-[-0.1em]">&empty;</span></Preset
    >
    <Preset class="px-2!" gray on:click={() => (sizeEditView = true)}
      ><span class="border bg-white/50 rounded-0.5 line-height-5 w-5 text-center inline-block">r</span>
      &times;
      <span class="border bg-white/50 rounded-0.5 line-height-5 w-5 text-center inline-block">c</span
      ></Preset
    >
  </div>
  <Field name="Keycaps" icon="keycap">
    <!-- <Select bind:value={$protoConfig.profile} on:change={updateKeycaps}>
      {#each notNull(PROFILE).sort(sortProfiles) as prof}
        <option value={prof}>{profileName(prof, true)}</option>
      {/each}
    </Select> -->
    <SelectThingy
      value={$protoConfig.profile}
      on:change={updateKeycaps}
      options={notNull(PROFILE)
        .sort(sortProfiles)
        .map((prof) => ({ key: prof, label: profileName(prof, true) }))}
      component={SelectProfileInner}
      labelComponent={SelectProfileLabel}
      minWidth={200}
    />
  </Field>
  <Field name="Switches" icon="switch">
    <!-- <Select bind:value={$protoConfig.partType.type} on:change={updateSwitch}>
           {#each objKeys(PART_INFO).filter((k) => PART_INFO[k].category == 'Sockets' && k != 'blank') as part}
           <option value={part}>{PART_INFO[part].partName}</option>
           {/each}
           </Select> -->
    <SelectThingy
      value={$protoConfig.partType.type}
      on:change={updateSwitch}
      options={objEntries(PART_INFO)
        .filter(([p, e]) => e.category == 'Sockets' && p != 'blank' && (flags.draftuc || !e.draft))
        .map(([p, e]) => ({ ...e, key: p + '', label: e.partName }))}
      component={SelectPartInner}
      labelComponent={SelectPartLabel}
    />
  </Field>
  {@const info = PART_INFO[$protoConfig.partType.type]}
  {#each Object.entries('variants' in info ? info.variants : {}) as [key, opt]}
    <Field name={capitalize(key)}>
      <Select
        value={partVariant($protoConfig.partType)[key]}
        on:change={(ev) => changeKeyVariant(ev, key)}
      >
        {#each opt as part}
          <option value={part}>{part}</option>
        {/each}
      </Select>
    </Field>
  {/each}
  {#if !basic}
    <Field
      name="Horizontal (X) Spacing"
      icon="expand-horizontal"
      help="The horizontal distance between key centers when the keys are laid flat"
    >
      <DecimalInput bind:value={$protoConfig.curvature.horizontalSpacing} units="mm" />
    </Field>
    <Field
      name="Vertical (Y) Spacing"
      icon="expand-vertical"
      help="The vertical distance between key centers when the keys are laid flat"
    >
      <DecimalInput bind:value={$protoConfig.curvature.verticalSpacing} units="mm" />
    </Field>
  {/if}
  {#if $protoConfig.partType.type == 'mx-pcb'}
    <InfoBox>
      <p class="mb-1">
        This variant requires the Amoeba King PCB. The board should fit snug within the guides. Friction
        holds the sockets onto the switch, but you can reinforce using glue/epoxy. I don't recommend it,
        but you can also use two 3/16 in #0-80 screws or two 4–5 mm M1.6 screws for each key ({getNKeys(
          $protoConfig,
          'mx-pcb'
        ) * 2} screws total).
      </p>
      <p>
        To fasten, screw down forcefully so the screws carve threads into the plastic. For hard plastics,
        you'll need to tap the holes.
      </p>
    </InfoBox>
  {:else if $protoConfig.partType.type == 'mx-pcb-twist' || $protoConfig.partType.type == 'mx-pcb-plum'}
    <InfoBox>
      This variant requires Plum Twist or Spiral Galaxy PCBs. For more information and documentation
      refer to the <a class="text-pink-600 underline" href="plum-twist">Plum Twist website</a>.
    </InfoBox>
  {:else if $protoConfig.partType.type == 'mx-skree'}
    <InfoBox>
      This variant requires Skree Flex PCBs with MX hotswaps, which you can purchase from <a
        class="text-pink-600 underline"
        on:click={() => trackEvent('skree', { prodcut: 'claw-flexible-pcbs' })}
        href="https://skree.us/products/claw-flexible-pcbs?ref=cosmos">TheBigSkree website</a
      >.
    </InfoBox>
  {:else if $protoConfig.partType.type == 'mx-hotswap'}
    <InfoBox>
      <p>
        This variant requires Kailh MX hotswap sockets and a well-tuned 3D printer. Alternatives are <a
          class="text-pink-600 underline"
          href="https://www.printables.com/model/158559">these printable hotswap sockets</a
        >, together with the MX-Compatible (no hotswap) setting, but they don't grip as well as the Kailh
        MX sockets.
      </p>
    </InfoBox>
  {:else if $protoConfig.partType.type == 'mx-klavgen'}
    <InfoBox>
      <p>
        This variant requires Kailh MX hotswap sockets and a well-tuned 3D printer. You'll need to
        separately print one <a
          class="text-pink-600 underline"
          href="https://github.com/klavgen/klavgen/blob/main/example_stls/switch_holder.stl"
          >Klavgen switch holder</a
        > for every key. These hold in the sockets better than the 3DP hotswap option but require extra printing.
      </p>
    </InfoBox>
  {:else if $protoConfig.partType.type == 'choc-v1-hotswap' || $protoConfig.partType.type == 'choc-v2-hotswap'}
    <InfoBox>
      <p>
        This variant requires Kailh Choc hotswap sockets and a well-tuned 3D printer. You'll need to glue
        the sockets in place.
      </p>
    </InfoBox>
  {:else if $protoConfig.partType.type == 'niz'}
    <InfoBox>
      <p>
        This variant requires a well-tuned 3D printer.
        <a class="text-pink-600 underline" href="https://ryanis.cool/cosmos/docs/parts/magnetic-switches"
          >NIZ documentation</a
        >
      </p>
    </InfoBox>
  {/if}
</Section>
<!---<svelte:fragment slot="content">
    {#each schema.upperKeys.fields as key}
      {#if !basic || key.basic}
        <Field
          schema={key}
          bind:value={cosmosConf.upperKeys[key.var]}
          on:change={() => keyChange(key.var)}
        />
      {/if}
    {/each}
  </svelte:fragment>
</Section>
-->
<Section name="Curvature">
  <Field name="Row's Curvature" plusminus icon="row-curve">
    <AngleInput bind:value={$protoConfig.curvature.curvatureA} />
  </Field>
  <Field name="Column's Curvature" icon="column-curve">
    <AngleInput bind:value={$protoConfig.curvature.curvatureB} />
  </Field>
  <Field
    name="Outwards Arc"
    icon="bulge"
    help="Rotates the keys outwards. Useful for countering large curvature"
  >
    <AngleInput bind:value={$protoConfig.curvature.arc} />
  </Field>
  {#if !basic && !rotationsAreDifferent}<Field name="Rotation Around Row Axis" icon="angle-rotate">
      <AngleInput bind:value={$rotationX} />
    </Field>{/if}
  {#if rotationsAreDifferent}
    <InfoBox>
      The rotations of the two clusters have diverged, so tenting is no longer editable. Set their
      rotations equal for the field to reappear.
    </InfoBox>
  {:else}
    <Field name="Tenting Angle" icon="angle">
      <AngleInput bind:value={$rotationY} />
    </Field>
  {/if}
</Section>

{#if leftThumbCluster}
  <Section name={'Left Thumb Cluster'}>
    <button class="absolute top-0 right-2 button" on:click={() => editJointlySeparately('thumbs')}
      ><Icon path={mdiPencil} />{#if leftThumbCluster}Edit Jointly{:else}Edit Separately{/if}</button
    >
    <Preset
      name="Manuform"
      on:click={() => setThumb('manuform', 'left')}
      selected={isThumb($protoConfig, 'manuform', 'left')}
    />
    <Preset
      name="Carbonfet"
      on:click={() => setThumb('carbonfet', 'left')}
      selected={isThumb($protoConfig, 'carbonfet', 'left')}
    />
    <Preset
      name="Orbyl"
      on:click={() => setThumb('orbyl', 'left')}
      selected={isThumb($protoConfig, 'orbyl', 'left')}
    />
    <Preset
      name="Curved"
      on:click={() => setThumb('curved', 'left')}
      selected={isThumb($protoConfig, 'curved', 'left')}
    />
    <Preset on:click={() => setNoThumb('left')} selected={leftThumbCluster?.clusters.length == 0}
      ><span class="relative top-[-0.1em]">&empty;</span></Preset
    >
    {#if whichLeft}
      <Field name="Number of Keys" icon="numeric">
        <Select value={whichLeft.n} on:change={(e) => setThumb(whichLeft.which, 'left', e)}>
          {#each whichLeft.options.toReversed() as opt}
            <option value={opt}>{opt}</option>
          {/each}
        </Select>
      </Field>
    {/if}
    <Field name="Row's Curvature" plusminus icon="row-curve">
      <AngleInput bind:value={leftThumbCluster.curvature.curvatureA} />
    </Field>
    <Field name="Column's Curvature" plusminus icon="column-curve">
      <AngleInput bind:value={leftThumbCluster.curvature.curvatureB} />
    </Field>
    {#if !basic}
      <Field name="Horizontal (X) Spacing" icon="expand-horizontal">
        <DecimalInputInherit
          bind:value={leftThumbCluster.curvature.horizontalSpacing}
          inherit={$protoConfig.curvature.horizontalSpacing}
          units="mm"
        />
      </Field>
      <Field name="Vertical (Y) Spacing" icon="expand-vertical">
        <DecimalInputInherit
          bind:value={leftThumbCluster.curvature.verticalSpacing}
          inherit={$protoConfig.curvature.horizontalSpacing}
          units="mm"
        />
      </Field>
    {/if}
  </Section>
{/if}
<Section name={leftThumbCluster ? 'Right Thumb Cluster' : 'Thumb Cluster'}>
  {#if !leftThumbCluster}
    <button class="absolute top-0 right-2 button" on:click={() => editJointlySeparately('thumbs')}
      ><Icon path={mdiPencil} />{#if leftThumbCluster}Edit Jointly{:else}Edit Separately{/if}</button
    >
  {/if}
  <Preset
    name="Manuform"
    on:click={() => setThumb('manuform', 'right')}
    selected={isThumb($protoConfig, 'manuform', 'right')}
  />
  <Preset
    name="Carbonfet"
    on:click={() => setThumb('carbonfet', 'right')}
    selected={isThumb($protoConfig, 'carbonfet', 'right')}
  />
  <Preset
    name="Orbyl"
    on:click={() => setThumb('orbyl', 'right')}
    selected={isThumb($protoConfig, 'orbyl', 'right')}
  />
  <Preset
    name="Curved"
    on:click={() => setThumb('curved', 'right')}
    selected={isThumb($protoConfig, 'curved', 'right')}
  />
  <Preset on:click={() => setNoThumb('right')} selected={rightThumbCluster?.clusters.length == 0}
    ><span class="relative top-[-0.1em]">&empty;</span></Preset
  >
  {#if whichRight}
    <Field name="Number of Keys" icon="numeric">
      <Select value={whichRight.n} on:change={(e) => setThumb(whichRight.which, 'right', e)}>
        {#each whichRight.options.toReversed() as opt}
          <option value={opt}>{opt}</option>
        {/each}
      </Select>
    </Field>
  {/if}
  <Field name="Row's Curvature" plusminus icon="row-curve">
    <AngleInput bind:value={rightThumbCluster.curvature.curvatureA} />
  </Field>
  <Field name="Column's Curvature" plusminus icon="column-curve">
    <AngleInput bind:value={rightThumbCluster.curvature.curvatureB} />
  </Field>
  {#if !basic}
    <Field name="Horizontal (X) Spacing" icon="expand-horizontal">
      <DecimalInputInherit
        bind:value={rightThumbCluster.curvature.horizontalSpacing}
        inherit={$protoConfig.curvature.horizontalSpacing}
        units="mm"
      />
    </Field>
    <Field name="Vertical (Y) Spacing" icon="expand-vertical">
      <DecimalInputInherit
        bind:value={rightThumbCluster.curvature.verticalSpacing}
        inherit={$protoConfig.curvature.horizontalSpacing}
        units="mm"
      />
    </Field>
  {/if}
</Section>
<!--
<Section name="Thumb Cluster">
  <svelte:fragment slot="preset">
    <Preset
      name="Manuform"
      on:click={() => setThumb('default')}
      selected={cosmosConf.thumbCluster.oneofKind == 'defaultThumb'}
    />
    <Preset
      name="Carbonfet"
      on:click={() => setThumb('carbonfet')}
      selected={cosmosConf.thumbCluster.oneofKind == 'carbonfetThumb'}
    />
    <Preset
      name="Orbyl"
      on:click={() => setThumb('orbyl')}
      selected={cosmosConf.thumbCluster.oneofKind == 'orbylThumb'}
    />
    <Preset
      name="Curved"
      on:click={() => setThumb('curved')}
      selected={cosmosConf.thumbCluster.oneofKind == 'curvedThumb'}
    />
    <Preset
      name="Custom"
      on:click={() => setThumb('custom')}
      selected={cosmosConf.thumbCluster.oneofKind == 'customThumb'}
    />
  </svelte:fragment>
  <svelte:fragment slot="content">
    {#each schema[whichThumb].fields as key}
      {#if (!basic || key.basic) && !key.special}
        <Field schema={key} bind:value={cosmosConf.thumbCluster[whichThumb][key.var]} />
      {/if}
    {/each}
    {#if cosmosConf.thumbCluster.oneofKind == 'defaultThumb' && cosmosConf.thumbCluster.defaultThumb.encoder}
      <InfoBox
        >You'll need an {cosmosConf.thumbCluster.defaultThumb.encoderType == ENCODER.EC11
          ? 'EC11 encoder (I measured the keebio one)'
          : 'EVQWGD001 encoder'} and a knob.</InfoBox
      >
    {/if}
    {#if cosmosConf.thumbCluster.oneofKind == 'curvedThumb' && cosmosConf.thumbCluster.curvedThumb.encoder}
      <InfoBox
        >You'll need an {cosmosConf.thumbCluster.curvedThumb.encoderType == ENCODER.EC11
          ? 'EC11 encoder (I measured the keebio one)'
          : 'EVQWGD001 encoder'} and a knob.</InfoBox
      >
    {/if}
  </svelte:fragment>
</Section>
{#if !basic}
  <Section name="Stagger">
    <div class="w-full xs:w-[19rem] overflow-auto lg:w-full" slot="content">
      <table class="mt-1">
        <thead>
          <tr>
            <th />
            <th class="font-normal pb-0.5 pl-4 text-left {staggerStyle[0]}">Thumb</th>
            <th class="font-normal pb-0.5 pl-4 text-left {staggerStyle[0]}">&lt; Index</th>
            <th class="font-normal pb-0.5 pl-4 text-left {staggerStyle[1]}">Index</th>
            <th class="font-normal pb-0.5 pl-4 text-left {staggerStyle[2]}">Middle</th>
            <th class="font-normal pb-0.5 pl-4 text-left {staggerStyle[3]}">Ring</th>
            <th class="font-normal pb-0.5 pl-4 text-left {staggerStyle[4]}">Pinky</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th class="font-normal">X</th>
            <td class={staggerStyle[0]}><DecimalInput small bind:value={$staggerThumbX} /></td>
            <td class={staggerStyle[1]}><DecimalInput small bind:value={$staggerInnerIndexX} /></td>
            <td class={staggerStyle[1]}><DecimalInput small bind:value={$staggerIndexX} /></td>
            <td class={staggerStyle[2]}><DecimalInput small bind:value={$staggerMiddleX} /></td>
            <td class={staggerStyle[3]}><DecimalInput small bind:value={$staggerRingX} /></td>
            <td class={staggerStyle[4]}><DecimalInput small bind:value={$staggerPinkyX} /></td>
          </tr>
          <tr>
            <th class="font-normal">Y</th>
            <td class={staggerStyle[0]}><DecimalInput small bind:value={$staggerThumbY} /></td>
            <td class={staggerStyle[1]}><DecimalInput small bind:value={$staggerInnerIndexY} /></td>
            <td class={staggerStyle[1]}><DecimalInput small bind:value={$staggerIndexY} /></td>
            <td class={staggerStyle[2]}><DecimalInput small bind:value={$staggerMiddleY} /></td>
            <td class={staggerStyle[3]}><DecimalInput small bind:value={$staggerRingY} /></td>
            <td class={staggerStyle[4]}><DecimalInput small bind:value={$staggerPinkyY} /></td>
          </tr>
          <tr>
            <th class="font-normal">Z</th>
            <td class={staggerStyle[0]}><DecimalInput small bind:value={$staggerThumbZ} /></td>
            <td class={staggerStyle[1]}><DecimalInput small bind:value={$staggerInnerIndexZ} /></td>
            <td class={staggerStyle[1]}><DecimalInput small bind:value={$staggerIndexZ} /></td>
            <td class={staggerStyle[2]}><DecimalInput small bind:value={$staggerMiddleZ} /></td>
            <td class={staggerStyle[3]}><DecimalInput small bind:value={$staggerRingZ} /></td>
            <td class={staggerStyle[4]}><DecimalInput small bind:value={$staggerPinkyZ} /></td>
          </tr>
          <tr>
            <th class="font-normal">θ</th>
            <td class={staggerStyle[0]}><AngleInput small bind:value={$staggerThumbO} /></td>
            <td class={staggerStyle[1]}><AngleInput small bind:value={$staggerInnerIndexO} /></td>
            <td class={staggerStyle[1]}><AngleInput small bind:value={$staggerIndexO} /></td>
            <td class={staggerStyle[2]}><AngleInput small bind:value={$staggerMiddleO} /></td>
            <td class={staggerStyle[3]}><AngleInput small bind:value={$staggerRingO} /></td>
            <td class={staggerStyle[4]}><AngleInput small bind:value={$staggerPinkyO} /></td>
          </tr>
        </tbody>
      </table>
    </div></Section
  >
{/if}
<Section name="Case">
  <svelte:fragment slot="preset">
    <Preset on:click={() => setShell('basic')} selected={cosmosConf.shell.oneofKind == 'basicShell'}
      >Default</Preset
    >
    {#if hasPro}<Preset
        name="Stilts"
        on:click={() => setShell('stilts')}
        selected={cosmosConf.shell.oneofKind == 'stiltsShell'}
        >Stilts <span
          class="{cosmosConf.shell.oneofKind == 'stiltsShell'
            ? 'text-teal-100'
            : 'text-teal-500'} dark:text-teal-400 font-bold ml-2">PRO</span
        ></Preset
      >{/if}
    <Preset on:click={() => setShell('tilt')} selected={cosmosConf.shell.oneofKind == 'tiltShell'}
      >Tilting Base</Preset
    >
  </svelte:fragment>
  <svelte:fragment slot="content">
    {#if cosmosConf.shell.oneofKind == 'tiltShell'}
      <div class="mt-2">
        <InfoBox>
          The Tilting Base helps you achieve high tenting angles without needing to print as much
          support. Make sure to print the plate in two parts so that the bottom can be removed for
          access.
        </InfoBox>
      </div>
    {/if}
    {#each schema[whichShell].fields as key}
      {#if !basic || key.basic}
        <Field schema={key} bind:value={cosmosConf.shell[whichShell][key.var]} />
      {/if}
    {/each}
    {#each schema.wall.fields.filter((k) => !k.wr) as key}
      {#if !basic || key.basic}
        {#if key.var == 'screwIndices'}
          <Field schema={{ ...key, type: 'int' }} bind:value={$nScrewInserts} />
        {:else if key.var == 'clearScrews' && (whichShell == 'stiltsShell' || whichShell == 'tiltShell')}
          {''}
        {:else}
          <Field
            schema={key}
            bind:value={cosmosConf.wall[key.var]}
            on:change={() => caseChange(key.var)}
          />
          {#if key.var == 'microcontroller' && rearPins(cosmosConf)}
            <InfoBox>
              Don't solder to the rear row of {rearPins(cosmosConf)} pins on the microcontroller, or
              be very careful if you do! Any protrusions in this area under the microcontroller will
              prevent it from sliding into its holder.
            </InfoBox>
          {/if}
          {#if key.var == 'microcontroller' && castellated(cosmosConf)}
            <InfoBox>
              Only solder to the inner holes on the microcontroller. Soldering to the castellated
              edges will prevent it from fitting into the holder.
            </InfoBox>
          {/if}
        {/if}
      {/if}
    {/each}
    {#if cosmosConf.wall.screwInserts}
      <InfoBox>
        <p class="mb-1">
          You'll need {tScrewInserts}
          {MAP_SCREW_SIZE[cosmosConf.wall.screwSize]} x {screwHeight(cosmosConf)} screws {#if cosmosConf.wall.countersinkScrews}with
            countersunk heads
          {/if}and {tScrewInserts}
          {MAP_SCREW_TYPE[cosmosConf.wall.screwType]}s in order to fasten the base plate to the
          case. Check the
          <a class="text-pink-600 underline" href="https://ryanis.cool/cosmos/docs/screws"
            >Screws Documentation</a
          > to make sure you have the correctly sized parts.
        </p>
      </InfoBox>
    {/if}
  </svelte:fragment>
</Section>

<Section name="Extras">
  <svelte:fragment slot="content">
    {#each schema.wall.fields.filter((k) => k.wr) as key}
      {#if !basic || key.basic}
        <Field schema={key} bind:value={cosmosConf.wall[key.var]} />
      {/if}
    {/each}
  </svelte:fragment>
</Section> -->
<Section name="Case">
  <div class="mb-2">
    <Preset on:click={() => setShell('basic')} selected={$protoConfig.shell.type == 'basic'}
      >Default</Preset
    >
    {#if hasPro}<Preset
        name="Stilts"
        on:click={() => setShell('stilts')}
        selected={$protoConfig.shell.type == 'stilts'}
        >Stilts <span
          class="{$protoConfig.shell.type == 'stilts'
            ? 'text-teal-100'
            : 'text-teal-500'} dark:text-teal-400 font-bold ml-2">PRO</span
        ></Preset
      >{/if}
    <Preset on:click={() => setShell('tilt')} selected={$protoConfig.shell.type == 'tilt'}
      >Tilting Base</Preset
    >
  </div>
  {#if $protoConfig.shell.type == 'basic'}
    {#if !basic}
      <Field name="Add Lip" help="Add a lip to the bottom plate to hide warping defects">
        <Checkbox bind:value={$protoConfig.shell.lip} />
      </Field>
    {/if}
  {:else if $protoConfig.shell.type == 'stilts'}
    <Field name="Tuck in Bottom Plate">
      <Checkbox bind:value={$protoConfig.shell.inside} />
    </Field>
  {:else if $protoConfig.shell.type == 'tilt'}
    <InfoBox>
      The Tilting Base helps you achieve high tenting angles without needing to print as much support.
      Make sure to print the plate in two parts so that the bottom can be removed for access.
    </InfoBox>
    <Field name="Case Tenting Angle" icon="angle">
      {#if typeof $protoConfig.shell.tilt == 'number'}
        <AngleInput bind:value={$protoConfig.shell.tilt} />
      {:else}
        <InfoBox>
          The tilt angle is currently configured as a vector, which can only be edited in Expert Mode.
        </InfoBox>
      {/if}
    </Field>
    {#if !basic}<div class="relative">
        <div class="absolute right-48 top--1.5">
          <button class="button" on:click={enterPattern}><Icon path={mdiCodeJson} /></button>
        </div>
        <Field name="Use Pillars">
          <Checkbox value={$protoConfig.shell.pattern != null} on:change={setTiltPillarsEnabled} />
        </Field>
      </div>
      <Field name="Raise Case By" icon="expand-vertical">
        <DecimalInput bind:value={$protoConfig.shell.raiseBy} units="mm" />
      </Field>
    {/if}
  {/if}
  {#if !basic}
    <Field name="Connectivity" icon="usb-port">
      <!-- <Select bind:value={$protoConfig.connector}>
        <option value="trrs">TRRS and USB</option>
        <option value="usb">USB only</option>
        <option value={null}>None</option>
      </Select> -->
      <button class="button my-0! py-0.5! mx-2! w-44" on:click={() => (connectorView = true)}>
        {connectorsString($protoConfig.connectors)}
      </button>
    </Field>
    {#if $protoConfig.unibody}
      <Field
        name="Connector Index"
        help="Position of the microcontroller and connector, expressed as a wall index. See expert mode documentation for details.<br>Currently, it is {attempt(
          () => geometry.unibody?.connectorIndex
        )} (0–{geometry.unibody?.allWallCriticalPoints().length})."
      >
        <DecimalInput bind:value={$protoConfig.connectorRightIndex} />
      </Field>
    {:else}
      <Field
        name="Connector Index (L/R)"
        help="Position of the microcontroller and connector, expressed as a wall index. See expert mode documentation for details.<br>Currently, it is {attempt(
          () => geometry.left?.connectorIndex
        )} (0–{geometry.left?.allWallCriticalPoints().length}) on the left and {attempt(
          () => geometry.right?.connectorIndex
        )} (0–{geometry.right?.allWallCriticalPoints().length}) on the right."
      >
        <DecimalInput bind:value={$protoConfig.connectorLeftIndex} class="w-[5.2rem]" />
        <DecimalInput bind:value={$protoConfig.connectorRightIndex} class="w-[5.2rem]" />
      </Field>
    {/if}
  {/if}
  {#if $protoConfig.connectorRightIndex != -1 || (!$protoConfig.unibody && $protoConfig.connectorLeftIndex != -1)}
    <InfoBox>
      The microcontroller and connector are manually placed in this model. Set Advanced &rarr; Connector
      Index to -1 to automatically place them.
    </InfoBox>
  {/if}
  <Field name="Microcontroller" icon="microcontroller">
    <SelectThingy
      value={$protoConfig.microcontroller}
      on:change={updateMicrocontroller}
      options={{
        ...Object.fromEntries(
          MICROCONTROLLER_SIZES.map((s) => [
            s,
            notNull(MICROCONTROLLER_NAME)
              .filter(
                (m) => BOARD_PROPERTIES[m].sizeName == s && (flags.draftuc || !BOARD_PROPERTIES[m].draft)
              )
              .sort(sortMicrocontrollers)
              .map((m) => ({
                key: m,
                label: BOARD_PROPERTIES[m].name + ' ' + (BOARD_PROPERTIES[m].extraName || ''),
              })),
          ])
        ),
        More: [{ key: null, label: 'None' }],
      }}
      component={SelectMicrocontrollerInner}
    />
    <!-- <Select bind:value={$protoConfig.microcontroller} on:change={updateMicrocontroller}>
      {#each MICROCONTROLLER_SIZES as size}
        <optgroup label={size}>
          {#each notNull(MICROCONTROLLER_NAME)
            .filter((m) => BOARD_PROPERTIES[m].sizeName == size && (flags.draftuc || !BOARD_PROPERTIES[m].draft))
            .sort(sortMicrocontrollers) as controller}
            <option value={controller}>
              {BOARD_PROPERTIES[controller].name}
              {BOARD_PROPERTIES[controller].extraName || ''}
            </option>
          {/each}
        </optgroup>
      {/each}
      <optgroup label="More">
        <option value={null}>None</option>
      </optgroup>
    </Select> -->
  </Field>
  {#if rearPins($protoConfig)}
    <InfoBox>
      Don't solder to the rear row of {rearPins($protoConfig)} pins on the microcontroller, or be very careful
      if you do! Any protrusions in this area under the microcontroller will prevent it from sliding into
      its holder.
    </InfoBox>
  {/if}
  {#if flags.lemons && $protoConfig.microcontroller && !$protoConfig.microcontroller.startsWith('lemon')}
    <InfoBox
      ><a class="text-pink-600 underline" href="docs/firmware/" target="_blank">Firmware autogen</a> is not
      yet supported for this microcontroller. Switch to a Lemon microcontroller to use it.</InfoBox
    >
  {/if}
  {#if castellated($protoConfig)}
    <InfoBox>
      Only solder to the inner holes on the microcontroller. Soldering to the castellated edges will
      prevent it from fitting into the holder.
    </InfoBox>
  {/if}
  {#if !basic}
    <Field name="Microcontroller Angle">
      <AngleInput bind:value={$protoConfig.microcontrollerAngle} />
    </Field>
    <Field
      name="Fasten Microcontroller"
      help="Add clamps above the microcontroller to hold it inside its holder"
    >
      <Checkbox bind:value={$protoConfig.fastenMicrocontroller} />
    </Field>
  {/if}
  <Field name="Fasten Base With Screws" icon="screw">
    <Checkbox value={$protoConfig.screwIndices.length > 0} on:change={setScrewsEnabled} />
  </Field>
  {#if $protoConfig.screwIndices.length > 0}
    {#if !basic}<div class="relative">
        <div class="absolute right-48 top--1.5">
          <button class="button" on:click={enterScrewIndices}><Icon path={mdiCodeJson} /></button>
        </div>
        <Field name="Number of Screws">
          <DecimalInput divisor={1} value={$protoConfig.screwIndices.length} on:change={setNScrews} />
        </Field>
      </div>{/if}
    {#if $protoConfig.screwIndices.some((s) => s >= 0)}
      <InfoBox
        >One or more screws are manually positioned. To edit these positions, click the code brackets
        next to the Advanced &rarr; Number of Screws.</InfoBox
      >
    {/if}
    <Field name="Size of Screws">
      <Select bind:value={$protoConfig.screwSize}>
        {#each SCREW_SIZE as size}
          <option value={size}>{size}</option>
        {/each}
      </Select>
    </Field>
    {#if !basic}
      <Field name="Fastening of Screws">
        <Select bind:value={$protoConfig.screwType}>
          <option value="screw insert">Screw Insert</option>
          <option value="tapered screw insert">Tapered Screw Insert</option>
          <option value="expanding screw insert">Expanding Screw Insert</option>
          <option value="tapped hole">Tapped Hole</option>
        </Select>
      </Field>
      <Field name="Countersink Screws">
        <Checkbox bind:value={$protoConfig.screwCountersink} />
      </Field>
    {/if}
  {/if}
  <Field name="Improved Plate" icon="art" pro help="Add plate art and insets for silicone feet">
    <CheckboxOpt
      bind:value={$protoConfig.plate}
      def={{ art: 'cosmos', footIndices: [-1, -1, -1, -1], footDiameter: 10 }}
    />
  </Field>
  {#if $protoConfig.plate}
    <Field name="Plate Art" pro>
      <Select bind:value={$protoConfig.plate.art}>
        {#each PLATE_ART as art}
          <option value={art}>{capitalize(art || 'None')}</option>
        {/each}
      </Select>
    </Field>
  {/if}
  {#if $protoConfig.plate && $protoConfig.plate.footIndices && $protoConfig.plate.footIndices.length > 0}
    {#if !basic}<div class="relative">
        <div class="absolute right-48 top--1.5">
          <button class="button" on:click={enterFootIndices}><Icon path={mdiCodeJson} /></button>
        </div>
        <Field name="Number of Feet" pro>
          <DecimalInput
            divisor={1}
            value={$protoConfig.plate.footIndices?.length}
            on:change={setNFeet}
          />
        </Field>
      </div>{/if}
    {#if $protoConfig.plate?.footIndices?.some((s) => s >= 0)}
      <InfoBox
        >One or more feet are manually positioned. To edit these positions, click the code brackets next
        to the Advanced &rarr; Number of Feet.</InfoBox
      >
    {/if}
    <Field name="Size of Feet" pro>
      <DecimalInput
        divisor={10}
        bind:value={$protoConfig.plate.footDiameter}
        units="mm"
        on:change={updatePlate}
      />
    </Field>
  {/if}
  <Field name="Rounded Top Edge" icon="round-top" pro>
    <CheckboxOpt bind:value={$protoConfig.rounded.top} def={{ horizontal: 0.25, vertical: 0.67 }} />
  </Field>
  {#if !basic && $protoConfig.rounded.top}
    <Field name="Horizontal Tangent" pro>
      <DecimalInput
        divisor={100}
        multiplier={100}
        units="%"
        bind:value={$protoConfig.rounded.top.horizontal}
      />
    </Field>
    <Field name="Vertical Tangent" pro>
      <DecimalInput
        divisor={100}
        multiplier={100}
        units="%"
        bind:value={$protoConfig.rounded.top.vertical}
      />
    </Field>
  {/if}
  <Field name="Rounded Side" icon="round-side" pro>
    <CheckboxOpt bind:value={$protoConfig.rounded.side} def={{ divisor: 3, concavity: 1.5 }} />
  </Field>
  {#if !basic && $protoConfig.rounded.side}
    <Field name="Rounded Divisor" pro help="Smaller numbers produce more rounded sides">
      <DecimalInput bind:value={$protoConfig.rounded.side.divisor} />
    </Field>
    <Field name="Concavity" pro help="The amount by which the sides of the keyboard are bowed out">
      <DecimalInput bind:value={$protoConfig.rounded.side.concavity} />
    </Field>
  {/if}
  {#if !basic}
    <Field
      name="Wall Shrouding"
      icon="shrouding"
      help="Add a lip to the top of the wall to hide switches"
    >
      <DecimalInput bind:value={$protoConfig.wallShrouding} units="mm" />
    </Field>
    <Field name="Wall Thickness" help="Thickness of the sides the keyboard">
      <DecimalInput bind:value={$protoConfig.wallThickness} units="mm" />
    </Field>
    <Field name="Wall XY Offset" icon="expand-horizontal" help="Horizontal offset for wall positioning">
      <DecimalInput bind:value={$protoConfig.wallXYOffset} units="mm" />
    </Field>
    <Field name="Wall Z Offset" icon="expand-vertical" help="Vertical offset for wall positioning">
      <DecimalInput bind:value={$protoConfig.wallZOffset} units="mm" />
    </Field>
    <Field
      name="Minimum Web Thickness"
      help="Compensation for thin web walls. Specifically, the targeted thickness of the web as a percentage of socket thickness."
    >
      <DecimalInput
        bind:value={$protoConfig.webMinThicknessFactor}
        units="%"
        divisor={100}
        multiplier={100}
      />
    </Field>
    <Field name="Plate Thickness">
      <DecimalInput bind:value={$protoConfig.plateThickness} units="mm" />
    </Field>
    <Field
      name="Vertical Part Clearance"
      icon="expand-vertical"
      help="Add extra height to keep parts off the ground"
    >
      <DecimalInput bind:value={$protoConfig.verticalClearance} units="mm" />
    </Field>
    <Field
      name="Auto Clear Screw Inserts"
      help="Add extra height so that at least 75% of possible screw insert locations are feasible"
    >
      <Checkbox bind:value={$protoConfig.clearScrews} />
    </Field>
  {/if}
  {#if $protoConfig.screwIndices.length}
    <InfoBox>
      <p class="mb-1">
        You'll need {tScrewInserts}
        {$protoConfig.screwSize} x {cScrewHeight($protoConfig.screwSize)} screws {#if $protoConfig.screwCountersink}with
          countersunk heads
        {/if}and {tScrewInserts}
        {$protoConfig.screwType}s to fasten the base plate to the case. Check the
        <a class="text-pink-600 underline" href="https://ryanis.cool/cosmos/docs/screws"
          >Screws Documentation</a
        > to make sure you have the correctly sized parts.
      </p>
    </InfoBox>
  {/if}
</Section>

<Section name="Extras">
  <Field name="Show Wrist Rest" pro icon="hand">
    <Checkbox bind:value={$protoConfig.wristRestEnable} />
  </Field>

  <Field name="Unibody" icon="unibody">
    <Checkbox value={$protoConfig.unibody} on:change={setUnibody} />
  </Field>
  {#if $protoConfig.unibody}
    <Field name="Unibody Separation" help="Minimum distance between the left and right clusters">
      <DecimalInput value={clusterSep} on:change={setClusterSep} units="mm" />
    </Field>
    <Field name="Unibody Angle">
      <AngleInput value={clusterAng} on:change={setClusterAng} />
    </Field>
  {/if}

  {#if !basic}
    <Field name="Wrist Position (XYZ)">
      <div class="ml-1.5" />
      <DecimalInput bind:value={$wrPositionX} supersmall />
      <DecimalInput bind:value={$wrPositionY} supersmall />
      <DecimalInput bind:value={$wrPositionZ} supersmall />
    </Field>

    <Field name="Wrist Rest Max Width (L/R)">
      <DecimalInput bind:value={$protoConfig.wristRestProps.maxWidthLeft} class="w-[5.2rem]" />
      <DecimalInput bind:value={$protoConfig.wristRestProps.maxWidthRight} class="w-[5.2rem]" />
    </Field>

    <Field name="Wrist Rest Extension (L/R)">
      <DecimalInput bind:value={$protoConfig.wristRestProps.extensionLeft} class="w-[5.2rem]" />
      <DecimalInput bind:value={$protoConfig.wristRestProps.extensionRight} class="w-[5.2rem]" />
    </Field>

    <Field name="Wrist Rest Attachment Angle">
      <AngleInput bind:value={$protoConfig.wristRestProps.angle} />
    </Field>

    <Field name="Wrist Rest Side Taper">
      <AngleInput bind:value={$protoConfig.wristRestProps.taper} />
    </Field>

    <Field name="Wrist Rest Forwards Slope">
      <AngleInput bind:value={$protoConfig.wristRestProps.slope} />
    </Field>

    <Field name="Wrist Rest Tenting">
      <AngleInput bind:value={$protoConfig.wristRestProps.tenting} />
    </Field>
  {/if}
</Section>

{#if connectorView}
  <Dialog on:close={() => (connectorView = false)}>
    <span slot="title">Edit Connectors</span>
    <div slot="content"><ConnectorsView bind:connectors={$protoConfig.connectors} /></div>
  </Dialog>
{/if}

{#if sizeEditView}
  <Dialog small on:close={() => (sizeEditView = false)}>
    <span slot="title">Set Size Exactly</span>
    <div slot="content">
      <SizeEditView on:size={(e) => setSize(e.detail[0] + 1, e.detail[1], false)} />
    </div>
  </Dialog>
{/if}

<style>
  .button {
    --at-apply: 'appearance-none bg-slate-200 dark:bg-gray-900 px-2 py-1 m-1 rounded text-gray-800 dark:text-gray-200 flex items-center  gap-2';
  }
  .button:not(:disabled) {
    --at-apply: 'hover:bg-gray-400 dark:hover:bg-gray-700';
  }

  :global(.iconpreset) {
    padding-top: calc(1rem - 10px) !important;
    padding-bottom: calc(1rem - 10px) !important;
    vertical-align: bottom;
  }
</style>

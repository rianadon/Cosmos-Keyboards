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
  } from '$lib/worker/config'
  import {
    MICROCONTROLLER_NAME,
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
  } from '$lib/geometry/microcontrollers'
  import {
    fromCosmosConfig,
    mirrorCluster,
    toCosmosConfig,
    type CosmosKeyboard,
    type PartType,
  } from '$lib/worker/config.cosmos'
  import Field from '$lib/presentation/Field.svelte'
  import Checkbox from '$lib/presentation/Checkbox.svelte'
  import CheckboxOpt from '$lib/presentation/CheckboxOptDef.svelte'
  import Select from '$lib/presentation/Select.svelte'
  import { notNull } from '$lib/worker/util'
  import { profileName, sortProfiles } from '../viewers/viewer3dHelpers'
  import { PART_NAMES, SWITCHES } from '$lib/geometry/socketsParts'
  import DecimalInputInherit from './DecimalInputInherit.svelte'
  import {
    Cuttleform_CurvedThumb_KEY_COUNT,
    Cuttleform_DefaultThumb_KEY_COUNT,
    ENCODER,
  } from '../../../../../target/proto/cuttleform'
  import { getSize, setClusterSize } from './visualEditorHelpers'
  import { mdiPencil } from '@mdi/js'
  import Icon from '$lib/presentation/Icon.svelte'

  export let cosmosConf: CosmosKeyboard
  export let conf: FullCuttleform
  export let geometry: Geometry | null
  export let basic: boolean

  $: protoConfig.set(cosmosConf)
  $: conf = fromCosmosConfig($protoConfig)

  const dispatch = createEventDispatcher()

  function goAdvanced() {
    dispatch('goAdvanced')
  }

  let lastMicrocontroller: MicrocontrollerName = 'kb2040-adafruit'
  let lastConnector: ConnectorType = 'trrs'
  let lastScrews: number[] = [-1, -1, -1, -1, -1, -1, -1]

  function setSize(rows: number, cols: number) {
    const originalSize = getSize($protoConfig, 'right')!
    protoConfig.update((k) => {
      setClusterSize(k, 'left', rows, cols)
      setClusterSize(k, 'right', rows, cols)
      return k
    })
    if (originalSize.rows == 0) {
      $protoConfig.wristRestEnable = true
      $protoConfig.microcontroller = lastMicrocontroller
      $protoConfig.connector = lastConnector
      $protoConfig.screwIndices = lastScrews
    } else {
      lastMicrocontroller = $protoConfig.microcontroller
      lastConnector = $protoConfig.connector
      lastScrews = $protoConfig.screwIndices
    }
    if (rows == 0) {
      $protoConfig.wristRestEnable = false
      $protoConfig.microcontroller = null
      $protoConfig.connector = null
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
        tilt: $rotationY / 2,
        raiseBy: 10,
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
  function updateMicrocontroller() {
    if (!basic) return

    const isBluetooth =
      $protoConfig.microcontroller != null &&
      BOARD_PROPERTIES[$protoConfig.microcontroller].extraName?.toLowerCase().includes('bluetooth')

    if ($protoConfig.microcontroller == null) $protoConfig.connector = null
    else if (isBluetooth) $protoConfig.connector = 'usb'
    else $protoConfig.connector = 'trrs'
  }

  let lastSwitch: PartType['type'] = 'mx-better'
  let lastKeycap: Exclude<Profile, null> = 'xda'

  function updateKeycaps() {
    $protoConfig.keyBasis = $protoConfig.profile
    if ($protoConfig.profile == 'choc') {
      lastSwitch = $protoConfig.partType.type!
      $protoConfig.partType.type = 'choc'
    } else if ($protoConfig.partType.type == 'choc') {
      $protoConfig.partType.type = lastSwitch
    }
  }

  function updateSwitch() {
    if ($protoConfig.partType.type == 'choc') {
      lastKeycap = $protoConfig.profile
      $protoConfig.profile = 'choc'
      $protoConfig.keyBasis = $protoConfig.profile
    } else if ($protoConfig.profile == 'choc') {
      $protoConfig.profile = lastKeycap
      $protoConfig.keyBasis = $protoConfig.profile
    }
  }

  function updateRotation(t: bigint) {
    if (!$protoConfig) return
    const fingers = $protoConfig.clusters.find((c) => c.name == 'fingers')!
    if (t < 0 || t == (fingers.rotation || 0n)) return
    protoConfig.update((proto) => {
      fingers.rotation = t
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
    const n = Number(e.detail)
    $protoConfig.screwIndices = new Array(n).fill(-1)
  }

  function isThumb(name: string) {
    return false
  }

  function setThumb(type: 'carbonfet' | 'manuform' | 'orbyl' | 'curved') {
    // @ts-ignore
    let cc: CuttleformProto = { ...cuttleform.options }

    if (type == 'manuform')
      cc.thumbCluster = {
        oneofKind: 'defaultThumb',
        defaultThumb: {
          thumbCount: Cuttleform_DefaultThumb_KEY_COUNT.SIX,
          encoder: false,
          encoderType: ENCODER.EC11,
        },
      }
    else if (type == 'curved')
      cc.thumbCluster = {
        oneofKind: 'curvedThumb',
        curvedThumb: {
          thumbCount: Cuttleform_CurvedThumb_KEY_COUNT.FIVE,
          rowCurve: 0,
          columnCurve: 0,
          horizontalSpacing: 200,
          verticalSpacing: 200,
          encoder: false,
          encoderType: ENCODER.EC11,
        },
      }
    else if (type == 'orbyl')
      cc.thumbCluster = {
        oneofKind: 'orbylThumb',
        orbylThumb: {
          curvature: 0,
        },
      }
    else if (type == 'carbonfet')
      cc.thumbCluster = {
        oneofKind: 'carbonfetThumb',
        carbonfetThumb: {
          rowCurve: -225,
          columnCurve: -450,
          horizontalSpacing: 200,
          verticalSpacing: 205,
        },
      }
    const cosc = toCosmosConfig(cuttleConf(cc))
    const coscthumb = cosc.clusters.find((c) => c.name == 'thumbs')!
    protoConfig.update((proto) => {
      const thumb = proto.clusters.find((c) => c.name == 'thumbs')!
      thumb.clusters = coscthumb.clusters
      thumb.rotation = coscthumb.rotation
      thumb.position = coscthumb.position
      return proto
    })
  }

  function rearPins(conf: CosmosKeyboard): number {
    if (conf.microcontroller == null) return 0
    return BOARD_PROPERTIES[conf.microcontroller].rearPins || 0
  }
  function castellated(conf: CosmosKeyboard): boolean {
    if (conf.microcontroller == null) return false
    return BOARD_PROPERTIES[conf.microcontroller].castellated || false
  }

  $: rightThumbCluster = $protoConfig.clusters.find((c) => c.name == 'thumbs' && c.side == 'right')!
  $: leftThumbCluster = $protoConfig.clusters.find((c) => c.name == 'thumbs' && c.side == 'left')
  $: rightFingersCl = $protoConfig.clusters.find((c) => c.name == 'fingers' && c.side == 'right')!
  $: leftFingersCl = $protoConfig.clusters.find((c) => c.name == 'fingers' && c.side == 'left')
  $: tempFingersCluster = $tempConfig.clusters.find((c) => c.name == 'fingers')!

  const rotationStore = new TupleStore(-1n, 45, true)
  const [rotationX, rotationY, rotationZ, _] = rotationStore.components()
  rotationStore.tuple.subscribe((t) => updateRotation(t))
  $: rotationStore.update(tempFingersCluster.rotation || 0n)

  const wrPositionStore = new TupleStore(-1n, 10)
  const [wrPositionX, wrPositionY, wrPositionZ, _2] = wrPositionStore.components()
  wrPositionStore.tuple.subscribe((t) => updateWrPosition(t))
  $: wrPositionStore.update($protoConfig.wristRestPosition || 0n)
</script>

<Section name="Upper Keys">
  <button class="absolute top-0 right-2 button" on:click={() => editJointlySeparately('fingers')}
    ><Icon path={mdiPencil} />{#if leftFingersCl}Edit Jointly{:else}Edit Separately{/if}</button
  >
  <Preset on:click={() => setSize(3, 4)} selected={isSize($protoConfig, 3, 4)}>3 × 4</Preset>
  <Preset on:click={() => setSize(4, 5)} selected={isSize($protoConfig, 4, 5)}>4 × 5</Preset>
  <Preset on:click={() => setSize(4, 6)} selected={isSize($protoConfig, 4, 6)}>4 × 6</Preset>
  <Preset on:click={() => setSize(5, 5)} selected={isSize($protoConfig, 5, 5)}>5 × 5</Preset>
  <Preset on:click={() => setSize(5, 6)} selected={isSize($protoConfig, 5, 6)}>5 × 6</Preset>
  <Preset on:click={() => setSize(0, 0)} selected={isSize($protoConfig, 0, 0)}
    ><span class="relative top-[-0.1em]">&empty;</span></Preset
  >
  <Field name="Keycaps" icon="keycap">
    <Select bind:value={$protoConfig.profile} on:change={updateKeycaps}>
      {#each notNull(PROFILE).sort(sortProfiles) as prof}
        <option value={prof}>{profileName(prof, true)}</option>
      {/each}
    </Select>
  </Field>
  <Field name="Switches" icon="switch" on:change={updateSwitch}>
    <Select bind:value={$protoConfig.partType.type}>
      {#each SWITCHES as part}
        <option value={part}>{PART_NAMES[part]}</option>
      {/each}
    </Select>
  </Field>
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
    {#if cosmosConf.upperKeys.switchType == SWITCH.MX_PCB}
      <InfoBox>
        <p class="mb-1">
          This variant requires the Amoeba King PCB. The board should fit snug within the guides.
          Friction holds the sockets onto the switch, but you can reinforce using glue/epoxy, two
          3/16 in #0-80 screws or two 4–5 mm M1.6 screws for each key ({conf.keys.length * 4} screws
          total).
        </p>
        <p>
          To fasten, screw down forcefully so the screws carve threads into the plastic. For hard
          plastics, you'll need to tap the holes.
        </p>
      </InfoBox>
    {:else if cosmosConf.upperKeys.switchType == SWITCH.MX_HOTSWAP}
      <InfoBox>
        <p>
          This variant requires Kailh MX hotswap sockets and a well-tuned 3D printer. Alternatives
          are <a class="text-pink-600 underline" href="https://www.printables.com/model/158559"
            >these printable hotswap sockets</a
          >, together with the MX-Compatible (no hotswap) setting, but they don't grip as well as
          the Kailh MX sockets.
        </p>
      </InfoBox>
    {/if}
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
  {#if !basic}<Field name="Rotation Around Row Axis" icon="angle-rotate">
      <AngleInput bind:value={$rotationX} />
    </Field>{/if}
  <Field name="Tenting Angle" icon="angle">
    <AngleInput bind:value={$rotationY} />
  </Field>
</Section>

<Section name="Thumb Cluster">
  <button class="absolute top-0 right-2 button" on:click={() => editJointlySeparately('thumbs')}
    ><Icon path={mdiPencil} />{#if leftThumbCluster}Edit Jointly{:else}Edit Separately{/if}</button
  >
  <Preset name="Manuform" on:click={() => setThumb('default')} selected={isThumb('default')} />
  <Preset name="Carbonfet" on:click={() => setThumb('carbonfet')} selected={isThumb('carbonfet')} />
  <Preset name="Orbyl" on:click={() => setThumb('orbyl')} selected={isThumb('orbyl')} />
  <Preset name="Curved" on:click={() => setThumb('curved')} selected={isThumb('curved')} />
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
  {#if $protoConfig.shell.type == 'tilt'}
    <InfoBox>
      The Tilting Base helps you achieve high tenting angles without needing to print as much
      support. Make sure to print the plate in two parts so that the bottom can be removed for
      access.
    </InfoBox>
  {/if}
  {#if !basic}
    <Field name="Connectivity" icon="usb-port">
      <Select bind:value={$protoConfig.connector}>
        <option value="trrs">TRRS and USB</option>
        <option value="usb">USB only</option>
        <option value={null}>None</option>
      </Select>
    </Field>
    <Field name="USB Connector Size">
      <Select bind:value={$protoConfig.connectorSizeUSB}>
        <option value="slim">Slim (Apple cables)</option>
        <option value="average">Average (most cables)</option>
        <option value="big">Big (fits everything)</option>
      </Select>
    </Field>
    <Field
      name="Connector Index"
      help="Position of the microcontroller and connector, expressed as a wall index. See expert mode documentation for details."
    >
      <DecimalInput bind:value={$protoConfig.connectorIndex} />
    </Field>
  {/if}
  {#if $protoConfig.connectorIndex != -1}
    <InfoBox>
      The microcontroller and connector are manually placed in this model. Set Advanced &rarr;
      Connector Index to -1 to automatically place them.
    </InfoBox>
  {/if}
  <Field name="Microcontroller" icon="microcontroller">
    <Select bind:value={$protoConfig.microcontroller} on:change={updateMicrocontroller}>
      {#each MICROCONTROLLER_SIZES as size}
        <optgroup label={size}>
          {#each notNull(MICROCONTROLLER_NAME)
            .filter((m) => BOARD_PROPERTIES[m].sizeName == size)
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
    </Select>
  </Field>
  {#if rearPins($protoConfig)}
    <InfoBox>
      Don't solder to the rear row of {rearPins($protoConfig)} pins on the microcontroller, or be very
      careful if you do! Any protrusions in this area under the microcontroller will prevent it from
      sliding into its holder.
    </InfoBox>
  {/if}
  {#if castellated($protoConfig)}
    <InfoBox>
      Only solder to the inner holes on the microcontroller. Soldering to the castellated edges will
      prevent it from fitting into the holder.
    </InfoBox>
  {/if}
  {#if !basic}<Field
      name="Fasten Microcontroller"
      help="Add clamps above the microcontroller to hold it inside its holder"
    >
      <Checkbox bind:value={$protoConfig.fastenMicrocontroller} />
    </Field>{/if}
  <Field name="Fasten Base With Screws" icon="screw">
    <Checkbox value={$protoConfig.screwIndices.length > 0} on:change={setScrewsEnabled} />
  </Field>
  {#if $protoConfig.screwIndices.length > 0}
    {#if !basic}<Field name="Number of Screws">
        <DecimalInput divisor={1} value={$protoConfig.screwIndices.length} on:change={setNScrews} />
      </Field>{/if}
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
    <Checkbox bind:value={$protoConfig.unibody} />
  </Field>

  {#if !basic}
    <Field name="Wrist Position (XYZ)">
      <div class="ml-1.5" />
      <DecimalInput bind:value={$wrPositionX} supersmall />
      <DecimalInput bind:value={$wrPositionY} supersmall />
      <DecimalInput bind:value={$wrPositionZ} supersmall />
    </Field>

    <Field name="Wrist Rest Max Width">
      <DecimalInput bind:value={$protoConfig.wristRestProps.maxWidth} units="mm" />
    </Field>

    <Field name="Wrist Rest Side Taper">
      <AngleInput bind:value={$protoConfig.wristRestProps.angle} />
    </Field>

    <Field name="Wrist Rest Forwards Slope">
      <AngleInput bind:value={$protoConfig.wristRestProps.slope} />
    </Field>

    <Field name="Wrist Rest Tenting">
      <AngleInput bind:value={$protoConfig.wristRestProps.tenting} />
    </Field>
  {/if}
</Section>

<style>
  .preset {
    --at-apply: 'bg-[#99F0DC] dark:bg-gray-900 hover:bg-teal-500 dark:hover:bg-teal-700 dark:text-white py-1 px-4 rounded focus:outline-none border border-transparent focus:border-teal-500 mb-2';
  }

  .input-basic {
    --at-apply: 'focus:border-teal-500 border border-transparent text-gray-700 focus:outline-none';
    --at-apply: 'border-gray-200 dark:border-transparent bg-gray-100 dark:bg-gray-700 dark:text-gray-100';
  }

  .input {
    --at-apply: 'appearance-none w-[6.88rem] rounded ml-2.5';
    --at-apply: 'input-basic text-ellipsis';
  }

  .sinput {
    --at-apply: 'appearance-none w-[5.45rem] rounded ml-2.5';
    --at-apply: 'input-basic text-ellipsis';
  }

  .preset {
    --at-apply: 'bg-[#99F0DC] dark:bg-gray-900 hover:bg-teal-500 dark:hover:bg-teal-700 dark:text-white py-1 px-4 rounded focus:outline-none border border-transparent focus:border-teal-500 mb-2';
  }

  .button {
    --at-apply: 'appearance-none bg-gray-200 dark:bg-gray-900 px-2 py-1 m-1 rounded text-gray-800 dark:text-gray-200 flex items-center  gap-2';
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

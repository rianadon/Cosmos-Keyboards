<script lang="ts">
  import { CuttleformSchema } from './schema'
  import {
    cuttleConf,
    thumbOrigin,
    type CuttleformProto,
    thumbs,
    matrixToConfig,
    MAP_SCREW_SIZE,
    MAP_SCREW_TYPE,
    screwHeight,
    type Cuttleform,
    type Geometry,
    MAP_MICROCONTROLLER,
  } from '$lib/worker/config'
  import { checkConfig, isRenderable } from '$lib/worker/check'
  import Section from './Section.svelte'
  import DecimalInput from './DecimalInput.svelte'
  import AngleInput from './AngleInput.svelte'
  import Field from './Field.svelte'
  import manuform from '$assets/manuform.json'
  import Preset from '$lib/presentation/Preset.svelte'
  import InfoBox from '$lib/presentation/InfoBox.svelte'
  import { TupleStore } from './tuple'

  import { createEventDispatcher } from 'svelte'
  import {
    CONNECTOR,
    Cuttleform_CurvedThumb_KEY_COUNT,
    Cuttleform_DefaultThumb_KEY_COUNT,
    KEYCAP,
    MICROCONTROLLER,
    ENCODER,
    SWITCH,
  } from '../../../../../target/proto/cuttleform'
  import { clickedKey, hoveredKey, protoConfig } from '$lib/store'
  import Trsf from '$lib/worker/modeling/transformation'
  import { writable } from 'svelte/store'
  import defaults from '$assets/cuttleform.json'
  import { hasPro } from '@pro'
  import { BOARD_PROPERTIES } from '$lib/geometry/microcontrollers'

  export let cuttleformConf: CuttleformProto
  export let conf: Cuttleform
  export let geometry: Geometry | null
  export let basic: boolean

  $: protoConfig.set(cuttleformConf)
  $: conf = cuttleConf($protoConfig)

  const dispatch = createEventDispatcher()

  function goAdvanced() {
    dispatch('goAdvanced')
  }

  let lastWristRest = defaults.options.wall.wristRest
  let lastMicrocontroller = defaults.options.wall.microcontroller
  let lastConnector = defaults.options.wall.connector
  let lastScrews = defaults.options.wall.screwInserts
  function setSize(rows: number, cols: number) {
    if (cuttleformConf.upperKeys.rows == 0) {
      cuttleformConf.wall.wristRest = lastWristRest
      cuttleformConf.wall.microcontroller = lastMicrocontroller
      cuttleformConf.wall.connector = lastConnector
      cuttleformConf.wall.screwInserts = lastScrews
    } else {
      lastWristRest = cuttleformConf.wall.wristRest
      lastMicrocontroller = cuttleformConf.wall.microcontroller
      lastConnector = cuttleformConf.wall.connector
      lastScrews = cuttleformConf.wall.screwInserts
    }
    if (rows == 0) {
      cuttleformConf.wall.wristRest = false
      cuttleformConf.wall.microcontroller = MICROCONTROLLER.NOMC
      cuttleformConf.wall.connector = CONNECTOR.NONE
      cuttleformConf.wall.screwInserts = false
    }

    cuttleformConf.upperKeys.rows = rows
    cuttleformConf.upperKeys.columns = cols
  }

  function isSize(c: CuttleformProto, rows: number, cols: number) {
    return c.upperKeys.rows == rows && c.upperKeys.columns == cols
  }

  function setThumb(type: string) {
    clickedKey.set(null)
    hoveredKey.set(null)
    if (type == 'default')
      cuttleformConf.thumbCluster = {
        oneofKind: 'defaultThumb',
        defaultThumb: {
          thumbCount: Cuttleform_DefaultThumb_KEY_COUNT.SIX,
          encoder: false,
        },
      }
    else if (type == 'curved')
      cuttleformConf.thumbCluster = {
        oneofKind: 'curvedThumb',
        curvedThumb: {
          thumbCount: Cuttleform_CurvedThumb_KEY_COUNT.FIVE,
          rowCurve: 0,
          columnCurve: 0,
          horizontalSpacing: 200,
          verticalSpacing: 200,
          encoder: false,
        },
      }
    else if (type == 'orbyl')
      cuttleformConf.thumbCluster = {
        oneofKind: 'orbylThumb',
        orbylThumb: {
          curvature: 0,
        },
      }
    else if (type == 'carbonfet')
      cuttleformConf.thumbCluster = {
        oneofKind: 'carbonfetThumb',
        carbonfetThumb: {
          rowCurve: -225,
          columnCurve: -450,
          horizontalSpacing: 200,
          verticalSpacing: 205,
        },
      }
    else if (type === 'custom') {
      const previousOffset = thumbOrigin(cuttleformConf).evaluate({ flat: false }, new Trsf())
      // @ts-ignore I'm doing bad things
      const baseOffset = thumbOrigin(cuttleformConf, true).evaluate({ flat: false }, new Trsf())

      const relativeTransform = previousOffset
        .Matrix4()
        .clone()
        .premultiply(baseOffset.Matrix4().invert())

      const prevOffsetInverse = previousOffset.Matrix4().invert()

      cuttleformConf.thumbCluster = {
        oneofKind: 'customThumb',
        customThumb: {
          plane: matrixToConfig(relativeTransform),
          key: thumbs(cuttleformConf).map((t) => {
            const relativeTransform = t.position
              .evaluate({ flat: false }, new Trsf())
              .Matrix4()
              .premultiply(prevOffsetInverse)
            return matrixToConfig(relativeTransform, t)
          }),
        },
      }
    } else {
      throw new Error('unknown thumb type')
    }
  }

  function setShell(type: string) {
    if (type == 'basic')
      cuttleformConf.shell = {
        oneofKind: 'basicShell',
        basicShell: {
          lip: false,
        },
      }
    else if (type == 'tilt')
      cuttleformConf.shell = {
        oneofKind: 'tiltShell',
        tiltShell: {
          tilt: cuttleformConf.curvature.tenting / 2,
          raiseBy: 100,
          pattern: true,
          patternWidth: 100,
          patternGap: 50,
        },
      }
    else if (type == 'stilts')
      cuttleformConf.shell = {
        oneofKind: 'stiltsShell',
        stiltsShell: {
          inside: false,
        },
      }
    else throw new Error('unknown shell type')
  }

  const schema = Object.fromEntries(CuttleformSchema.map((s) => [s.var, s]))
  $: whichThumb = cuttleformConf.thumbCluster.oneofKind!
  $: whichShell = cuttleformConf.shell.oneofKind!

  $: cols = cuttleformConf.upperKeys.columns
  $: staggerEnabled = [true, cols > 1, cols > 2, cols > 3, cols > 4]
  $: staggerStyle = staggerEnabled.map((x) => (x ? '' : 'opacity-30'))

  let lastSwitch = SWITCH.MX_BETTER
  let lastKeycap = KEYCAP.XDA
  function keyChange(key: string) {
    if (key == 'keycapType') {
      if (cuttleformConf.upperKeys.keycapType == KEYCAP.KCHOC) {
        lastSwitch = cuttleformConf.upperKeys.switchType
        cuttleformConf.upperKeys.switchType = SWITCH.CHOC
      } else if (cuttleformConf.upperKeys.switchType == SWITCH.CHOC) {
        cuttleformConf.upperKeys.switchType = lastSwitch
      }
    } else if (key == 'switchType') {
      if (cuttleformConf.upperKeys.switchType == SWITCH.CHOC) {
        lastKeycap = cuttleformConf.upperKeys.keycapType
        cuttleformConf.upperKeys.keycapType = KEYCAP.KCHOC
      } else if (cuttleformConf.upperKeys.keycapType == KEYCAP.KCHOC) {
        cuttleformConf.upperKeys.keycapType = lastKeycap
      }
    }
  }

  function curvatureChange(key: string) {
    if (basic && key == 'alpha')
      cuttleformConf.curvature.pinkyAlpha = cuttleformConf.curvature.alpha
  }

  function caseChange(key: string) {
    if (basic && key == 'microcontroller') {
      switch (cuttleformConf.wall.microcontroller) {
        case MICROCONTROLLER.NOMC:
          cuttleformConf.wall.connector = CONNECTOR.NONE
          break

        case MICROCONTROLLER.ITSYBITSY_BT:
        case MICROCONTROLLER.XIAO_BT:
        case MICROCONTROLLER.NRFMICRO:
          cuttleformConf.wall.connector = CONNECTOR.USB
          break

        default:
          cuttleformConf.wall.connector = CONNECTOR.TRRS
          break
      }
    }
  }

  const nScrewInserts = writable(cuttleformConf.wall.screwIndices.length)
  $: nScrewInserts.set(cuttleformConf.wall.screwIndices.length)

  nScrewInserts.subscribe((n) => {
    cuttleformConf.wall.screwIndices = Array.from({ length: n }, (_, i) => 0)
  })

  function totalScrewInserts(c: Cuttleform, multiplier: number) {
    if (!geometry) return '...'
    try {
      const confError = checkConfig(conf, geometry, false)
      if (confError && !isRenderable(confError)) {
        return '?'
      }
      return geometry.screwIndices.length * multiplier
    } catch (e) {
      return '?'
    }
  }
  $: tScrewInserts = totalScrewInserts(conf, 2)

  const thumbStore = new TupleStore(cuttleformConf.stagger.staggerThumb)
  const [staggerThumbX, staggerThumbY, staggerThumbZ, staggerThumbO] = thumbStore.components()
  thumbStore.tuple.subscribe((t) => (cuttleformConf.stagger.staggerThumb = t))
  $: thumbStore.update($protoConfig.stagger.staggerThumb)

  const innerIndexStore = new TupleStore(cuttleformConf.stagger.staggerInnerIndex)
  const [staggerInnerIndexX, staggerInnerIndexY, staggerInnerIndexZ, staggerInnerIndexO] =
    innerIndexStore.components()
  innerIndexStore.tuple.subscribe((t) => (cuttleformConf.stagger.staggerInnerIndex = t))
  $: innerIndexStore.update($protoConfig.stagger.staggerInnerIndex)

  const indexStore = new TupleStore(cuttleformConf.stagger.staggerIndex)
  const [staggerIndexX, staggerIndexY, staggerIndexZ, staggerIndexO] = indexStore.components()
  indexStore.tuple.subscribe((t) => (cuttleformConf.stagger.staggerIndex = t))
  $: indexStore.update($protoConfig.stagger.staggerIndex)

  const middleStore = new TupleStore(cuttleformConf.stagger.staggerMiddle)
  const [staggerMiddleX, staggerMiddleY, staggerMiddleZ, staggerMiddleO] = middleStore.components()
  middleStore.tuple.subscribe((t) => (cuttleformConf.stagger.staggerMiddle = t))
  $: middleStore.update($protoConfig.stagger.staggerMiddle)

  const ringStore = new TupleStore(cuttleformConf.stagger.staggerRing)
  const [staggerRingX, staggerRingY, staggerRingZ, staggerRingO] = ringStore.components()
  ringStore.tuple.subscribe((t) => (cuttleformConf.stagger.staggerRing = t))
  $: ringStore.update($protoConfig.stagger.staggerRing)

  const pinkyStore = new TupleStore(cuttleformConf.stagger.staggerPinky)
  const [staggerPinkyX, staggerPinkyY, staggerPinkyZ, staggerPinkyO] = pinkyStore.components()
  pinkyStore.tuple.subscribe((t) => (cuttleformConf.stagger.staggerPinky = t))
  $: pinkyStore.update($protoConfig.stagger.staggerPinky)

  function rearPins(conf: CuttleformProto): number {
    const micro = MAP_MICROCONTROLLER[conf.wall.microcontroller]
    if (micro == null) return 0
    return BOARD_PROPERTIES[micro].rearPins || 0
  }
  function castellated(conf: CuttleformProto): boolean {
    const micro = MAP_MICROCONTROLLER[conf.wall.microcontroller]
    if (micro == null) return false
    return BOARD_PROPERTIES[micro].castellated || false
  }
</script>

<Section name="Upper Keys">
  <svelte:fragment slot="preset">
    {#if basic}
      <Preset on:click={() => setSize(3, 4)} selected={isSize(cuttleformConf, 3, 4)}>3 × 4</Preset>
      <Preset on:click={() => setSize(4, 5)} selected={isSize(cuttleformConf, 4, 5)}>4 × 5</Preset>
      <Preset on:click={() => setSize(4, 6)} selected={isSize(cuttleformConf, 4, 6)}>4 × 6</Preset>
      <Preset on:click={() => setSize(5, 5)} selected={isSize(cuttleformConf, 5, 5)}>5 × 5</Preset>
      <Preset on:click={() => setSize(5, 6)} selected={isSize(cuttleformConf, 5, 6)}>5 × 6</Preset>
      <Preset on:click={() => setSize(0, 0)} selected={isSize(cuttleformConf, 0, 0)}
        ><span class="relative top-[-0.1em]">&empty;</span></Preset
      >
      <Preset gray on:click={() => goAdvanced()}>+</Preset>
    {/if}
  </svelte:fragment>
  <svelte:fragment slot="content">
    {#each schema.upperKeys.fields as key}
      {#if !basic || key.basic}
        <Field
          schema={key}
          bind:value={cuttleformConf.upperKeys[key.var]}
          on:change={() => keyChange(key.var)}
        />
      {/if}
    {/each}
    {#if cuttleformConf.upperKeys.switchType == SWITCH.MX_PCB}
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
    {:else if cuttleformConf.upperKeys.switchType == SWITCH.MX_HOTSWAP}
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
<Section name="Curvature">
  <svelte:fragment slot="content">
    {#each schema.curvature.fields as key}
      {#if !basic || key.basic}
        <Field
          schema={key}
          bind:value={cuttleformConf.curvature[key.var]}
          on:change={() => curvatureChange(key.var)}
        />
      {/if}
    {/each}
  </svelte:fragment>
</Section>
<Section name="Thumb Cluster">
  <svelte:fragment slot="preset">
    <Preset
      name="Manuform"
      on:click={() => setThumb('default')}
      selected={cuttleformConf.thumbCluster.oneofKind == 'defaultThumb'}
    />
    <Preset
      name="Carbonfet"
      on:click={() => setThumb('carbonfet')}
      selected={cuttleformConf.thumbCluster.oneofKind == 'carbonfetThumb'}
    />
    <Preset
      name="Orbyl"
      on:click={() => setThumb('orbyl')}
      selected={cuttleformConf.thumbCluster.oneofKind == 'orbylThumb'}
    />
    <Preset
      name="Curved"
      on:click={() => setThumb('curved')}
      selected={cuttleformConf.thumbCluster.oneofKind == 'curvedThumb'}
    />
    <Preset
      name="Custom"
      on:click={() => setThumb('custom')}
      selected={cuttleformConf.thumbCluster.oneofKind == 'customThumb'}
    />
  </svelte:fragment>
  <svelte:fragment slot="content">
    {#each schema[whichThumb].fields as key}
      {#if (!basic || key.basic) && !key.special}
        <Field schema={key} bind:value={cuttleformConf.thumbCluster[whichThumb][key.var]} />
      {/if}
    {/each}
    {#if cuttleformConf.thumbCluster.oneofKind == 'defaultThumb' && cuttleformConf.thumbCluster.defaultThumb.encoder}
      <InfoBox
        >You'll need an {cuttleformConf.thumbCluster.defaultThumb.encoderType == ENCODER.EC11
          ? 'EC11 encoder (I measured the keebio one)'
          : 'EVQWGD001 encoder'} and a knob.</InfoBox
      >
    {/if}
    {#if cuttleformConf.thumbCluster.oneofKind == 'curvedThumb' && cuttleformConf.thumbCluster.curvedThumb.encoder}
      <InfoBox
        >You'll need an {cuttleformConf.thumbCluster.curvedThumb.encoderType == ENCODER.EC11
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
    <Preset
      on:click={() => setShell('basic')}
      selected={cuttleformConf.shell.oneofKind == 'basicShell'}>Default</Preset
    >
    {#if hasPro}<Preset
        name="Stilts"
        on:click={() => setShell('stilts')}
        selected={cuttleformConf.shell.oneofKind == 'stiltsShell'}
        >Stilts <span
          class="{cuttleformConf.shell.oneofKind == 'stiltsShell'
            ? 'text-teal-100'
            : 'text-teal-500'} dark:text-teal-400 font-bold ml-2">PRO</span
        ></Preset
      >{/if}
    <Preset
      on:click={() => setShell('tilt')}
      selected={cuttleformConf.shell.oneofKind == 'tiltShell'}>Tilting Base</Preset
    >
  </svelte:fragment>
  <svelte:fragment slot="content">
    {#if cuttleformConf.shell.oneofKind == 'tiltShell'}
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
        <Field schema={key} bind:value={cuttleformConf.shell[whichShell][key.var]} />
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
            bind:value={cuttleformConf.wall[key.var]}
            on:change={() => caseChange(key.var)}
          />
          {#if key.var == 'microcontroller' && rearPins(cuttleformConf)}
            <InfoBox>
              Don't solder to the rear row of {rearPins(cuttleformConf)} pins on the microcontroller,
              or be very careful if you do! Any protrusions in this area under the microcontroller will
              prevent it from sliding into its holder.
            </InfoBox>
          {/if}
          {#if key.var == 'microcontroller' && castellated(cuttleformConf)}
            <InfoBox>
              Only solder to the inner holes on the microcontroller. Soldering to the castellated
              edges will prevent it from fitting into the holder.
            </InfoBox>
          {/if}
        {/if}
      {/if}
    {/each}
    {#if cuttleformConf.wall.screwInserts}
      <InfoBox>
        <p class="mb-1">
          You'll need {tScrewInserts}
          {MAP_SCREW_SIZE[cuttleformConf.wall.screwSize]} x {screwHeight(cuttleformConf)} screws {#if cuttleformConf.wall.countersinkScrews}with
            countersunk heads
          {/if}and {tScrewInserts}
          {MAP_SCREW_TYPE[cuttleformConf.wall.screwType]}s in order to fasten the base plate to the
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
        <Field schema={key} bind:value={cuttleformConf.wall[key.var]} />
      {/if}
    {/each}
  </svelte:fragment>
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

  :global(.iconpreset) {
    padding-top: calc(1rem - 10px) !important;
    padding-bottom: calc(1rem - 10px) !important;
    vertical-align: bottom;
  }
</style>

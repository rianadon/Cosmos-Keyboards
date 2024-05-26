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
  import type { Keyboard } from 'target/proto/cosmos'
  import { fromCosmosConfig, type CosmosKey, type CosmosKeyboard } from '$lib/worker/config.cosmos'

  export let cosmosConf: CosmosKeyboard
  export let conf: Cuttleform
  export let geometry: Geometry | null
  export let basic: boolean

  $: protoConfig.set(cosmosConf)
  $: conf = fromCosmosConfig($protoConfig)

  const dispatch = createEventDispatcher()

  function goAdvanced() {
    dispatch('goAdvanced')
  }

  /*let lastWristRest = defaults.options.wall.wristRest
  let lastMicrocontroller = defaults.options.wall.microcontroller
  let lastConnector = defaults.options.wall.connector
  let lastScrews = defaults.options.wall.screwInserts*/
  function setSize(rows: number, cols: number) {}
  /*    if (cosmosConf.upperKeys.rows == 0) {
      cosmosConf.wall.wristRest = lastWristRest
      cosmosConf.wall.microcontroller = lastMicrocontroller
      cosmosConf.wall.connector = lastConnector
      cosmosConf.wall.screwInserts = lastScrews
    } else {
      lastWristRest = cosmosConf.wall.wristRest
      lastMicrocontroller = cosmosConf.wall.microcontroller
      lastConnector = cosmosConf.wall.connector
      lastScrews = cosmosConf.wall.screwInserts
    }
    if (rows == 0) {
      cosmosConf.wall.wristRest = false
      cosmosConf.wall.microcontroller = MICROCONTROLLER.NOMC
      cosmosConf.wall.connector = CONNECTOR.NONE
      cosmosConf.wall.screwInserts = false
    }

    cosmosConf.upperKeys.rows = rows
    cosmosConf.upperKeys.columns = cols
  }
*/
  function getSize(c: CosmosKeyboard) {
    const fingers = c.clusters.find((c) => c.name == 'fingers')
    if (!fingers) return { rows: 0, cols: 0 }
    return {
      cols: fingers.clusters.length,
      rows: Math.max(...fingers.clusters.map((c) => c.keys.length)),
    }
  }

  function isSize(c: CosmosKeyboard, rows: number, cols: number) {
    const { rows: ro, cols: co } = getSize(c)
    return ro == rows && co == cols
  }
  /*

  function setThumb(type: string) {
    clickedKey.set(null)
    hoveredKey.set(null)
    if (type == 'default')
      cosmosConf.thumbCluster = {
        oneofKind: 'defaultThumb',
        defaultThumb: {
          thumbCount: Cuttleform_DefaultThumb_KEY_COUNT.SIX,
          encoder: false,
        },
      }
    else if (type == 'curved')
      cosmosConf.thumbCluster = {
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
      cosmosConf.thumbCluster = {
        oneofKind: 'orbylThumb',
        orbylThumb: {
          curvature: 0,
        },
      }
    else if (type == 'carbonfet')
      cosmosConf.thumbCluster = {
        oneofKind: 'carbonfetThumb',
        carbonfetThumb: {
          rowCurve: -225,
          columnCurve: -450,
          horizontalSpacing: 200,
          verticalSpacing: 205,
        },
      }
    else if (type === 'custom') {
      const previousOffset = thumbOrigin(cosmosConf).evaluate({ flat: false }, new Trsf())
      // @ts-ignore I'm doing bad things
      const baseOffset = thumbOrigin(cosmosConf, true).evaluate({ flat: false }, new Trsf())

      const relativeTransform = previousOffset
        .Matrix4()
        .clone()
        .premultiply(baseOffset.Matrix4().invert())

      const prevOffsetInverse = previousOffset.Matrix4().invert()

      cosmosConf.thumbCluster = {
        oneofKind: 'customThumb',
        customThumb: {
          plane: matrixToConfig(relativeTransform),
          key: thumbs(cosmosConf).map((t) => {
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
      cosmosConf.shell = {
        oneofKind: 'basicShell',
        basicShell: {
          lip: false,
        },
      }
    else if (type == 'tilt')
      cosmosConf.shell = {
        oneofKind: 'tiltShell',
        tiltShell: {
          tilt: cosmosConf.curvature.tenting / 2,
          raiseBy: 100,
          pattern: true,
          patternWidth: 100,
          patternGap: 50,
        },
      }
    else if (type == 'stilts')
      cosmosConf.shell = {
        oneofKind: 'stiltsShell',
        stiltsShell: {
          inside: false,
        },
      }
    else throw new Error('unknown shell type')
  }

  const schema = Object.fromEntries(CuttleformSchema.map((s) => [s.var, s]))
  $: whichThumb = cosmosConf.thumbCluster.oneofKind!
  $: whichShell = cosmosConf.shell.oneofKind!

  $: cols = cosmosConf.upperKeys.columns
  $: staggerEnabled = [true, cols > 1, cols > 2, cols > 3, cols > 4]
  $: staggerStyle = staggerEnabled.map((x) => (x ? '' : 'opacity-30'))

  let lastSwitch = SWITCH.MX_BETTER
  let lastKeycap = KEYCAP.XDA
  function keyChange(key: string) {
    if (key == 'keycapType') {
      if (cosmosConf.upperKeys.keycapType == KEYCAP.KCHOC) {
        lastSwitch = cosmosConf.upperKeys.switchType
        cosmosConf.upperKeys.switchType = SWITCH.CHOC
      } else if (cosmosConf.upperKeys.switchType == SWITCH.CHOC) {
        cosmosConf.upperKeys.switchType = lastSwitch
      }
    } else if (key == 'switchType') {
      if (cosmosConf.upperKeys.switchType == SWITCH.CHOC) {
        lastKeycap = cosmosConf.upperKeys.keycapType
        cosmosConf.upperKeys.keycapType = KEYCAP.KCHOC
      } else if (cosmosConf.upperKeys.keycapType == KEYCAP.KCHOC) {
        cosmosConf.upperKeys.keycapType = lastKeycap
      }
    }
  }

  function curvatureChange(key: string) {
    if (basic && key == 'alpha') cosmosConf.curvature.pinkyAlpha = cosmosConf.curvature.alpha
  }

  function caseChange(key: string) {
    if (basic && key == 'microcontroller') {
      switch (cosmosConf.wall.microcontroller) {
        case MICROCONTROLLER.NOMC:
          cosmosConf.wall.connector = CONNECTOR.NONE
          break

        case MICROCONTROLLER.ITSYBITSY_BT:
        case MICROCONTROLLER.XIAO_BT:
        case MICROCONTROLLER.NRFMICRO:
          cosmosConf.wall.connector = CONNECTOR.USB
          break

        default:
          cosmosConf.wall.connector = CONNECTOR.TRRS
          break
      }
    }
  }

  const nScrewInserts = writable(cosmosConf.wall.screwIndices.length)
  $: nScrewInserts.set(cosmosConf.wall.screwIndices.length)

  nScrewInserts.subscribe((n) => {
    cosmosConf.wall.screwIndices = Array.from({ length: n }, (_, i) => 0)
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

  const thumbStore = new TupleStore(cosmosConf.stagger.staggerThumb)
  const [staggerThumbX, staggerThumbY, staggerThumbZ, staggerThumbO] = thumbStore.components()
  thumbStore.tuple.subscribe((t) => (cosmosConf.stagger.staggerThumb = t))
  $: thumbStore.update($protoConfig.stagger.staggerThumb)

  const innerIndexStore = new TupleStore(cosmosConf.stagger.staggerInnerIndex)
  const [staggerInnerIndexX, staggerInnerIndexY, staggerInnerIndexZ, staggerInnerIndexO] =
    innerIndexStore.components()
  innerIndexStore.tuple.subscribe((t) => (cosmosConf.stagger.staggerInnerIndex = t))
  $: innerIndexStore.update($protoConfig.stagger.staggerInnerIndex)

  const indexStore = new TupleStore(cosmosConf.stagger.staggerIndex)
  const [staggerIndexX, staggerIndexY, staggerIndexZ, staggerIndexO] = indexStore.components()
  indexStore.tuple.subscribe((t) => (cosmosConf.stagger.staggerIndex = t))
  $: indexStore.update($protoConfig.stagger.staggerIndex)

  const middleStore = new TupleStore(cosmosConf.stagger.staggerMiddle)
  const [staggerMiddleX, staggerMiddleY, staggerMiddleZ, staggerMiddleO] = middleStore.components()
  middleStore.tuple.subscribe((t) => (cosmosConf.stagger.staggerMiddle = t))
  $: middleStore.update($protoConfig.stagger.staggerMiddle)

  const ringStore = new TupleStore(cosmosConf.stagger.staggerRing)
  const [staggerRingX, staggerRingY, staggerRingZ, staggerRingO] = ringStore.components()
  ringStore.tuple.subscribe((t) => (cosmosConf.stagger.staggerRing = t))
  $: ringStore.update($protoConfig.stagger.staggerRing)

  const pinkyStore = new TupleStore(cosmosConf.stagger.staggerPinky)
  const [staggerPinkyX, staggerPinkyY, staggerPinkyZ, staggerPinkyO] = pinkyStore.components()
  pinkyStore.tuple.subscribe((t) => (cosmosConf.stagger.staggerPinky = t))
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
  }*/
</script>

<Section name="Upper Keys">
  <svelte:fragment slot="preset">
    {#if basic}
      <Preset on:click={() => setSize(3, 4)} selected={isSize($protoConfig, 3, 4)}>3 × 4</Preset>
      <Preset on:click={() => setSize(4, 5)} selected={isSize($protoConfig, 4, 5)}>4 × 5</Preset>
      <Preset on:click={() => setSize(4, 6)} selected={isSize($protoConfig, 4, 6)}>4 × 6</Preset>
      <Preset on:click={() => setSize(5, 5)} selected={isSize($protoConfig, 5, 5)}>5 × 5</Preset>
      <Preset on:click={() => setSize(5, 6)} selected={isSize($protoConfig, 5, 6)}>5 × 6</Preset>
      <Preset on:click={() => setSize(0, 0)} selected={isSize($protoConfig, 0, 0)}
        ><span class="relative top-[-0.1em]">&empty;</span></Preset
      >
      <Preset gray on:click={() => goAdvanced()}>+</Preset>
    {/if}
  </svelte:fragment>
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
<Section name="Curvature">
  <svelte:fragment slot="content">
    {#each schema.curvature.fields as key}
      {#if !basic || key.basic}
        <Field
          schema={key}
          bind:value={cosmosConf.curvature[key.var]}
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
{JSON.stringify(getSize($protoConfig))}

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

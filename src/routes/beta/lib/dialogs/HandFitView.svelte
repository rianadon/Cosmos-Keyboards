<script lang="ts">
  import { decodeTuple, encodeTuple } from '$lib/worker/config'
  import { protoConfig } from '$lib/store'
  import { createEventDispatcher, onMount } from 'svelte'
  import { readHands, type HandData } from '$lib/handhelpers'
  import Icon from '$lib/presentation/Icon.svelte'
  import { mdiHandBackLeft, mdiHandBackRight, mdiHelp } from '@mdi/js'
  import { SolvedHand, FINGERS, type Joints } from '../hand'
  import { Matrix4, Vector3 } from 'three'
  import HandFitViewTable from './HandFitViewTable.svelte'

  let hands: HandData | undefined = undefined
  const dispatch = createEventDispatcher()

  type Finger = (typeof FINGERS)[number]
  function relativeStaggerFor(finger: Finger, joints: Joints, hand: SolvedHand) {
    const angles = [5, 4, 9]
    // hand.fkBy(finger, (i) => [(angles[i] / 180) * Math.PI, 0])
    const mcpPos = new Vector3() // hand.worldPositions(finger, 1000)[1]
    // const pos = hand.worldPositions(finger, 1000)
    // const endPoint = pos[4]
    let x = 0
    let y = 0
    let a = 0
    angles.forEach((ang, i) => {
      a += ang
      x += joints[finger][i + 1].length * 1000 * Math.cos((a * Math.PI) / 180)
      y -= joints[finger][i + 1].length * 1000 * Math.sin((a * Math.PI) / 180)
      console.log(finger, joints[finger][i + 1].length * 1000, a, x, y)
    })
    return [x, y]
  }

  function staggers(j: Joints): Partial<Record<Finger, Vector3>> {
    const hand = new SolvedHand(j, new Matrix4())
    const [indexX, indexY] = relativeStaggerFor('indexFinger', j, hand)
    const [middleX, middleY] = relativeStaggerFor('middleFinger', j, hand)
    const [ringX, ringY] = relativeStaggerFor('ringFinger', j, hand)
    const [pinkyX, pinkyY] = relativeStaggerFor('pinky', j, hand)

    // const xAvg = (indexX + middleX + ringX + pinkyX) / 4
    // const yMax = Math.max(indexY, middleY, ringY, pinkyY)

    return {
      indexFinger: new Vector3(0, indexX - indexX, indexY - indexY),
      middleFinger: new Vector3(0, middleX - indexX, middleY - indexY),
      ringFinger: new Vector3(0, ringX - indexX, ringY - indexY),
      pinky: new Vector3(0, pinkyX - indexX, pinkyY - indexY),
    }
  }

  onMount(() => {
    hands = readHands()
  })

  const encodeStagger = (stagger: Vector3, old: number[]) =>
    encodeTuple([
      Math.round(stagger.x * 10),
      Math.round(stagger.y * 10),
      Math.round(stagger.z * 10),
      old[3],
    ])

  function apply(side: 'left' | 'right') {
    const stagger = staggers(hands![side])

    protoConfig.update((c) => {
      const originalIndex = decodeTuple(c.stagger.staggerIndex)
      const originalMiddle = decodeTuple(c.stagger.staggerMiddle)
      const originalRing = decodeTuple(c.stagger.staggerRing)
      const originalPinky = decodeTuple(c.stagger.staggerPinky)
      return {
        ...c,
        stagger: {
          ...c.stagger,
          staggerIndex: encodeStagger(stagger.indexFinger!, originalIndex),
          staggerMiddle: encodeStagger(stagger.middleFinger!, originalMiddle),
          staggerRing: encodeStagger(stagger.ringFinger!, originalRing),
          staggerPinky: encodeStagger(stagger.pinky!, originalPinky),
        },
      }
    })
    dispatch('apply')
  }
</script>

<div class="bg-amber-200 m-4 rounded px-4 py-2 dark:bg-yellow-700">
  Hand Fitting is released as beta feature. Please consider tuning the parameters aftwards, using
  the Hand 3d model as a guide.
</div>

{#if hands}
  <div class="m-4">
    <div class="max-w-prose mx-auto">
      The following parameters are recommended for your hand. The existing Thumb & &lt; Index
      settings, plus all splay settings are kept.
    </div>
    <div class="flex justify-around my-6">
      <div>
        <h3 class="text-xl text-teal-500 dark:text-teal-300 font-semibold mb-2 ml-7">
          LEFT STAGGER
        </h3>
        <HandFitViewTable stagger={staggers(hands.left)} />
      </div>
      <div>
        <h3 class="text-xl text-teal-500 dark:text-teal-300 font-semibold mb-2 ml-7">
          RIGHT STAGGER
        </h3>
        <HandFitViewTable stagger={staggers(hands.right)} />
      </div>
    </div>
  </div>

  <div class="text-center my-4">
    <a
      class="text-gray-700 dark:text-gray-400 hover:text-teal-500 hover:dark:text-teal-300 hover:underline"
      href="https://ryanis.cool/cosmos/docs/hand-fitting"
    >
      How are these calculated?
    </a>
  </div>

  <div class="text-center mt-6">
    <p class="flex justify-center gap-4">
      <button class="button flex items-center gap-2" on:click={() => apply('left')}>
        <Icon path={mdiHandBackLeft} /> Apply Left
      </button>
      <button class="button flex items-center gap-2" on:click={() => apply('right')}>
        <Icon path={mdiHandBackRight} /> Apply Right
      </button>
    </p>
  </div>
{/if}

<style>
  .button {
    --at-apply: 'bg-purple-300 dark:bg-gray-900 hover:bg-purple-400 dark:hover:bg-pink-900 text-black dark:text-white font-bold py-2 px-4 rounded focus:outline-none border border-transparent focus:border-pink-500';
  }
</style>

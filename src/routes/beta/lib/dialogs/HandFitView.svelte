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
  import { mirrorCluster, type CosmosCluster, type CosmosKeyboard } from '$lib/worker/config.cosmos'
  import type { Homing } from 'target/cosmosStructs'

  let hands: HandData | undefined = undefined
  const dispatch = createEventDispatcher()

  let applyError: Error | undefined = undefined

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

  type Staggers = Partial<Record<Finger, Vector3>>
  function staggers(j: Joints): Partial<Staggers> {
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

  const encodeStagger = (stagger: Vector3, flip = false) =>
    encodeTuple([
      Math.round(stagger.x * (flip ? -10 : 10)),
      Math.round(stagger.y * 10),
      Math.round(stagger.z * 10),
    ])

  function findColumnByHoming(cluster: CosmosCluster, home: Homing) {
    return cluster.clusters.find((cluster) => cluster.keys.find((k) => k.profile.home == home))
  }

  function setStaggersCluster(cluster: CosmosCluster, staggers: Staggers, flip = false) {
    findColumnByHoming(cluster, 'index')!.position = encodeStagger(staggers.indexFinger!, flip)
    findColumnByHoming(cluster, 'middle')!.position = encodeStagger(staggers.middleFinger!, flip)
    findColumnByHoming(cluster, 'ring')!.position = encodeStagger(staggers.ringFinger!, flip)
    findColumnByHoming(cluster, 'pinky')!.position = encodeStagger(staggers.pinky!, flip)
  }

  function apply(side?: 'left' | 'right') {
    try {
      protoConfig.update((c) => {
        const rightSide = c.clusters.find((c) => c.name == 'fingers' && c.side == 'right')
        const leftSide = c.clusters.find((c) => c.name == 'fingers' && c.side == 'left')
        if (side == 'right' || side == 'left') {
          const stagger = staggers(hands![side])
          if (rightSide) setStaggersCluster(rightSide, stagger)
          if (leftSide) setStaggersCluster(leftSide, stagger, true)
        } else {
          const staggerLeft = staggers(hands!.left)
          const staggerRight = staggers(hands!.right)
          setStaggersCluster(rightSide!, staggerRight)
          if (leftSide) {
            setStaggersCluster(leftSide, staggerLeft, true)
          } else {
            // Mirror the right cluster to the left, then set its size
            const newLeftSide = mirrorCluster(rightSide!)
            setStaggersCluster(newLeftSide, staggerLeft, true)
            c.clusters.splice(2, 0, newLeftSide)
          }
        }
        return c
      })
      dispatch('apply')
    } catch (e) {
      applyError = e as Error
    }
  }
</script>

<div class="bg-amber-200 m-4 rounded px-4 py-2 dark:bg-yellow-700">
  Hand Fitting is released as beta feature. Please consider tuning the parameters aftwards, using the
  Hand 3d model as a guide.
</div>

{#if hands}
  <div class="m-4">
    <div class="max-w-prose mx-auto">
      The following parameters are recommended for your hand. Clicking Apply will reset all modifications
      you've made to the upper keys.
    </div>
    <div class="flex justify-around my-6">
      <div>
        <h3 class="text-xl text-teal-500 dark:text-teal-300 font-semibold mb-2 ml-7">LEFT STAGGER</h3>
        <HandFitViewTable stagger={staggers(hands.left)} />
      </div>
      <div>
        <h3 class="text-xl text-teal-500 dark:text-teal-300 font-semibold mb-2 ml-7">RIGHT STAGGER</h3>
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
    <p class="flex justify-center gap-4 items-center">
      <button
        class="button flex items-center gap-2 h-9 text-sm font-medium!"
        on:click={() => apply('left')}
      >
        <Icon path={mdiHandBackLeft} /> Apply Left To Both
      </button>
      <button class="button flex items-center gap-2" on:click={() => apply()}>
        <Icon path={mdiHandBackRight} /> Apply
      </button>
      <button
        class="button flex items-center gap-2 h-9 text-sm font-medium!"
        on:click={() => apply('right')}
      >
        <Icon path={mdiHandBackRight} /> Apply Right To Both
      </button>
    </p>
  </div>
{/if}

{#if applyError}
  <div class="bg-red-200 m-4 mb-2 rounded p-4 dark:bg-red-700 font-mono text-sm whitespace-pre-wrap">
    Error applying the stagger: {applyError.message}
  </div>
{/if}

<style>
  .button {
    --at-apply: 'bg-purple-300 dark:bg-gray-900 hover:bg-purple-400 dark:hover:bg-pink-900 text-black dark:text-white font-bold py-2 px-4 rounded focus:outline-none border border-transparent focus:border-pink-500';
  }
</style>

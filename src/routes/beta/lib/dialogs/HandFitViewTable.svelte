<script lang="ts">
  import type { Vector3 } from 'three'
  import type { FINGERS } from '../hand'

  type Finger = (typeof FINGERS)[number]
  const FINGER_NAMES: Record<Finger, string> = {
    thumb: 'Thumb',
    indexFinger: 'Index',
    middleFinger: 'Middle',
    ringFinger: 'Ring',
    pinky: 'Pinky',
  }

  const round = (x: number) => Math.round(x * 10) / 10

  export let stagger: Partial<Record<Finger, Vector3>>
  $: staggerKeys = Object.keys(stagger) as Finger[]
</script>

<table>
  <thead>
    <tr>
      <th />
      {#each staggerKeys as k}
        <th class="font-normal pb-0.5 pl-4 text-left">{FINGER_NAMES[k]}</th>
      {/each}
    </tr>
  </thead>
  <tbody>
    <tr>
      <th class="font-normal">X</th>
      {#each Object.values(stagger) as v}
        <td><div class="input">{round(v.x)}</div></td>
      {/each}
    </tr>
    <tr>
      <th class="font-normal">Y</th>
      {#each Object.values(stagger) as v}
        <td><div class="input">{round(v.y)}</div></td>
      {/each}
    </tr>
    <tr>
      <th class="font-normal">Z</th>
      {#each Object.values(stagger) as v}
        <td><div class="input">{round(v.z)}</div></td>
      {/each}
    </tr>
  </tbody>
</table>

<style>
  .input {
    --at-apply: ' text-gray-700 bg-gray-100 dark:bg-gray-700 dark:text-gray-100 appearance-none rounded ml-2.5 text-ellipsis px-2 w-14';
  }
</style>

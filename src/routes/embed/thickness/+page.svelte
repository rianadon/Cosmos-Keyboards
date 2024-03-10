<script lang="ts">
  import ThicknessDemo from './ThicknessDemo.svelte'

  let posA = { x: 20, y: -37 }
  let rotA = 0
  let posB = { x: 50, y: -22 }
  let rotB = 10
</script>

<div class="flex text-center">
  <div class="w-full">
    <h1 class="text-[8vh] h-[10vh]">Old Web</h1>
    <ThicknessDemo {posA} {rotA} bind:posB bind:rotB thicknessFactor={0} />
  </div>
  <div class="w-full">
    <h1 class="text-[8vh] h-[10vh]">New Web</h1>
    <ThicknessDemo {posA} {rotA} bind:posB bind:rotB thicknessFactor={1} />
  </div>
</div>

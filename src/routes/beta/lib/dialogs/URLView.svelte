<script lang="ts">
  import { protoConfig } from '$lib/store'
  import { serialize } from '../serialize'
  import cuttleform from '$assets/cuttleform.json'
  import type { Cuttleform as CuttleformProto } from '$target/proto/cuttleform'

  export let mode: string
  export let editorContent: string

  interface Part {
    start: number
    end: number
    name?: string
    clazz?: string
  }
  let parts: Part[] = []

  const origin = window.location.origin
  const pathname = window.location.pathname
  $: prefix = mode == 'advanced' ? '#expert:' : '#cf:'
  $: hash =
    mode == 'advanced'
      ? editorContent?.substring(7)
      : serialize({
          keyboard: 'cf',
          options: $protoConfig,
        }).slice(3)

  function createPart(hash: Uint8Array, name: string, conf: CuttleformProto): Part {
    const part = serialize({
      keyboard: 'cf',
      options: conf,
    }).substring(3)
    const rawPart = Uint8Array.from(window.atob(part), (c) => c.charCodeAt(0))
    const idx = hash.findIndex((_, idx) => {
      for (let i = 0; i < rawPart.length; i++) if (hash[idx + i] != rawPart[i]) return false
      return true
    })
    console.log(idx, rawPart)
    return {
      name,
      start: Math.ceil((idx * 4) / 3),
      end: Math.ceil(((idx + rawPart.length) * 4) / 3),
    }
  }

  function splitWithParts(url: string, parts: Part[]) {
    let index = 0
    let classIdx = 0
    const allParts: Part[] = []
    while (parts.length) {
      if (index != parts[0].start)
        allParts.push({
          start: index,
          end: parts[0].start,
        })
      const part = parts.shift()
      allParts.push({
        ...part,
        clazz: 'c' + ++classIdx,
      })
      index = part.end
    }
    if (index < url.length)
      allParts.push({
        start: index,
        end: url.length,
      })
    return allParts
  }

  function calcParts(mode: string, url: string, conf: CuttleformProto) {
    if (mode == 'advanced') {
      if (!url) return []
      return [
        {
          start: 0,
          end: url.length,
          name: 'Compressed Code',
          clazz: 'c1',
        },
      ]
    }

    const rawHash = Uint8Array.from(window.atob(url), (c) => c.charCodeAt(0))

    return splitWithParts(
      url,
      [
        createPart(rawHash, 'Upper Keys', {
          ...cuttleform.options,
          upperKeys: conf.upperKeys,
        }),
        createPart(rawHash, 'Curvature', {
          ...cuttleform.options,
          curvature: conf.curvature,
        }),
        createPart(rawHash, 'Thumb Cluster', {
          ...cuttleform.options,
          thumbCluster: conf.thumbCluster,
        }),
        createPart(rawHash, 'Stagger', {
          ...cuttleform.options,
          stagger: conf.stagger,
        }),
        createPart(rawHash, 'Walls', {
          ...cuttleform.options,
          wall: conf.wall,
        }),
        createPart(rawHash, 'Shell', {
          ...cuttleform.options,
          shell: conf.shell,
        }),
      ].filter((p) => p.end > p.start)
    )
  }

  $: parts = calcParts(mode, hash, $protoConfig)
</script>

<div class="font-mono break-all">
  {origin + pathname}<span class="c0">{prefix}</span>{#each parts as part}
    <span class={part.clazz}>{hash.substring(part.start, part.end)}</span>
  {/each}
</div>

<div class="font-mono mt-4">
  <span class="mr-2 c0">Mode</span>{#each parts.filter((p) => p.name) as part}
    <span class="mr-2 {part.clazz}">{part.name}</span>
  {/each}
</div>

<style>
  .c0 {
    --at-apply: 'bg-teal-300 dark:bg-teal-500';
  }
  .c1 {
    --at-apply: 'bg-pink-300 dark:bg-pink-500';
  }
  .c2 {
    --at-apply: 'bg-amber-300 dark:bg-amber-500';
  }
  .c3 {
    --at-apply: 'bg-cyan-300 dark:bg-cyan-500';
  }
  .c4 {
    --at-apply: 'bg-red-300 dark:bg-red-500';
  }
  .c5 {
    --at-apply: 'bg-indigo-300 dark:bg-indigo-500';
  }
  .c6 {
    --at-apply: 'bg-orange-300 dark:bg-orange-500';
  }
  .c7 {
    --at-apply: 'bg-green-300 dark:bg-green-500';
  }
</style>

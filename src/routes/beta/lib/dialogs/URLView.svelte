<script lang="ts">
  import { protoConfig } from '$lib/store'
  import { serialize } from '../serialize'
  import type { CosmosKeyboard } from '$lib/worker/config.cosmos'
  import { encodeCosmosConfig, serializeCosmosConfig } from '$lib/worker/config.serialize'
  import { Cluster, type Keyboard } from '../../../../../target/proto/cosmos'

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
  $: prefix = mode == 'advanced' ? '#expert:' : '#cm:'
  $: hash =
    mode == 'advanced'
      ? editorContent?.substring(7)
      : serialize({
          keyboard: 'cm',
          options: $protoConfig,
        }).slice(3)

  function createPart(hash: Uint8Array, name: string, conf: Keyboard): Part {
    const part = serializeCosmosConfig(conf)
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

  function createPartCluster(hash: Uint8Array, name: string, conf: Cluster): Part {
    const rawPart = Cluster.toBinary(conf)
    console.log('rawPart', rawPart)
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
      const part = parts.shift()!
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

  function calcParts(mode: string, url: string, conf: CosmosKeyboard) {
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

    const keeb = encodeCosmosConfig(conf)
    const parts: Part[] = [
      createPartCluster(rawHash, 'Right Upper Keys', keeb.cluster[0]),
      createPartCluster(rawHash, 'Right Thumb Keys', keeb.cluster[1]),
    ]
    let i = 2
    if (conf.clusters.find((c) => c.side == 'left' && c.name == 'fingers'))
      parts.push(createPartCluster(rawHash, 'Left Upper Keys', keeb.cluster[i++]))
    if (conf.clusters.find((c) => c.side == 'left' && c.name == 'thumbs'))
      parts.push(createPartCluster(rawHash, 'Left Thumb Keys', keeb.cluster[i++]))
    parts.push(
      createPart(rawHash, 'Keyboard', {
        ...keeb,
        cluster: [],
      })
    )
    return splitWithParts(
      url,
      parts.filter((p) => p.end > p.start)
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
    <span><span class="whitespace-nowrap {part.clazz}">{part.name}</span> </span>
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

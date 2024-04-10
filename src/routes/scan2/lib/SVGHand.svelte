<script lang="ts">
  import { mapObj } from '$lib/worker/util'
  import { mmToPx } from '../store'

  /** Radius of the finger */
  const FR = 10

  export let side: 'Left' | 'Right'

  const angles: Record<string, number[]> = {
    thumb: [156, 130, 115, 109],
    indexFinger: [105, 96, 95, 93],
    middleFinger: [90, 90, 91, 89],
    ringFinger: [75, 87, 90, 91],
    pinky: [60, 68, 71, 72],
  }
  const lengths: Record<string, number[]> = {
    thumb: [47.4, 43.5, 38.7, 28.3],
    indexFinger: [101.7, 52.1, 29.8, 22.8],
    middleFinger: [100.2, 53.4, 31.3, 22.7],
    ringFinger: [97.4, 48, 28.6, 21.2],
    pinky: [95.8, 37.8, 23.5, 20.3],
  }
  const positions = mapObj(angles, (ang, k) => {
    let x = 0
    let y = 0
    return lengths[k].map((l, i) => {
      x += l * Math.cos((ang[i] * Math.PI) / 180)
      y -= l * Math.sin((ang[i] * Math.PI) / 180)
      return [x, y] as [number, number]
    })
  })
  const flatPos = Object.values(positions).flat()
  const xs = flatPos.map((i) => i[0])
  const ys = flatPos.map((i) => i[1])
  const minX = Math.min(...xs) - FR
  const maxX = Math.max(...xs) + FR
  const minY = Math.min(...ys) - FR
  const maxY = FR

  function fingerPaths(name: string, indices: number[]) {
    let path = ''
    let x = 0
    let y = 0
    const upPositions = []
    const downPositions = []
    for (const i of [0, 1, 2, 3]) {
      const angle = (angles[name][i] * Math.PI) / 180
      x += lengths[name][i] * Math.cos(angle)
      y -= lengths[name][i] * Math.sin(angle)
      if (indices.includes(i)) {
        const pUp: [number, number] = [x - FR * Math.sin(angle), y - FR * Math.cos(angle)]
        const pDown: [number, number] = [x + FR * Math.sin(angle), y + FR * Math.cos(angle)]
        upPositions.push(pUp)
        downPositions.unshift(pDown)
        path += `L${pUp[0]},${pUp[1]}`
      }
    }
    path += `A ${FR} ${FR} 0 0 1 ${downPositions[0]}`
    for (const d of downPositions.slice(1)) {
      path += `L${d[0]},${d[1]}`
    }
    return path
  }

  const path = [
    'M-30,10',
    fingerPaths('thumb', [1, 2, 3]),
    fingerPaths('indexFinger', [0, 1, 2, 3]),
    fingerPaths('middleFinger', [0, 1, 2, 3]),
    fingerPaths('ringFinger', [0, 1, 2, 3]),
    fingerPaths('pinky', [0, 1, 2, 3]),
    'L40,10',
  ].join(' ')

  const style = side == 'Left' ? 'transform: scale(-1, 1)' : undefined
</script>

<svg viewBox="{minX} {minY} {maxX - minX} {maxY - minY}" height={180 * $mmToPx} {style}>
  <path
    d={path}
    stroke="rgba(236, 72, 153, 0.8)"
    stroke-dasharray="5 3"
    fill="rgba(236, 72, 153, 0.2)"
  />
</svg>

<script lang="ts">
  import { socketSize } from '$lib/geometry/socketsParts'
  import { newGeometry, type CuttleKey, type Cuttleform } from '$lib/worker/config'
  import ETrsf from '$lib/worker/modeling/transformation-ext'
  import { polyToD, cssMatrix, webPolys, seqid } from './webTriangles'

  export let posA: { x: number; y: number }
  export let posB: { x: number; y: number }
  export let rotA: number
  export let rotB: number
  export let thicknessFactor: number

  const keySize = socketSize({ type: 'mx-better' } as any) as [number, number, number]
  const VIEWX = 80
  const VIEWY = 40

  const triangleId = seqid()
  const keyA = seqid()
  const keyB = seqid()

  $: keyboard = {
    wallThickness: 5,
    wallShrouding: 0,
    webThickness: 0,
    webMinThicknessFactor: thicknessFactor,
    keyBasis: 'xda',
    connector: null,
    microcontroller: null,
    wristRestOrigin: new ETrsf(),
    connectorSizeUSB: 'average',
    connectorIndex: -1,
    screwIndices: [],
    screwType: 'screw insert',
    screwSize: 'M3',
    screwCountersink: true,
    clearScrews: false,
    fastenMicrocontroller: true,
    verticalClearance: 0,
    rounded: {},
    shell: { type: 'basic', lip: false },
    keys: [
      {
        type: 'mx-better',
        aspect: 1,
        keycap: { profile: 'xda', row: 3 },
        position: new ETrsf().rotate(rotA, [0, 0, 0], [0, 1, 0]).translate(posA.x, 0, posA.y),
        cluster: 'fingers',
      },
      {
        type: 'mx-better',
        aspect: 1,
        keycap: { profile: 'xda', row: 3 },
        position: new ETrsf().rotate(rotB, [0, 0, 0], [0, 1, 0]).translate(posB.x, 0, posB.y),
        cluster: 'fingers',
      },
    ],
  } satisfies Cuttleform

  $: geo = newGeometry(keyboard)
  $: polys = webPolys(geo)

  let dragging = false
  let rotating = false
  let hoveringRotating = false
  let hoveringDragging = false
  $: hovering = hoveringDragging || hoveringRotating
  let dragOffset = { x: 0, y: 0 }
  let rotationOffset = 0
  let svg: SVGSVGElement

  function mousePosition(e: MouseEvent | TouchEvent) {
    // @ts-ignore
    const touch = e.touches ? e.touches[0] : e
    const origin = DOMPoint.fromPoint({ x: touch.pageX, y: touch.pageY })
    const pt = origin.matrixTransform(svg.getScreenCTM()!.inverse())
    return { x: pt.x, y: -pt.y }
  }

  function startDrag(ev: MouseEvent | TouchEvent) {
    const e = ev as typeof ev & { target: { parentNode?: HTMLElement } }
    if (!e.target || !e.target.parentNode) return
    const pos = mousePosition(e)
    if (e.target.parentNode.classList.contains('moveable')) {
      ev.preventDefault()
      dragging = true
      dragOffset = { x: posB.x - pos.x, y: posB.y - pos.y }
    } else if (e.target.parentNode.classList.contains('rotation')) {
      ev.preventDefault()
      rotating = true
      rotationOffset = rotB - (Math.atan2(pos.x - posB.x, pos.y - posB.y) * 180) / Math.PI
      console.log(rotationOffset)
    }
  }

  function drag(e: MouseEvent | TouchEvent) {
    const pos = mousePosition(e)
    if (dragging || rotating) e.preventDefault()
    if (dragging) {
      posB = { x: pos.x + dragOffset.x, y: pos.y + dragOffset.y }
      posB.x = Math.max(posB.x, posA.x + keySize[0] + 2)
    }
    if (rotating) {
      let newRot = (Math.atan2(pos.x - posB.x, pos.y - posB.y) * 180) / Math.PI + rotationOffset
      newRot = (720 + newRot) % 360
      if (newRot < 60 || newRot > 300) rotB = newRot
    }
  }

  function endDrag(e: MouseEvent | TouchEvent) {
    if (dragging || rotating) e.preventDefault()
    dragging = false
    rotating = false
  }
</script>

<svg
  viewBox="0 0 {VIEWX} {VIEWY}"
  class="w-full h-full"
  bind:this={svg}
  on:mousedown={startDrag}
  on:mousemove={drag}
  on:mouseup={endDrag}
  on:mouseleave={endDrag}
  on:touchstart={startDrag}
  on:touchmove={drag}
  on:touchend={endDrag}
  on:touchcancel={endDrag}
>
  <defs>
    <path
      id="keycap"
      d="M-9.05-6.2C-9.05-12-7.891-15.1-6.9-16.6-5-16.8-4-16.4 0-16.4 4-16.4 5-16.8 6.9-16.6 7.891-15.1 9.05-12 9.05-6.2Z"
    />
    <marker
      id={triangleId}
      viewBox="0 0 10 10"
      refX="1"
      refY="5"
      markerUnits="strokeWidth"
      markerWidth="2"
      markerHeight="2"
      orient="auto-start-reverse"
    >
      <path d="M 0 0 L 9 5 L 0 10 z" fill={rotating || hoveringRotating ? '#018573' : '#bcc2c1'} />
    </marker>
    <radialGradient
      id={keyA}
      gradientUnits="userSpaceOnUse"
      r="30"
      cx={posA.x - 5}
      cy={-posA.y - 20}
      fx={posA.x - 5}
      fy={-posA.y - 20}
      gradientTransform={cssMatrix(geo.keyHolesTrsfs[0].inverted())}
    >
      <stop offset="40%" stop-color="#f0abfc" />
      <stop offset="60%" stop-color="#D8A9E8" />
    </radialGradient>
    <radialGradient
      id={keyB}
      gradientUnits="userSpaceOnUse"
      r="30"
      cx={posB.x - 5}
      cy={-posB.y - 20}
      fx={posB.x - 5}
      fy={-posB.y - 20}
      gradientTransform={cssMatrix(geo.keyHolesTrsfs[1].inverted())}
    >
      <stop offset="40%" stop-color={rotating || dragging || hovering ? '#8adbc8' : '#f0abfc'} />
      <stop offset="60%" stop-color={rotating || dragging || hovering ? '#5accb1' : '#D8A9E8'} />
    </radialGradient>
    <filter id="shadow">
      <feOffset dx="-0.15" dy="-0.25" />
      <feMorphology operator="erode" radius="0.2" />
      <feComposite operator="out" in="SourceGraphic" result="inverse" />
      <feFlood flood-color="black" flood-opacity=".2" result="color" />
      <feComposite operator="in" in="color" in2="inverse" result="shadow" />
      <feComposite operator="over" in="shadow" in2="SourceGraphic" />
    </filter>
  </defs>
  <g
    transform={cssMatrix(geo.keyHolesTrsfs[1])}
    class="rotation"
    class:rotating
    on:mouseenter={() => (hoveringRotating = true)}
    on:mouseleave={() => (hoveringRotating = false)}
  >
    <circle cx="0" cy="-1" r="15" class="rotation-touch" />
    <circle cx="0" cy="-1" r="15" class="rotation-circle" />
    <path
      class="rotation-handle"
      marker-start="url(#{triangleId})"
      marker-end="url(#{triangleId})"
      d="M{15 * Math.cos(0.4)},{-1 + 15 * Math.sin(0.4)} A15 15 0 0 0 {15 * Math.cos(0.4)},{-1 -
        15 * Math.sin(0.4)}"
    />
  </g>
  <g filter="url(#shadow)">
    {#each polys as p}
      <path d={polyToD(p)} class="polygon" />
    {/each}
    <g transform={cssMatrix(geo.keyHolesTrsfs[0])}>
      <rect x={-keySize[0] / 2} width={keySize[0]} height={keySize[2]} class="socket" />
      <path d="M-7.7,0 v-0.8 H-7.1 L-3.6 -6.2 H3.6 L7.1,-0.8 H7.7 v0.8Z" fill="url(#{keyA})" />
      <use href="#keycap" fill="url(#{keyA})" />
    </g>
    <g
      transform={cssMatrix(geo.keyHolesTrsfs[1])}
      class="moveable"
      class:moving={rotating || hovering}
      on:mouseenter={() => (hoveringDragging = true)}
      on:mouseleave={() => (hoveringDragging = false)}
    >
      <rect class="touch" x={-keySize[0] / 2} y="-9" width={keySize[0]} height={keySize[2] + 9} />
      <rect x={-keySize[0] / 2} width={keySize[0]} height={keySize[2]} class="socket" />
      <path d="M-7.7,0 v-0.8 H-7.1 L-3.6 -6.2 H3.6 L7.1,-0.8 H7.7 v0.8Z" fill="url(#{keyB})" />
      <use href="#keycap" fill="url(#{keyB})" />
    </g>
  </g>
</svg>

<style>
  .socket {
    fill: #f0abfc;
  }
  .moveable > *,
  .rotation > * {
    cursor: move;
  }
  .touch {
    fill: transparent;
  }
  .moveable:hover > .socket,
  .moving > .socket {
    fill: #2dd4bf;
  }
  .polygon {
    fill: #cb15d1;
  }
  .rotation-touch {
    fill: none;
    stroke: transparent;
    stroke-width: 3px;
  }
  .rotation-circle {
    fill: none;
    stroke: #dee3e2;
    stroke-width: 0.5px;
    stroke-dasharray: 5% 3%;
  }
  .rotation-handle {
    fill: none;
    stroke: #bcc2c1;
    stroke-width: 1.5px;
  }
  .rotation:hover > .rotation-circle,
  .rotating > .rotation-circle {
    stroke: #018573;
    opacity: 0.3;
  }
  .rotation:hover > .rotation-handle,
  .rotating > .rotation-handle {
    stroke: #018573;
  }
</style>

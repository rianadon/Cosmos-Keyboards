<script lang="ts">
  import * as THREE from 'three'

  import Viewer from './Viewer.svelte'
  import { estimatedCenter } from '$lib/worker/geometry'
  import { rectangle, drawLinedWall, drawWall, drawPath } from './viewerHelpers'
  import { boundingSize } from '$lib/loaders/geometry'

  import type { Cuttleform, CuttleKey, Geometry } from '$lib/worker/config'
  import type { ConfError } from '$lib/worker/check'
  import Trsf from '$lib/worker/modeling/transformation'
  import { keyPosition } from '$lib/worker/modeling/transformation-ext'
  import { flip } from '$lib/store'
  import { keyLine } from '../matrixLayout'

  export let conf: Cuttleform
  export let geometry: Geometry
  export let style: string = ''
  export let confError: ConfError | undefined
  export let darkMode: boolean

  let center: [number, number, number] = [0, 0, 0]

  $: geometries =
    (!confError || confError.type == 'intersection') && geometry
      ? drawState(conf, darkMode, confError, geometry)
      : []
  $: size = boundingSize(geometries.map((g) => g.geometry))

  function multiply(Q, b) {
    let sum = 0
    for (let i = 0; i < Q.length - 1; i++) {
      for (let j = 0; j < Q.length - 1; j++) {
        sum += Q[i + 1][j + 1] * b[i] * b[j]
      }
    }
    return sum / 2
  }

  function minscore(Q, k) {
    const q = 12
    let scores = new Set()
    for (let i = 1; i < Q.length - 1; i++) {
      for (let j = i + 1; j < Q.length - 1; j++) {
        if (Q[i][j] > 0) scores.add(Q[i][j])
      }
    }
    scores = [...scores]
    scores.sort((a, b) => a - b)
    let sum = 0
    for (let i = 0; i < q; i++) {
      sum += scores[i]
    }
    console.log(scores, sum)
    return sum
  }

  function matrix(conf: Cuttleform) {
    const K = conf.keys.length
    const q = Math.ceil(Math.sqrt(K))
    const q2 = Math.ceil(K / q)
    const Q = q * q2

    // Initiailize b0 and d vextors
    const l = new Array(K + Q + 1)
    const u = new Array(K + Q + 1)
    const d = new Array(K * Q + 1).fill(0)

    // Initiailize A and D matrices
    const A: number[][] = []
    const D: number[][] = []
    for (let i = 0; i < K * Q + 1; i++) {
      D[i] = new Array(K * Q + 1).fill(0)
      D[i][i] = 1
      A[i] = new Array(K + Q + 1).fill(0)
    }

    for (let i = 0; i < K; i++) {
      for (let j = 0; j < Q; j++) {
        // sum_xy Gi = 1
        A[i * Q + j + 1][i + 1] = 1
        l[i + 1] = 1
        u[i + 1] = 1

        // 0 <= sum_i Gxy <= 1
        A[i * Q + j + 1][K + j + 1] = 1
        u[K + j + 1] = 1
        l[K + j + 1] = 0

        for (let ii = 0; ii < K; ii++) {
          const x = j % q
          const y = Math.floor(j / q)
          if (x > 0) {
            D[i * Q + j + 1][ii * Q + y * q + x - 1 + 1] += keyPosition(conf.keys[i])
              .origin()
              .sub(keyPosition(conf.keys[ii]).origin())
              .length()
          }
          if (y > 0) {
            D[i * Q + j + 1][ii * Q + (y - 1) * q + x + 1] += keyPosition(conf.keys[i])
              .origin()
              .sub(keyPosition(conf.keys[ii]).origin())
              .length()
          }
          if (x < q - 1) {
            D[i * Q + j + 1][ii * Q + y * q + x + 1 + 1] += keyPosition(conf.keys[i])
              .origin()
              .sub(keyPosition(conf.keys[ii]).origin())
              .length()
          }
          if (y < q2 - 1) {
            D[i * Q + j + 1][ii * Q + (y + 1) * q + x + 1] += keyPosition(conf.keys[i])
              .origin()
              .sub(keyPosition(conf.keys[ii]).origin())
              .length()
          }
        }
      }
    }

    // const max = Math.max(...D.map(d => d.reduce((a, d) => a+d, 0)))
    // for (let i = 0; i < D.length; i++)
    // D[i][i] = max

    const best = bestGuess(conf)

    console.log(best.filter((g) => g == 1).length)
    console.log(D, A, l, u, best)

    let results = [
      0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0,
      0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
      0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
      0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0,
      0.0, 0.0, 0.0, 0.0, 1.0,
    ]
    // results = best

    console.log('QP score', multiply(D, new Array(results.length).fill(1 / Q)))
    console.log('Result score', multiply(D, results))
    console.log('Min score', minscore(D))

    return decodeResults(conf, results)

    // console.time('Solve qp')
    // const res = qp.solveQP(D, d, A, b0)
    // console.timeEnd('Solve qp')
    // console.log(res)

    // const sol = res.solution

    // for (let i = 0; i < K; i++) {
    //     let maxMembership = 0
    //     let membership = -1
    //     for (let j = 0; j < Q; j++) {
    //         const score = sol[i * Q + j + 1]
    //         if (score > maxMembership) {
    //             maxMembership = score
    //             membership = j
    //         }
    //     }
    //     console.log(`Key ${i} is assigned to ${membership}`)
    // }
    //
    // for (let j = 0; j < Q; j++) {
    //     let maxMembership = 0
    //     let membership = -1
    //     for (let i = 0; i < K; i++) {
    //         const score = sol[i * Q + j + 1]
    //         if (score > maxMembership) {
    //             maxMembership = score
    //             membership = j
    //         }
    //     }
    //     console.log(`- Key ${membership} is assigned to ${j}`)
    // }
  }

  function bestGuess(conf: Cuttleform) {
    const K = conf.keys.length
    const q = Math.ceil(Math.sqrt(K))
    const q2 = Math.ceil(K / q)
    const Q = q * q2

    const result = new Array(Q).fill(0)
    const matRow = matrixLine(conf.keys, 'row').slice(0, q)
    matRow.forEach((r, i) => (matRow[i] = r.slice(0, q)))
    const taken = new Set(matRow.flatMap((r) => r.map((k) => k.i)))

    const keysWithPosition = conf.keys.map((k, i) => ({
      ...k,
      i,
      origin: k.position.evaluate({ flat: true }, new Trsf()).origin(),
    }))

    const queue = keysWithPosition.filter((k) => !taken.has(k.i))
    while (queue.length) {
      const k = queue.shift()
      let bestRow
      let bestScore = Infinity
      for (const row of matRow) {
        if (row.length >= q) continue
        const score = k.origin
          .clone()
          .sub(row[row.length - 1].origin)
          .length()
        if (score < bestScore) {
          bestScore = score
          bestRow = row
        }
      }
      bestRow.push(k)
    }

    for (let j = 0; j < Q; j++) {
      const x = j % q
      const y = Math.floor(j / q)
      for (let i = 0; i < K; i++) {
        const xx = matRow[y].findIndex((k) => k.i == i)
        result[i * Q + j] = matRow[y].find((k) => k.i == i) && x == xx ? 1 : 0
      }
    }
    return result
  }

  function decodeResults(conf: Cuttleform, results) {
    const K = conf.keys.length
    const q = Math.ceil(Math.sqrt(K))
    const q2 = Math.ceil(K / q)
    const Q = q * q2

    let colGroups = []
    let rowGroups = []
    for (let j = 0; j < Q; j++) {
      const x = j % q
      const y = Math.floor(j / q)
      if (!colGroups[x]) colGroups[x] = []
      if (!rowGroups[y]) rowGroups[y] = []
      for (let i = 0; i < K; i++) {
        if (results[i * Q + j]) {
          const k = {
            ...conf.keys[i],
            origin: conf.keys[i].position.evaluate({ flat: true }, new Trsf()).origin(),
          }
          colGroups[x][y] = k
          rowGroups[y][x] = k
        }
      }
    }

    rowGroups = rowGroups.map((g) => g.filter((k) => k))
    colGroups = colGroups.map((g) => g.filter((k) => k))
    return { rowGroups, colGroups }
  }

  function splitByCluster(conf: Cuttleform) {
    const clusters: Record<string, CuttleKey[]> = {}
    for (const k of conf.keys) {
      if (!clusters.hasOwnProperty(k.cluster)) clusters[k.cluster] = []
      clusters[k.cluster].push(k)
    }
    return Object.values(clusters)
  }

  function drawState(
    conf: Cuttleform,
    darkMode: boolean,
    confError: ConfError | undefined,
    geo: Geometry
  ) {
    // const { matRow, matCol } = findMatrix(conf)
    // const { rowGroups: matRow, colGroups: matCol } = matrix(conf)
    const clusters = splitByCluster(conf)
    const matCol = clusters.flatMap((c) => keyLine(c, 'col'))
    const matRow = clusters.flatMap((c) => keyLine(c, 'row'))
    // const matCol = matrixLine(conf.keys, 'col')
    // const matRow = matrixLine(conf.keys, 'row')
    // const { rowGroups: matRow, colGroups: matCol } = decodeResults(conf, bestGuess(conf))
    const geos: { geometry: THREE.ShapeGeometry; material: THREE.Material }[] = []

    const config = conf

    const keys = geo.keyHolesTrsfs2D
    center = estimatedCenter(geo)

    const positions = keys.flat().map((k) => k.xyz().slice(0, 2))
    geos.push(
      ...positions.map((p) => ({
        geometry: rectangle(p[0], p[1]),
        material: new THREE.MeshBasicMaterial({ color: darkMode ? 0xffffff : 0x000000 }),
      }))
    )

    const pts = geo.allKeyCriticalPoints2D
    // const allProj = pts.flat().map(p => p.xy())

    geos.push(
      ...pts.map((p) => ({
        geometry: drawWall(p.map((p) => p.xyz())),
        material: new THREE.MeshBasicMaterial({ color: 0xffcc33, transparent: true, opacity: 0.1 }),
      }))
    )
    geos.push(
      ...pts.map((p) => ({
        geometry: drawLinedWall(p.map((p) => p.xyz())),
        material: new THREE.MeshBasicMaterial({ color: 0xffcc33 }),
      }))
    )

    geos.push(
      ...matRow.map((row) => ({
        geometry: drawPath(
          row.map((k) => k.origin.xyz()),
          1
        ),
        material: new THREE.MeshBasicMaterial({ color: 0x3333ff }),
      }))
    )
    geos.push(
      ...matCol.map((column) => ({
        geometry: drawPath(
          column.map((k) => k.origin.xyz()),
          1
        ),
        material: new THREE.MeshBasicMaterial({ color: 0xff3333 }),
      }))
    )

    if (confError?.type == 'intersection') {
      console.log(pts.map((po) => po.map((p) => p.xyz())))
      geos.push(
        ...pts.map((po) => ({
          geometry: drawLinedWall(po.map((p) => p.xy())),
          material: new THREE.MeshBasicMaterial({ color: 0xffcc33 }),
        }))
      )
      if (confError.i >= 0)
        geos.push({
          geometry: drawLinedWall(
            pts[confError.i].map((p) => p.xy()),
            0.5
          ),
          material: new THREE.MeshBasicMaterial({ color: 0xff0000 }),
        })
      if (confError.j >= 0)
        geos.push({
          geometry: drawLinedWall(
            pts[confError.j].map((p) => p.xy()),
            0.5
          ),
          material: new THREE.MeshBasicMaterial({ color: 0xff0000 }),
        })
      return geos
    }

    return geos
  }
</script>

<Viewer
  {geometries}
  {center}
  {size}
  {style}
  cameraPosition={[0, 0, 1]}
  enableRotate={false}
  flip={!$flip}
/>
<div class="absolute inset-1/2">
  <div
    class="rounded text-center flex items-center justify-center w-48 h-16 absolute ml-[-6rem] mt-[-4rem] bg-white dark:bg-gray-800"
  >
    Wiring will improve<br />in the future!
  </div>
</div>

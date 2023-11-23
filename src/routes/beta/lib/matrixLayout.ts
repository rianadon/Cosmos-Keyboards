/** Optimization of matrix layout! */

import type { Cuttleform, CuttleKey } from '$lib/worker/config'
import Trsf from '$lib/worker/modeling/transformation'
import type TypeTrsf from '$lib/worker/modeling/transformation'
import type { Vector } from '$lib/worker/modeling/transformation'

interface Problem {
  w: number
  h: number
  keys: KeyWithPosition[]
  distanceMap: number[][]
  distances: number[]
}

interface State {
  grid: KeyWithPosition[]
}

/** Find children of this incomplete matrix. */
function* children(problem: Problem, s: State) {
  if (s.grid.length == problem.keys.length) return
  for (const key of problem.keys) {
    if (!s.grid.includes(key)) {
      yield { grid: [...s.grid, key] }
    }
  }
}

function isComplete(problem: Problem, s: State) {
  return s.grid.length == problem.keys.length
}

/** A lower bound of the score for a matrix state. */
function score(problem: Problem, s: State) {
  const workingDistances = [...problem.distances]
  let total = 0
  let unassigned = 0

  function processConnection(a: number, b: number) {
    if ((typeof s.grid[a] !== 'undefined') && (typeof s.grid[b] !== 'undefined')) {
      const distance = problem.distanceMap[s.grid[a].i][s.grid[b].i]
      total += distance
      workingDistances.splice(workingDistances.indexOf(distance), 1)
    } else {
      unassigned += 1
    }
  }

  for (let g = 0; g < problem.w * problem.h; g++) {
    const x = g % problem.w
    const y = Math.floor(g / problem.w)
    if (x > 0) processConnection(g, y * problem.w + (x - 1))
    if (y > 0) processConnection(g, (y - 1) * problem.w + x)
  }

  for (let i = 0; i < unassigned; i++) {
    total += workingDistances[i]
  }

  return total
}

function branchAndBound(problem: Problem, initialSolution: State) {
  let bound = score(problem, initialSolution)
  let best = initialSolution

  const empty: State = { grid: [] }
  const fifo: State[] = [empty]
  let visited = 0
  while (fifo.length) {
    const node = fifo.splice(fifo.length - 1, 1)[0]
    for (const child of children(problem, node)) {
      visited += 1
      const sc = score(problem, child)
      if (sc < bound) {
        if (isComplete(problem, child)) {
          bound = sc
          best = child
        } else {
          fifo.push(child)
        }
      }
    }
  }
  console.log('visited', visited)

  return best
}

interface KeyWithPosition {
  i: number
  key: CuttleKey
  origin: Vector
  position: TypeTrsf
}

function keyWithPosition(k: CuttleKey, i: number) {
  const position = k.position.evaluate({ flat: true }, new Trsf())
  return {
    i,
    key: k,
    position,
    origin: position.origin(),
  }
}

export function keyLine(keys: CuttleKey[], direction: 'col' | 'row' = 'col') {
  const keysWithPosition = keys.map(keyWithPosition)
  return matrixLine(keysWithPosition, direction)
}

function matrixLine(keysWithPosition: KeyWithPosition[], direction: 'col' | 'row' = 'col') {
  let x = (v: Vector) => v.x
  let y = (v: Vector) => v.y
  if (direction == 'row') {
    x = (v: Vector) => v.y
    y = (v: Vector) => v.x
  }

  // Start from biggest Y
  const queue: KeyWithPosition[] = [...keysWithPosition].sort((a, b) => y(b.origin) - y(a.origin))
  let activeColumn: KeyWithPosition[] = []
  const columns: KeyWithPosition[][] = []
  while (queue.length) {
    const next = queue.shift()!
    activeColumn.push(next)
    let bestKey: KeyWithPosition
    let bestScore = Infinity
    const keyAxis = next.position.axis(1, 0, 0)
    const keyAngle = Math.atan2(keyAxis.y, keyAxis.x)
    queue.forEach(k => {
      const displacement = k.origin.clone().sub(next.origin)
      const displacementAngle = Math.atan2(displacement.y, displacement.x)
      let difference = (keyAngle - displacementAngle + 4 * Math.PI) % (Math.PI / 2)
      difference = Math.min(difference, Math.PI / 2 - difference)

      // Displacement y is guaranteed to be negative due to sorting order
      if (Math.abs(x(displacement)) > -y(displacement)) return

      // The path can change by at maximum 20 degrees
      if (difference * 180 / Math.PI > 20) return

      const score = displacement.x ** 2 + displacement.y ** 2
      if (score < bestScore) {
        bestScore = score
        bestKey = k
      }
    })
    if (bestScore < Infinity) {
      // Put the chosen key at the front of the queue
      // Next iteration, it'll be added to the current row/column
      // And the key following it will be chosen.
      queue.splice(queue.indexOf(bestKey!), 1)
      queue.unshift(bestKey!)
    } else {
      // End of the row/column!
      columns.push(activeColumn)
      activeColumn = []
    }
  }
  if (activeColumn.length) columns.push(activeColumn)
  return columns
}

function bestGuess(conf: Cuttleform, keysWithPosition: KeyWithPosition[]): State {
  const K = conf.keys.length
  const q = Math.ceil(Math.sqrt(K))
  const q2 = Math.ceil(K / q)
  const Q = q * q2

  const matRow = matrixLine(keysWithPosition, 'row').slice(0, q2)
  matRow.forEach((r, i) => matRow[i] = r.slice(0, q))
  const taken = new Set(matRow.flatMap(r => r.map(k => k.key)))

  const queue = keysWithPosition.filter(k => !taken.has(k.key))
  while (queue.length) {
    const k = queue.shift()!
    let bestRow: KeyWithPosition[] | undefined
    let bestScore = Infinity
    for (const row of matRow) {
      if (row.length >= q) continue
      const score = k.origin.clone().sub(row[row.length - 1].origin).length()
      if (score < bestScore) {
        bestScore = score
        bestRow = row
      }
    }
    bestRow!.push(k)
  }

  const grid: KeyWithPosition[] = []
  for (let j = 0; j < Q; j++) {
    const x = j % q
    const y = Math.floor(j / q)
    grid[y * q + x] = matRow[y][x]
  }
  return { grid }
}

export function findMatrix(conf: Cuttleform) {
  const keys = conf.keys.map(keyWithPosition)

  const best = bestGuess(conf, keys)

  const w = Math.ceil(Math.sqrt(keys.length))
  const h = Math.ceil(keys.length / w)

  const distanceMap: number[][] = Array.from(new Array(keys.length), _ => new Array(keys.length))
  const distances: number[] = []
  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      const distance = keys[i].origin.clone().sub(keys[j].origin).length()
      distanceMap[i][j] = distance
      distanceMap[j][i] = distance
      distances.push(distance)
    }
  }

  distances.sort((a, b) => a - b)
  const problem = { w, h, keys, distanceMap, distances }
  console.log('problem', problem)

  console.log(keys.length)
  console.time('Branch and bound')
  // const solution = branchAndBound(problem, best)
  const solution = best
  console.timeEnd('Branch and bound')
  console.log('solution', solution)
  return unpackState(problem, solution)
}

function unpackState(p: Problem, s: State) {
  console.log(s)
  const matRow: KeyWithPosition[][] = Array.from(new Array(p.h), _ => [])
  const matCol: KeyWithPosition[][] = Array.from(new Array(p.w), _ => [])
  for (let y = 0; y < p.h; y++) {
    for (let x = 0; x < p.w; x++) {
      const key = s.grid[y * p.w + x]
      if (key) {
        matRow[y].push(key)
        matCol[x].push(key)
      }
    }
  }
  console.log(matRow, matCol)
  return { matRow, matCol }
}

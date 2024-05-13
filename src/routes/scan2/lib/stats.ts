/**
 * Collecting statistics on average joint length and standard deviation.
 *
 * Average = E[x] = sum(x)/n
 * Standard deviation = sqrt(E[x^2] - E[x]^2) = sqrt(sum(x^2)/n - (sum(x)/n)^2)
 */
import { FINGERS, type Hand } from './hand'

function mapValues<K extends string | number | symbol, V, R>(
  m: Record<K, V>,
  f: (k: K, v: V) => R,
) {
  const entries = Object.entries(m) as [K, V][]
  return Object.fromEntries(entries.map(([k, v]) => [k, f(k, v)]))
}

export interface Statistics {
  history: Hand[]
  sums: Record<string, number[]>
  sumsSq: Record<string, number[]>
  means: Record<string, number[]>
  stds: Record<string, number[]>
}

export const INITIAL_STAT: () => Statistics = () => ({
  history: [],
  sums: Object.fromEntries(FINGERS.map((l) => [l, [0, 0, 0, 0]])),
  sumsSq: Object.fromEntries(FINGERS.map((l) => [l, [0, 0, 0, 0]])),
  means: Object.fromEntries(FINGERS.map((l) => [l, [0, 0, 0, 0]])),
  stds: Object.fromEntries(FINGERS.map((l) => [l, [0, 0, 0, 0]])),
})

export default function stat(hand: Hand, prev: Statistics) {
  const { history, sums, sumsSq } = prev
  history.push(hand)

  const n = history.length
  Object.entries(hand.limbs).forEach(([limb, vectors]) => {
    vectors.forEach((vec, i) => {
      const distance = vec.length()
      sums[limb][i] += distance
      sumsSq[limb][i] += distance * distance
    })
  })
  const means = mapValues(sums, (_, d) => d.map((x) => x / n))
  const stds = mapValues(sums, (l, d) => d.map((x, i) => Math.sqrt(sumsSq[l][i] / n - (x / n) * (x / n))))

  return { history, sums, sumsSq, means, stds }
}

export function median(arr: number[]) {
  return arr.sort((a, b) => a - b)[Math.floor(arr.length / 2)]
}

export function statMedians(s: Statistics) {
  return Object.fromEntries(FINGERS.map(l => [
    l,
    (s.history.length ? s.history[0].limbs[l] : [0, 0, 0, 0]).map((_, i) => (
      median(s.history.map(h => h.limbs[l][i].length()))
    )),
  ]))
}

export function match<A extends string | number, R>(x: A, cases: Record<A, R>, fallback?: R) {
  if (cases.hasOwnProperty(x)) {
    return cases[x]
  }
  if (typeof fallback === 'undefined') throw new Error(`${x} does not match one of ${Object.keys(cases)}`)
  return fallback
}

export function range(start: number, stop: number) {
  return Array.from({ length: stop - start }, (_, i) => i + start)
}

export function for1<E, R>(a: E[], ...cond: ((a: E) => boolean)[]): (f: (a: E) => R) => R[] {
  return (f) => {
    const results: R[] = []
    for (const i of a) {
      if (cond.every(c => c(i))) results.push(f(i))
    }
    return results
  }
}

export function for2<A, B, R>(a: A[], b: B[], ...cond: ((a: A, b: B) => boolean)[]): (f: (a: A, b: B) => R) => R[][] {
  return (f) => {
    const results: R[][] = []
    for (const i of a) {
      const inner: R[] = []
      for (const j of b) {
        if (cond.every(c => c(i, j))) inner.push(f(i, j))
      }
      results.push(inner)
    }
    return results
  }
}

export function mapObj<K extends string, V, R>(obj: Record<K, V>, f: (a: V, k: K) => R): Record<K, R> {
  const newObj: any = {}
  for (const key of Object.keys(obj) as K[]) {
    newObj[key] = f(obj[key], key)
  }
  return newObj
}

export function filterObj<V>(obj: Record<string, V>, f: (k: string, v: V) => boolean): Record<string, V> {
  const newObj: Record<string, V> = {}
  for (const key of Object.keys(obj)) {
    if (f(key, obj[key])) newObj[key] = obj[key]
  }
  return newObj
}

export function sum(n: number[]) {
  return n.reduce((a, b) => a + b)
}

export function reverseMap<A extends string | number, B extends string | number>(m: Record<A, B>): Record<B, A> {
  return Object.fromEntries(Object.entries(m).map(([a, b]) => [b, a]))
}

export function notNull<E>(a: E[]): Exclude<E, undefined | null>[] {
  return a.filter(e => !!e) as Exclude<E, undefined | null>[]
}

export class DefaultMap<K, V> extends Map<K, V> {
  constructor(private cons: () => V) {
    super()
  }

  get(k: K): V {
    if (this.has(k)) return super.get(k)!
    const v = this.cons()
    super.set(k, v)
    return v
  }
}

export class TallyMap<K> extends DefaultMap<K, number> {
  constructor() {
    super(() => 0)
  }

  incr(k: K) {
    this.set(k, this.get(k) + 1)
  }

  max(): K | undefined {
    let maximum = -1
    let best: K | undefined = undefined
    for (const [k, tally] of this.entries()) {
      if (tally > maximum) {
        maximum = tally
        best = k
      }
    }
    return best
  }
}

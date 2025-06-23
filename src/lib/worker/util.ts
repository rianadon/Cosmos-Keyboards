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

export function for3<A, B, C>(a: A[], b: B[], c: C[], ...cond: ((a: A, b: B, c: C) => boolean)[]): (f: (a: A, b: B, c: C) => void) => void
export function for3<A, B, C, R>(a: A[], b: B[], c: C[], ...cond: ((a: A, b: B, c: C) => boolean)[]): (f: (a: A, b: B, c: C) => R) => R[][][]
export function for3<A, B, C, R>(a: A[], b: B[], c: C[], ...cond: ((a: A, b: B, c: C) => boolean)[]): (f: (a: A, b: B, c: C) => R) => R[][][] {
  return (f) => {
    const results: R[][][] = []
    for (const i of a) {
      const inner: R[][] = []
      for (const j of b) {
        const innerinner: R[] = []
        for (const k of c) {
          if (cond.every(c => c(i, j, k))) innerinner.push(f(i, j, k))
        }
        inner.push(innerinner)
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

export function mapObjNotNull<K extends string, V, R>(obj: Partial<Record<K, V>>, f: (a: Exclude<V, undefined>, k: K) => R): Record<K, R> {
  const newObj: any = {}
  for (const key of Object.keys(obj) as K[]) {
    const value = obj[key]
    newObj[key] = typeof value !== 'undefined' && value !== null ? f(value as Exclude<V, undefined>, key) : undefined
  }
  return newObj
}

export function mapMap<K extends string, V, R>(map: Map<K, V>, f: (a: V, k: K) => R): Map<K, R> {
  const newEntries: [K, R][] = Array.from(map, ([key, value]) => [key, f(value, key)])
  return new Map(newEntries)
}

export function filterObj<V>(obj: Record<string, V>, f: (k: string, v: V) => boolean): Record<string, V> {
  const newObj: Record<string, V> = {}
  for (const key of Object.keys(obj)) {
    if (f(key, obj[key])) newObj[key] = obj[key]
  }
  return newObj
}

export function sum(n: number[]) {
  return n.reduce((a, b) => a + b, 0)
}

export function reverseMap<A extends string | number, B extends string | number>(m: Record<A, B>): Record<B, A> {
  return Object.fromEntries(Object.entries(m).map(([a, b]) => [b, a]))
}

export function notNull<E>(a: readonly E[]): Exclude<E, undefined | null | false>[] {
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

export function diff<T>(n: T, parent: T) {
  if (n == parent) return undefined
  return n
}

export function objKeys<T extends object>(obj: T) {
  return Object.keys(obj) as (keyof T)[]
}

export function objEntries<T extends object>(obj: T) {
  return Object.entries(obj) as [keyof T, T[keyof T]][]
}

export function objEntriesNotNull<T extends object>(obj: T) {
  const entries = objEntries(obj)
  return entries.filter(([k, v]) => v != null && typeof v != 'undefined') as [keyof T, Exclude<T[keyof T], null | undefined>][]
}

export function capitalize(str: string) {
  return str[0].toUpperCase() + str.substring(1)
}

export function trimUndefined<T extends object>(a: T) {
  for (const key of Object.keys(a) as (keyof T)[]) {
    if (typeof a[key] === 'undefined') delete a[key]
  }
  return a
}

export function count<T>(items: T[]): TallyMap<T> {
  const map = new TallyMap<T>()
  items.forEach(i => map.incr(i))
  return map
}

export function findIndexIter<T>(iterator: IteratorObject<T, BuiltinIteratorReturn, unknown>, fn: (v: T) => boolean): number {
  let i = 0
  for (const val of iterator) {
    if (fn(val)) return i
    i++
  }
  return -1
}

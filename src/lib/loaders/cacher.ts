export function makeCacher<A, R>(fn: (a: A) => R): (key: string, a: A) => R
export function makeCacher<A, B, R>(fn: (a: A, b: B) => R): (key: string, a: A, b: B) => R
export function makeCacher<A, B, C, R>(fn: (a: A, b: B, c: C) => R): (key: string, a: A, b: B, c: C) => R
export function makeCacher<R>(fn: any): (...args: any) => R {
  const cache: Map<string, R> = new Map()
  return (key: string, ...args: any) => {
    if (!cache.has(key)) cache.set(key, fn(...args))
    return cache.get(key)!
  }
}

export function makeAsyncCacher<A, R>(fn: (a: A) => Promise<R>): (key: string, a: A) => Promise<R>
export function makeAsyncCacher<A, B, R>(fn: (a: A, b: B) => Promise<R>): (key: string, a: A, b: B) => Promise<R>
export function makeAsyncCacher<A, B, C, R>(fn: (a: A, b: B, c: C) => Promise<R>): (key: string, a: A, b: B, c: C) => Promise<R>
export function makeAsyncCacher<R>(fn: any): (...args: any) => Promise<R> {
  const cache: Map<string, Promise<R>> = new Map()
  return async (key: string, ...args: any) => {
    if (!cache.has(key)) cache.set(key, fn(...args))
    return await cache.get(key)!
  }
}

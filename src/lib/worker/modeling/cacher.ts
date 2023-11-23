import type { Solid } from 'replicad'
import type Trsf from './transformation'

export function makeCacher<A>(fn: (a: A) => Solid): (key: string, pos: Trsf | null, a: A) => Solid
export function makeCacher<A, B>(fn: (a: A, b: B) => Solid): (key: string, pos: Trsf | null, a: A, b: B) => Solid
export function makeCacher<A, B, C>(fn: (a: A, b: B, c: C) => Solid): (key: string, pos: Trsf | null, a: A, b: B, c: C) => Solid
export function makeCacher(fn: any): (...args: any) => Solid {
  const cache: Map<string, Solid> = new Map()
  return (key: string, pos: Trsf | null, ...args: any) => {
    if (!cache[key]) cache.set(key, fn(...args))
    if (!pos) return cache.get(key)!
    try {
      return pos.transform(cache.get(key)!)
    } catch (e) {
      console.warn('Remaking cached ' + key)
      cache[key] = fn(...args)
      return pos.transform(cache.get(key)!)
    }
  }
}

export function makeAsyncCacher<A>(fn: (a: A) => Promise<Solid>): (key: string, pos: Trsf | null, a: A) => Promise<Solid>
export function makeAsyncCacher<A, B>(fn: (a: A, b: B) => Promise<Solid>): (key: string, pos: Trsf | null, a: A, b: B) => Promise<Solid>
export function makeAsyncCacher<A, B, C>(fn: (a: A, b: B, c: C) => Promise<Solid>): (key: string, pos: Trsf | null, a: A, b: B, c: C) => Promise<Solid>
export function makeAsyncCacher(fn: any): (...args: any) => Promise<Solid> {
  const cache: Map<string, Promise<Solid>> = new Map()
  return async (key: string, pos: Trsf | null, ...args: any) => {
    if (!cache.has(key)) cache.set(key, fn(...args))
    if (!pos) return await cache.get(key)!
    try {
      return pos.transform(await cache.get(key)!)
    } catch (e) {
      console.warn('Remaking cached ' + key)
      cache.set(key, fn(...args))
      return pos.transform(await cache.get(key)!)
    }
  }
}

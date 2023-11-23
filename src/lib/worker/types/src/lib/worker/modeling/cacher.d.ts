import type { Solid } from 'replicad'
import type Trsf from './transformation'
export declare function makeCacher<A>(fn: (a: A) => Solid): (key: string, pos: Trsf | null, a: A) => Solid
export declare function makeCacher<A, B>(fn: (a: A, b: B) => Solid): (key: string, pos: Trsf | null, a: A, b: B) => Solid
export declare function makeCacher<A, B, C>(fn: (a: A, b: B, c: C) => Solid): (key: string, pos: Trsf | null, a: A, b: B, c: C) => Solid
export declare function makeAsyncCacher<A>(fn: (a: A) => Promise<Solid>): (key: string, pos: Trsf | null, a: A) => Promise<Solid>
export declare function makeAsyncCacher<A, B>(fn: (a: A, b: B) => Promise<Solid>): (key: string, pos: Trsf | null, a: A, b: B) => Promise<Solid>
export declare function makeAsyncCacher<A, B, C>(fn: (a: A, b: B, c: C) => Promise<Solid>): (key: string, pos: Trsf | null, a: A, b: B, c: C) => Promise<Solid>

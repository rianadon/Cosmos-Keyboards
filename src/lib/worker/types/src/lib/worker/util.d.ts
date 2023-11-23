export declare function match<A extends string | number, R>(x: A, cases: Record<A, R>, fallback?: R): R
export declare function range(start: number, stop: number): number[]
export declare function for1<E, R>(a: E[], ...cond: ((a: E) => boolean)[]): (f: (a: E) => R) => R[]
export declare function for2<A, B, R>(a: A[], b: B[], ...cond: ((a: A, b: B) => boolean)[]): (f: (a: A, b: B) => R) => R[][]
export declare function mapObj<K extends string, V, R>(obj: Record<K, V>, f: (a: V) => R): Record<K, R>
export declare function filterObj<V>(obj: Record<string, V>, f: (k: string, v: V) => boolean): Record<string, V>
export declare function sum(n: number[]): number
export declare function reverseMap<A extends string | number, B extends string | number>(m: Record<A, B>): Record<B, A>

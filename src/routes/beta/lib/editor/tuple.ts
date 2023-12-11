import { decodeTuple, encodeTuple } from '$lib/worker/config'
import { derived, type Readable, type Writable, writable } from 'svelte/store'

export class TupleStore {
  public t0: Writable<number>
  public t1: Writable<number>
  public t2: Writable<number>
  public t3: Writable<number>
  public tuple: Readable<bigint>

  constructor(initial: bigint) {
    const [v0, v1, v2, v3] = decodeTuple(initial)
    this.t0 = writable<number>(v0)
    this.t1 = writable<number>(v1)
    this.t2 = writable<number>(v2)
    this.t3 = writable<number>(v3)
    this.tuple = derived([this.t0, this.t1, this.t2, this.t3], ($values) => {
      return encodeTuple($values)
    }, initial)
  }

  public components() {
    return [this.t0, this.t1, this.t2, this.t3]
  }

  public update(b: bigint) {
    const [v0, v1, v2, v3] = decodeTuple(b)
    this.t0.set(v0)
    this.t1.set(v1)
    this.t2.set(v2)
    this.t3.set(v3)
  }
}

import { decodeTuple, encodeTuple } from '$lib/worker/config'
import { type Readable, readable, type Writable, writable } from 'svelte/store'

const ANGLE_MULT = Math.PI / 180 / 45

export class TupleStore {
  public t0: Writable<number>
  public t1: Writable<number>
  public t2: Writable<number>
  public t3: Writable<number>
  public tuple: Readable<bigint>

  private values: number[]
  private updating = true

  constructor(initial: bigint, private divisor = 10, private zxy = false) {
    let [v0, v1, v2, v3] = decodeTuple(initial)
    if (this.zxy) [v0, v1, v2] = ZYXtoZXY(v0, v1, v2)
    console.log('original', v0, v1, v2, ZXYtoZYX(...ZYXtoZXY(v0, v1, v2)))
    this.values = [v0, v1, v2, v3]
    this.t0 = writable<number>(v0)
    this.t1 = writable<number>(v1)
    this.t2 = writable<number>(v2)
    this.t3 = writable<number>(v3)
    const tupleWriter = writable<bigint>(initial)
    this.tuple = tupleWriter

    const onChange = (handler: (v: number) => void) => (v: number) => {
      handler(v)
      let [x, y, z, a] = this.values.map(v => v * this.divisor)
      if (this.zxy) [x, y, z] = ZXYtoZYX(x, y, z)
      console.log('onchange', x, y, z)
      if (!this.updating) tupleWriter.set(encodeTuple([x, y, z, a].map(v => Math.round(v))))
    }

    this.t0.subscribe(onChange(v => this.values[0] = v))
    this.t1.subscribe(onChange(v => this.values[1] = v))
    this.t2.subscribe(onChange(v => this.values[2] = v))
    this.t3.subscribe(onChange(v => this.values[3] = v))
  }

  public components() {
    return [this.t0, this.t1, this.t2, this.t3]
  }

  public update(b: bigint) {
    let [v0, v1, v2, v3] = decodeTuple(b)
    if (this.zxy) [v0, v1, v2] = ZYXtoZXY(v0, v1, v2)
    console.log('results', v0 / 45, v1 / 45, v2 / 45)
    this.updating = true
    this.t0.set(v0 / this.divisor)
    this.t1.set(v1 / this.divisor)
    this.t2.set(v2 / this.divisor)
    this.updating = false // Let the last set call update the tuple
    this.t3.set(v3 / this.divisor)
  }
}

export function ZYXtoZXY(x: number, y: number, z: number) {
  // Based on the handy conversion table on Wikipedia:
  //  https://en.wikipedia.org/wiki/Euler_angles#Rotation_matrix
  // a, b, y are the parameters for the ZYX ordering
  // these are used to calculate R12, R22, R32, etc.
  // then I plug these matrix elements into the YXY decomposition.
  const ca = Math.cos(z * ANGLE_MULT), cb = Math.cos(y * ANGLE_MULT), cy = Math.cos(x * ANGLE_MULT)
  const sa = Math.sin(z * ANGLE_MULT), sb = Math.sin(y * ANGLE_MULT), sy = Math.sin(x * ANGLE_MULT)
  let angles: [number, number, number] = [
    Math.asin(cb * sy) / ANGLE_MULT,
    Math.atan(sb / (cb * cy)) / ANGLE_MULT,
    Math.atan((cy * sa - ca * sb * sy) / (ca * cy + sa * sb * sy)) / ANGLE_MULT,
  ]
  // if (z * angles[2] < 0) angles = angles.map(x => -x) as any
  return angles
}

export function ZXYtoZYX(x: number, y: number, z: number) {
  // Based on the handy conversion table on Wikipedia:
  //  https://en.wikipedia.org/wiki/Euler_angles#Rotation_matrix
  // a, b, y are the parameters for the ZXY ordering
  // these are used to calculate R12, R22, R32, etc.
  // then I plug these matrix elements into the YXY decomposition.
  const ca = Math.cos(z * ANGLE_MULT), cb = Math.cos(x * ANGLE_MULT), cy = Math.cos(y * ANGLE_MULT)
  const sa = Math.sin(z * ANGLE_MULT), sb = Math.sin(x * ANGLE_MULT), sy = Math.sin(y * ANGLE_MULT)
  let angles: [number, number, number] = [
    Math.atan(sb / (cb * cy)) / ANGLE_MULT,
    Math.asin(cb * sy) / ANGLE_MULT,
    Math.atan((cy * sa + ca * sb * sy) / (ca * cy - sa * sb * sy)) / ANGLE_MULT,
  ]
  // if (z * angles[2] < 0) angles = angles.map(x => -x) as any
  return angles
}

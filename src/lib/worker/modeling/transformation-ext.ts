import { flippedKey, keyInfo } from '$lib/geometry/keycaps'
import { switchInfo } from '$lib/geometry/switches'
import type { Cuttleform, CuttleKey } from '../config'
import Trsf, { Vector } from './transformation'

/**
 * Extended transfomation.
 *
 * Unlike the other trsfs that are meant to perform repeated mathematical computation within the codebase,
 * the extended trsf is meant to be used inside use configuration code.
 *
 * It keeps a history of transformations so that it can be reversed into TypeScript code and supports
 * extra operations for ease-of-use.
 *
 * It is also unique in that it does not immediately compute anything.
 * Instead, operations are placed into the history stack, which is later evaluated
 * when the transformation has the necessary context.
 *
 * Right now the only implemented context is whether the keyboard is being rendered in 3d view
 * or 2d view. This choice affects the positions of the keys in not only Z but also X and Y.
 */

type Point = [number, number, number]

function pointToString(p: number[]) {
  return '[' + p.join(', ') + ']'
}

export interface MatrixOptions {
  column: number
  row: number
  curvatureOfColumn: number
  curvatureOfRow: number
  spacingOfColumns: number
  spacingOfRows: number
  arc?: number
}

export interface ColumnOptions {
  column: number
  curvatureOfRow: number
  spacingOfColumns: number
}

export interface RowOptions {
  row: number
  spacingOfRows: number
  curvatureOfColumn: number
  arc?: number
  columnForArc?: number
}

export interface SphereOptions {
  angle: number
  row: number
  curvature: number
  spacing: number
}

type Unmerged<T> = T | { merged: T; unmerged: Partial<T>; name: string }

interface EvaluationContext {
  flat: boolean
  key?: CuttleKey
}

type Operation =
  | { name: 'translate'; args: [number, number, number, boolean] }
  | { name: 'rotate'; args: [number, Point | undefined, Point | undefined, boolean] }
  | { name: 'mirror'; args: [Point, Point | undefined] }
  | { name: 'multiply'; args: [ETrsf] }
  | { name: 'transformBy'; args: [ETrsf] }
  | { name: 'translateBy'; args: [ETrsf] }
  | { name: 'placeOnMatrix'; args: [Unmerged<MatrixOptions>] }
  | { name: 'placeOnSphere'; args: [Unmerged<SphereOptions>] }
  | { name: 'placeRow'; args: [Unmerged<RowOptions>] }
  | { name: 'placeColumn'; args: [Unmerged<ColumnOptions>] }
  | { name: 'rotateTowards'; args: [Point, number] }

export function stringifyObj(a: any, indent: number) {
  const ind = ' '.repeat(indent)

  if (Array.isArray(a)) return pointToString(a)
  if (a instanceof Constant) return a.name
  if (a instanceof ETrsf) return a.toString(indent + 2) + '\n' + ind
  if (typeof a == 'object') {
    if ('merged' in a) return JSON.stringify(a.unmerged, null, 2).replace(/\n/g, '\n' + ind).replace(/"/g, '').replace(/{\n\s*/, `\{\n${ind}  ...${a.name},\n${ind}  `)
    return JSON.stringify(a, null, 2).replace(/\n/g, '\n' + ind).replace(/"/g, '')
  }
  return a
}

function opToString({ name, args }: Operation, indent: number) {
  /* @ts-ignore */
  if ((name === 'rotate' || name === 'translate') && args[3]) args = args.slice(0, 3)
  for (let i = args.length - 1; i >= 0; i--) {
    /* @ts-ignore */
    if (typeof args[i] == 'undefined') args = args.slice(0, i)
    else break
  }
  return name + '(' + args.map(a => stringifyObj(a, indent)).join(', ') + ')'
}

export default class ETrsf {
  public history: Operation[]

  constructor(history?: Operation[]) {
    this.history = history ?? []
  }

  /** Apply a given operations. */
  private apply(operation: Operation) {
    this.history.push(operation)
    return this
  }

  /** Return a new ETrsf with the given operations applied, without changing this ETrsf. */
  private applied(operation: Operation) {
    return new ETrsf([...this.history]).apply(operation)
  }

  /** Apply the operations executed in the given function just before the final operation. */
  insertBeforeLast(f: (e: this) => void) {
    const last = this.history.pop()
    if (!last) throw new Error('ETrsf must have length>=1 to call insertBeforeLast')
    f(this)
    this.history.push(last)
  }

  /** Translates by a certain amount of mm. */
  translate(xDist: number, yDist: number, zDist: number, inFlat?: boolean): ETrsf
  translate(vector: Point, inFlat?: boolean): ETrsf
  translate(...args: any) {
    return this.apply({ name: 'translate', args: [...args.flat(), true].slice(0, 4) as any })
  }

  translated(xDist: number, yDist: number, zDist: number, inFlat?: boolean): ETrsf
  translated(vector: Point, inFlat?: boolean): ETrsf
  translated(...args: any) {
    return this.applied({ name: 'translate', args: [...args.flat(), true].slice(0, 4) as any })
  }

  /** Rotates through an axis about some position by some number of degrees. */
  rotate(angle: number, position?: Point, direction?: Point, inFlat = true) {
    return this.apply({ name: 'rotate', args: [angle, position, direction, inFlat] })
  }
  rotated(angle: number, position?: Point, direction?: Point, inFlat = true) {
    return this.applied({ name: 'rotate', args: [angle, position, direction, inFlat] })
  }
  /** Rotates the z axis towards a new z axis by some fraction. */
  rotateTowards(vector: Point, fraction: number) {
    return this.apply({ name: 'rotateTowards', args: [vector, fraction] })
  }
  rotateToVertical(fraction: number) {
    return this.apply({ name: 'rotateTowards', args: [[0, 0, 1], fraction] })
  }

  /**
   * Reflect across an axis about some position. If no position is given, reflects about the origin.
   * This preserves the right-handedness of the coordinate system, so that key labels do not get flipped.
   */
  mirror(axis: Point, origin?: Point) {
    return this.apply({ name: 'mirror', args: [axis, origin] })
  }
  mirrored(axis: Point, origin?: Point) {
    return this.applied({ name: 'mirror', args: [axis, origin] })
  }

  /**
   * Apply the transformations of the given Trsf to this Trsf.
   *
   * This is the same as the premultiply function for matrices. A.transformBy(B) is equivalent to BA.
   */
  transformBy(t: ETrsf) {
    return this.apply({ name: 'transformBy', args: [t] })
  }
  transformedBy(t: ETrsf) {
    return this.applied({ name: 'transformBy', args: [t] })
  }

  /**
   * Apply the translation part of a given Trsf to this Trsf.
   *
   * This Trsf will be translated by however much this.transformBy(t) would translate it,
   * but this Trsf's rotation will be preserved.
   */
  translateBy(t: ETrsf) {
    return this.apply({ name: 'translateBy', args: [t] })
  }

  /**
   * Apply a transformation for a key on a specified matrix.
   */
  placeOnMatrix(opts: MatrixOptions) {
    return this.apply({ name: 'placeOnMatrix', args: [opts] })
  }
  /**
   * Apply a transformation for a key on a specified matrix, but just for the row.
   */
  placeRow(opts: RowOptions) {
    return this.apply({ name: 'placeRow', args: [opts] })
  }
  /**
   * Apply a transformation for a key on a specified matrix, but just for the column.
   */
  placeColumn(opts: ColumnOptions) {
    return this.apply({ name: 'placeColumn', args: [opts] })
  }
  /**
   * Apply a transformation for a key on a specified sphere.
   */
  placeOnSphere(opts: SphereOptions) {
    return this.apply({ name: 'placeOnSphere', args: [opts] })
  }

  evaluate(context: EvaluationContext, t?: Trsf): Trsf {
    return this.history.reduce((t, op) => impl(t, context, op), t || new Trsf())
  }

  toString(indent: number): string {
    if (this.history.length == 1) return 'new Trsf().' + opToString(this.history[0], indent)
    return 'new Trsf()\n' + this.history.map(h => ' '.repeat(indent) + '.' + opToString(h, indent)).join('\n')
  }
}

function impl(trsf: Trsf, context: EvaluationContext, operation: Operation): Trsf {
  switch (operation.name) {
    case 'translate':
      return (context.flat && !operation.args[3])
        ? trsf
        : trsf.translate(operation.args[0], operation.args[1], operation.args[2])
    case 'rotate':
      return (context.flat && !operation.args[3])
        ? trsf
        : trsf.rotate(operation.args[0], operation.args[1], operation.args[2])
      // The two mirrors ensure that the coordinate system remains right-handed
      // But that the result still looks "mirrored"
    case 'mirror':
      return trsf.mirror(operation.args[0], operation.args[1]).multiply(new Trsf().mirror(operation.args[0]))
    case 'multiply':
      return trsf.multiply(new ETrsf(operation.args[0].history).evaluate(context, trsf.cleared()))
    case 'transformBy':
      return trsf.premultiply(new ETrsf(operation.args[0].history).evaluate(context, trsf.cleared()))
    case 'translateBy':
      return trsf.translate(new ETrsf(operation.args[0].history).evaluate(context, trsf.cleared()).xyz())
    case 'placeOnMatrix':
      return placeOnMatrixImpl(trsf, operation.args[0], context)
    case 'placeOnSphere':
      return placeOnSphereImpl(trsf, operation.args[0], context)
    case 'rotateTowards':
      return rotateTowardsImpl(trsf, operation.args[0], operation.args[1])
    case 'placeColumn':
      const colArgs = 'merged' in operation.args[0] ? operation.args[0].merged : operation.args[0]
      return placeOnMatrixImpl(trsf, { ...colArgs, row: 0, curvatureOfColumn: 0, spacingOfRows: 0 }, context)
    case 'placeRow':
      const rowArgs = 'merged' in operation.args[0] ? operation.args[0].merged : operation.args[0]
      return placeOnMatrixImpl(trsf, { ...rowArgs, column: rowArgs.columnForArc ?? 0, curvatureOfRow: 0, spacingOfColumns: 0 }, context)
  }
}

function rotateTowardsImpl(t: Trsf, toAxis: Point, fraction: number) {
  const z = t.axis(0, 0, 1)
  const toVec = new Vector(...toAxis).normalize()
  const rotationAngle = fraction * Math.acos(z.dot(toVec))
  const rotationAxis = z.cross(toVec).normalize()
  return t.rotate(rotationAngle * 180 / Math.PI, t.xyz(), rotationAxis.xyz())
}

const X: [number, number, number] = [1, 0, 0]
const Y: [number, number, number] = [0, 1, 0]

const sin = (x: number) => Math.sin(x * Math.PI / 180)

/** The origin of the key (key.position) is positioned this far from the top */
export function keyBase(c: Cuttleform) {
  const sw: CuttleKey['type'] = c.keyBasis == 'choc' ? 'choc' : 'mx-better'
  const switchHeight = switchInfo(sw).height
  const keyHeight = c.keyBasis
    ? keyInfo({
      keycap: { profile: c.keyBasis, row: 4 },
    } as any).depth * 0.9
    : 14.3 - switchHeight // 14.3 is the old value of this function
  return switchHeight + keyHeight
}

const capTopHeight = (c: EvaluationContext) => switchInfo(c.key?.type).height

/** Rotates all keys of a column */
function rotateRow(opts: MatrixOptions, c: EvaluationContext, t: Trsf) {
  // @ts-ignore
  const spacing = opts.spacingOfRows ?? opts.spacingInColumn
  const rowRadius = spacing / 2 / sin(opts.curvatureOfColumn / 2) + capTopHeight(c)
  if (opts.curvatureOfColumn == 0) {
    t.translate(0, -opts.row * spacing, 0)
  } else {
    t.rotate(-opts.curvatureOfColumn * (opts.row), [0, 0, rowRadius], X)
  }
}

/** Rotates all keys of a row */
function rotateCol(opts: MatrixOptions, c: EvaluationContext, t: Trsf) {
  // @ts-ignore
  const spacing = opts.spacingOfColumns ?? opts.spacingInRow
  const columnRadius = spacing / 2 / sin(opts.curvatureOfRow / 2) + capTopHeight(c)
  if (opts.curvatureOfRow == 0) {
    t.translate(opts.column * spacing, 0, 0)
  } else {
    t.rotate(-opts.curvatureOfRow * (opts.column), [0, 0, columnRadius], Y)
  }
}

function placeOnMatrixImpl(t: Trsf, opts: Unmerged<MatrixOptions>, c: EvaluationContext) {
  let options = 'merged' in opts ? opts.merged : opts
  if (c.flat) {
    options = {
      ...options,
      curvatureOfColumn: Math.min(20, options.curvatureOfColumn),
      curvatureOfRow: Math.min(20, options.curvatureOfRow),
    }
  }
  rotateRow(options, c, t)
  // t.rotate(90 * Math.tanh(options.column * options.row / 20))
  if (options.arc && options.arc != 0) {
    // 28.636 comes from ensuring rotation = 1deg when options.column * options.row = 1 and arc = 1.
    // I chose atan because it's odd, has two horizontal asymptotes, and it's trig so intuitively seems well-suited for geometry stuff.
    // 90 / Math*PI ensures the asymptotes occur at +- 45 degrees.
    t.rotate(90 / Math.PI * Math.atan(options.arc * options.column * options.row / 28.636))
  }
  rotateCol(options, c, t)
  return t
}

function placeOnSphereImpl(t: Trsf, opts: Unmerged<SphereOptions>, c: EvaluationContext) {
  let options = 'merged' in opts ? opts.merged : opts
  if (c.flat) {
    options = {
      ...options,
      curvature: Math.min(20, options.curvature),
    }
  }
  const radius = (options.spacing) / 2 / sin(options.curvature / 2) + capTopHeight(c)
  if (options.curvature == 0) {
    t.translate(0, options.row * (options.spacing), 0)
  } else {
    t.rotate(-options.curvature * options.row, [0, 0, -radius], X)
  }
  t.rotate(-options.angle)
  return t
}

export class Constant extends ETrsf {
  constructor(public name: string, history: Operation[] = []) {
    super(history)
  }
}

export function keyPosition(c: Cuttleform, key: CuttleKey, flat: boolean) {
  const info = keyInfo(key)
  return key.position.evaluate(
    { flat, key },
    new Trsf()
      .translate(0, 0, -keyInfo(key).depth - switchInfo(key.type).height)
      .rotate(info.tilt, [0, 0, 0], [1, 0, 0])
      .translate(0, 0, keyBase(c)),
  )
}

export function keyPositionTop(c: Cuttleform, key: CuttleKey, flat: boolean) {
  return key.position.evaluate(
    { flat, key },
    new Trsf()
      .translate(0, 0, keyBase(c)),
  )
}

function rotate(keys: CuttleKey[], angle: number, position: [number, number, number]) {
  return keys.map(k => ({
    ...k,
    position: k.position.rotated(angle, position),
  }))
}

export function fullMirrorETrsf(e: ETrsf) {
  const newHistory = JSON.parse(JSON.stringify(e.history)) as typeof e.history
  for (const h of newHistory) {
    if (h.name == 'placeOnMatrix') {
      const args: MatrixOptions = (h.args[0] as any).merged ?? h.args[0]
      args.column = -args.column
    } else if (h.name == 'placeColumn') {
      const args: MatrixOptions = (h.args[0] as any).merged ?? h.args[0]
      args.column = -args.column
    } else if (h.name == 'placeOnSphere') {
      const args: SphereOptions = (h.args[0] as any).merged ?? h.args[0]
      args.angle = -args.angle
    } else if (h.name == 'translate') {
      h.args[0] = -h.args[0]
    } else if (h.name == 'rotate') {
      if (!h.args[2] || h.args[2][0] != 1) h.args[0] *= -1
    } else if (h.name == 'transformBy') {
      h.args[0] = fullMirrorETrsf(h.args[0])
    } else if (h.name == 'translateBy') {
      h.args[0] = fullMirrorETrsf(h.args[0])
    }
  }
  return new ETrsf(newHistory)
}

/** Mirror a set of keys and return the mirrored keys. */
export function mirror(keys: CuttleKey[], flipKeys = true): CuttleKey[] {
  const mirroredKeys = keys.map(k => {
    const newK = {
      ...k,
      position: fullMirrorETrsf(k.position),
    }
    if (flipKeys && 'keycap' in newK && newK.keycap && newK.keycap.letter) {
      newK.keycap = { ...newK.keycap, letter: flippedKey(newK.keycap.letter) }
    }
    return newK
  })
  return mirroredKeys
}

/**
 * Mirror a set of keys, with a given minimum X gap between them.
 *
 * Both the original keys and the mirrored keys will be returned.
 * This is useful for creating full keyboards instead of ones split in half.
 */
export function unibody(keys: CuttleKey[], gap = 30, angle = 0): CuttleKey[] {
  const minX = Math.min(...keys.map(k => keyPosition({} as any, k, false).origin().x))
  const axisX = minX - gap / 2 - 10
  const mirroredKeys = keys.map(k => {
    const newK = {
      ...k,
      position: k.position.mirrored([1, 0, 0], [axisX, 0, 0]),
    }
    if ('keycap' in newK && newK.keycap && newK.keycap.letter) {
      newK.keycap = { ...newK.keycap, letter: flippedKey(newK.keycap.letter) }
    }
    return newK
  })
  return [...rotate(keys, angle, [axisX, 0, 0]), ...rotate(mirroredKeys, -angle, [axisX, 0, 0])]
}

/**
 * Change the key labels to reflect what they should be on the mirrored side of the keyboard.
 *
 * This function returns copies of the keys that are passed in.
 */
export function flipKeyLabels(keys: CuttleKey[]): CuttleKey[] {
  return keys.map(k => {
    const newK = {
      ...k,
      position: new ETrsf([...k.position.history]),
    }
    if ('keycap' in newK && newK.keycap && newK.keycap.letter) {
      newK.keycap = { ...newK.keycap, letter: flippedKey(newK.keycap.letter) }
    }
    return newK
  })
}

import { socketSize } from '$lib/geometry/socketsParts'
import type { CuttleKey } from '$lib/worker/config'
import { Assembly } from '$lib/worker/modeling/assembly'
import { drawRoundedRectangle, makeBaseBox, Solid } from 'replicad'

/** Tolerance around PCB + Display on each side */
const DISP_TOL = 0.05

type Point = [number, number]
export interface DisplayProps {
  /** Length of the long side of the PCB */
  pcbLongSideWidth: number
  /** Length of the short side of the PCB */
  pcbShortSideWidth: number
  /** How much the display is offset from the left long side of the PCB */
  offsetFromLeftLongSide: number
  /** How much the display is offset from the right long side of the PCB */
  offsetFromRightLongSide: number
  /** How much the display is offset from the top short side of the PCB. */
  offsetFromTopShortSide: number
  /** How much the display is offset from the bottom short side of the PCB. */
  offsetFromBottomShortSide: number
  /** How thick the display part is (excluding PCB) */
  displayThickness: number
  /** How thick the PCB is */
  pcbThickness: number
  /** Rectangles for PCB alignment that protrude PCB-thickness from the bottom */
  alignmentRectangles?: [Point, Point][]
  /** Rounding around the display */
  displayRounding: number
}

function assertSize(name: string, actual: number, expected: number, dimension: string) {
  if (Math.abs(actual - expected) > 1e-5) {
    throw new Error(`Expected ${dimension} of ${name} to be ${expected}`)
  }
}

export function displaySocket(name: CuttleKey['type'], opts: DisplayProps) {
  const size = socketSize({ type: name } as CuttleKey)
  if ('radius' in size) throw new Error('Expected rectangular size, not circular')
  assertSize(name, size[0], opts.pcbShortSideWidth + 2 * DISP_TOL, 'width')
  assertSize(name, size[1], opts.pcbLongSideWidth + 2 * DISP_TOL, 'height')
  assertSize(name, size[2], opts.displayThickness + opts.pcbThickness, 'thickness')
  let base = makeBaseBox(size[0], size[1], size[2]).translateZ(-size[2])
  base = base.cut(displayModel(name, { ...opts, displayRounding: 0 }, DISP_TOL))

  for (const rectangle of opts.alignmentRectangles || []) {
    const x0 = rectangle[0][0] + (Math.abs(rectangle[0][0]) == opts.pcbShortSideWidth / 2 ? -DISP_TOL : DISP_TOL)
    const x1 = rectangle[1][0] + (Math.abs(rectangle[1][0]) == opts.pcbShortSideWidth / 2 ? DISP_TOL : -DISP_TOL)
    const y0 = rectangle[0][1] + (Math.abs(rectangle[0][1]) == opts.pcbLongSideWidth / 2 ? -DISP_TOL : DISP_TOL)
    const y1 = rectangle[1][1] + (Math.abs(rectangle[1][1]) == opts.pcbLongSideWidth / 2 ? DISP_TOL : -DISP_TOL)
    base = base.fuse(
      makeBaseBox(x1 - x0, y1 - y0, opts.pcbThickness + DISP_TOL).translate(
        (x0 + x1) / 2,
        (y0 + y1) / 2,
        -opts.displayThickness - opts.pcbThickness,
      ),
    )
  }
  return base
}

export function displayModel(_name: CuttleKey['type'], opts: DisplayProps, tol: number) {
  const pcb = drawRoundedRectangle(opts.pcbShortSideWidth + 2 * tol, opts.pcbLongSideWidth + 2 * tol, opts.displayRounding).sketchOnPlane('XY').extrude(opts.pcbThickness + tol)
  let display = makeBaseBox(
    opts.pcbShortSideWidth + 2 * tol - opts.offsetFromLeftLongSide - opts.offsetFromRightLongSide,
    opts.pcbLongSideWidth + 2 * tol - opts.offsetFromBottomShortSide - opts.offsetFromTopShortSide,
    opts.displayThickness,
  )
  display = display
    .translateX(opts.offsetFromLeftLongSide / 2 - opts.offsetFromRightLongSide / 2)
    .translateY(opts.offsetFromBottomShortSide / 2 - opts.offsetFromTopShortSide / 2)

  return (pcb.translateZ(-opts.pcbThickness - opts.displayThickness) as Solid)
    .fuse(display.translateZ(-opts.displayThickness))
}

export function displaySocketAndModel(name: CuttleKey['type'], opts: DisplayProps, partTol: number) {
  const assembly = new Assembly()
  assembly.add('Socket', displaySocket(name, opts))
  assembly.add('Part', displayModel(name, opts, partTol))
  return assembly
}

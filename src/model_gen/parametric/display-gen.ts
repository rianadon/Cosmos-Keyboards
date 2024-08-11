import { socketSize } from '$lib/geometry/socketsParts'
import type { CuttleKey } from '$lib/worker/config'
import { drawRoundedRectangle, makeBaseBox } from 'replicad'

/** Tolerance around PCB + Display on each side */
const DISP_TOL = 0.05

export interface DisplayProps {
  /** Length of the long side of the PCB */
  pcbLongSideWidth: number
  /** Length of the short side of the PCB */
  pcbShortSideWidth: number
  /** How much the display is offset from the long side of the PCB */
  offsetFromLongSide: number
  /** How much the display is offset from the top short side of the PCB. */
  offsetFromTopShortSide: number
  /** How much the display is offset from the bottom short side of the PCB. */
  offsetFromBottomShortSide: number
  /** How thick the display part is (excluding PCB) */
  displayThickness: number
  /** How thick the PCB is */
  pcbThickness: number
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
  const base = makeBaseBox(size[0], size[1], size[2]).translateZ(-size[2])
  return base.cut(displayModel(name, opts, DISP_TOL, 0))
}

export function displayModel(_name: CuttleKey['type'], opts: DisplayProps, tol: number, rounding: number) {
  const pcb = drawRoundedRectangle(opts.pcbShortSideWidth + 2 * tol, opts.pcbLongSideWidth + 2 * tol, rounding).sketchOnPlane('XY').extrude(opts.pcbThickness + tol)
  let display = makeBaseBox(
    opts.pcbShortSideWidth + 2 * tol - 2 * opts.offsetFromLongSide,
    opts.pcbLongSideWidth + 2 * tol - opts.offsetFromBottomShortSide - opts.offsetFromTopShortSide,
    opts.displayThickness,
  )
  display = display.translateY(opts.offsetFromBottomShortSide / 2 - opts.offsetFromTopShortSide / 2)
  return pcb.translateZ(-opts.pcbThickness - opts.displayThickness)
    .fuse(display.translateZ(-opts.displayThickness))
}

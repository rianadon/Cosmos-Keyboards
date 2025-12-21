import { socketSize, variantURL } from '$lib/geometry/socketsParts'
import type { CuttleKey } from '$lib/worker/config'
import { Assembly } from '$lib/worker/modeling/assembly'
import { drawRoundedRectangle, makeBaseBox, Solid } from 'replicad'

/** Tolerance around PCB + Trackpad on each side */
const DISP_TOL = 0.05

const COMPONENT_CUT_RADIUS = 1

type Point = [number, number]
export interface TrackpadProps {
  /** Length of the long side of the PCB */
  trackpadLongSideWidth: number
  /** Length of the short side of the PCB */
  trackpadShortSideWidth: number
  /** How much the trackpad holder is offset from the left long side of the PCB */
  offsetFromLeftLongSide: number
  /** How much the trackpad holder is offset from the right long side of the PCB */
  offsetFromRightLongSide: number
  /** How much the trackpad holder is offset from the top short side of the PCB. */
  offsetFromTopShortSide: number
  /** How much the trackpad holder is offset from the bottom short side of the PCB. */
  offsetFromBottomShortSide: number
  /** How thick the trackpad part is (excluding PCB) */
  trackpadThickness: number
  /** How thick the PCB is */
  pcbThickness: number
  /** Rectangles for PCB alignment that protrude PCB-thickness from the bottom */
  alignmentRectangles?: [Point, Point][]
  /** Rounding around the trackpad */
  trackpadRounding: number
}

function assertSize(name: string, actual: number, expected: number, dimension: string) {
  if (Math.abs(actual - expected) > 1e-5) {
    throw new Error(`Expected ${dimension} of ${name} to be ${expected}`)
  }
}

export function trackpadSocket(name: CuttleKey['type'], variant: Record<string, any>, opts: TrackpadProps) {
  const size = socketSize({ type: name, variant } as CuttleKey)
  const vURL = variantURL({ type: name, variant: variant } as any)
  if ('radiusX' in size) throw new Error('Expected rectangular size, not circular')
  assertSize(name + vURL, size[0], opts.trackpadShortSideWidth + 2 * DISP_TOL, 'width')
  assertSize(name + vURL, size[1], opts.trackpadLongSideWidth + 2 * DISP_TOL, 'height')
  assertSize(name + vURL, size[2], opts.trackpadThickness + opts.pcbThickness, 'thickness')
  let base = makeBaseBox(size[0], size[1], size[2]).translateZ(-size[2])
  base = base.cut(trackpadModel(name, variant, opts, DISP_TOL))

  for (const rectangle of opts.alignmentRectangles || []) {
    const x0 = rectangle[0][0] + (Math.abs(rectangle[0][0]) == opts.trackpadShortSideWidth / 2 ? -DISP_TOL : DISP_TOL)
    const x1 = rectangle[1][0] + (Math.abs(rectangle[1][0]) == opts.trackpadShortSideWidth / 2 ? DISP_TOL : -DISP_TOL)
    const y0 = rectangle[0][1] + (Math.abs(rectangle[0][1]) == opts.trackpadLongSideWidth / 2 ? -DISP_TOL : DISP_TOL)
    const y1 = rectangle[1][1] + (Math.abs(rectangle[1][1]) == opts.trackpadLongSideWidth / 2 ? DISP_TOL : -DISP_TOL)
    base = base.fuse(
      makeBaseBox(x1 - x0, y1 - y0, opts.pcbThickness + DISP_TOL).translate(
        (x0 + x1) / 2,
        (y0 + y1) / 2,
        -opts.trackpadThickness - opts.pcbThickness,
      ),
    )
  }
  return base
}

export function trackpadModel(_name: CuttleKey['type'], variant: Record<string, any>, opts: TrackpadProps, tol: number) {
  const trackpad = drawRoundedRectangle(opts.trackpadShortSideWidth + 2 * tol, opts.trackpadLongSideWidth + 2 * tol, opts.trackpadRounding).sketchOnPlane('XY').extrude(opts.trackpadThickness)

  let componentCutout = drawRoundedRectangle(
    opts.trackpadShortSideWidth + 2 * tol - opts.offsetFromLeftLongSide - opts.offsetFromRightLongSide,
    opts.trackpadLongSideWidth + 2 * tol - opts.offsetFromBottomShortSide - opts.offsetFromTopShortSide,
    COMPONENT_CUT_RADIUS,
  ).sketchOnPlane('XY').extrude(opts.pcbThickness + tol)

  componentCutout = componentCutout
    .translateX(opts.offsetFromLeftLongSide / 2 - opts.offsetFromRightLongSide / 2)
    .translateY(opts.offsetFromBottomShortSide / 2 - opts.offsetFromTopShortSide / 2)

  return (trackpad.translateZ(-opts.trackpadThickness) as Solid)
    .fuse(componentCutout.translateZ(-opts.pcbThickness - opts.trackpadThickness) as Solid)
}

export function trackpadSocketAndModel(name: CuttleKey['type'], variant: Record<string, any>, opts: TrackpadProps, partTol: number) {
  const assembly = new Assembly()
  assembly.add('Socket', trackpadSocket(name, variant, opts))
  assembly.add('Part', trackpadModel(name, variant, opts, partTol))
  return assembly
}

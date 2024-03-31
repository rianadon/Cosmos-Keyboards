import { combine } from '$lib/worker/modeling/index'
import Trsf from '$lib/worker/modeling/transformation'
import { draw, drawCircle, drawRoundedRectangle, makeSphere, Solid } from 'replicad'

const PMW_LENS_HEIGHT = 3.4 // Height of PMW sensor lens

const JOE_SENSOR_HOLE_SPACING = 24.5 // Distance between the two holes on the sensor
const JOE_SENSOR_TAP_HOLE_DIAM = 2.05 // For M2.5 screw
const JOE_SENSOR_CLEAR_HOLE_DIAM = 3 // For M2.5 screw
const JOE_SENSOR_LENS_WIDTH = 21 // Width of lense on sensor

const DEFAULT_OPTS = {
  /** Trackball diameter */
  diameter: 34,
  /** Space between the trackball and the walls */
  spaceAroundBall: 1,
  /** Wall thickness of the socket */
  thickness: 3,
  /** How far the sensor is from the trackball */
  sensorDistance: 0.9,

  sensor: 'joe' as 'joe',
  bearings: 'ball' as 'roller' | 'ball',

  /** Angle from horizontal at which bearings are placed (~phi in polar coordinates) */
  bearingPhi: 13,
  /** Angles at which bearings are placed about the Z axis (~theta in polar coodinates) */
  bearingThetas: [90, 210, 330],
}

export type TrackballOptions = typeof DEFAULT_OPTS

/** Returns some useful geometric info on the trackball */
function trackballGeometry(opts: TrackballOptions) {
  const { diameter, spaceAroundBall, thickness, sensorDistance } = opts

  const r = diameter / 2 // Trackball radius
  const innerR = r + spaceAroundBall // Inner radius of the socket
  const outerR = r + spaceAroundBall + thickness // Outer radiius of the socket (includes wall)
  // Because of the sensor, the trackball's bottom is not a full arc. It instead stops at some (x,y) postion,
  // makes a horizontal line across, then resumes its arc.
  // (innerArcEndX, innerArcEndY) are the position at which the inner arc stops for the sensor cutout
  // (outerArcEndX, outerArcEndY) are the position at which the outer arc stops for the sensor cutout
  const outerArcEndY = -r - sensorDistance
  const innerArcEndY = -r - sensorDistance + 0.3
  const outerArcEndX = Math.sqrt(outerR * outerR - outerArcEndY ** 2)
  const innerArcEndX = Math.sqrt(innerR * innerR - innerArcEndY ** 2)
  return { r, innerR, outerR, outerArcEndX, outerArcEndY, innerArcEndX, innerArcEndY }
}

/** Returns the transformations to put the bearings (roller or ball bearings) into place. */
function bearingTrsfs(opts: TrackballOptions) {
  return opts.bearingThetas.map(angle =>
    new Trsf()
      .translate(-trackballGeometry(opts).r, 0, 0)
      .rotate(-opts.bearingPhi, [0, 0, 0], [0, 1, 0])
      .rotate(angle)
  )
}

export function trackballSocket(opt: Partial<TrackballOptions>): Solid {
  const opts = { ...DEFAULT_OPTS, ...opt }
  const webThickness = 4 // Height of web to be drawn around the part

  const { innerR, outerR, outerArcEndX, outerArcEndY, innerArcEndX, innerArcEndY } = trackballGeometry(opts)

  // For ease of coding the origin is kept to the center of the trackball
  // Until the very end when it's shifted down
  let socket = draw()
    .movePointerTo([innerR, webThickness])
    .hLineTo(outerR)
    .vLineTo(0)
    .ellipseTo([outerArcEndX, outerArcEndY], outerR, outerR)
    .hLineTo(innerArcEndX)
    .vLineTo(innerArcEndY)
    .ellipseTo([innerR, 0], innerR, innerR, 0, false, true)
    .close()
    .sketchOnPlane('XZ')
    .revolve() as Solid

  if (opts.bearings == 'roller') socket = addRollerBearings(socket, opts)
  if (opts.bearings == 'ball') socket = addBallBearings(socket, opts)

  if (opts.sensor == 'joe') socket = addJoesSensor(socket, opts)

  return socket.translateZ(-webThickness)
}

function addBallBearings(socket: Solid, opts: TrackballOptions) {
  const ballR = 1.585 // 1/8 inch outer diameter ball bearings
  const ballClearance = 0.2 // Space to add around the ball
  const cylinderThickness = 2 // Thickness of cylinder to add around the ball
  const cylinderAboveBall = 1 // How far above the center of the ball the cylinder should extend

  // A cylinder with a sphere on top
  const halfCapsule = (r: number, h: number) =>
    draw()
      .movePointerTo([0, -r])
      .hLineTo(-h)
      .ellipseTo([-h - r, 0], r, r)
      .lineTo([0, 0])
      .close()
      .sketchOnPlane('XZ')
      .revolve([1, 0, 0]) as Solid
  const ringCylinder = (r: number, r1: number, r2: number, h: number) =>
    draw()
      .movePointerTo([0, -r1])
      .hLineTo(-h)
      .vLineTo(-r)
      .lineTo([0, -r])
      .close()
      .sketchOnPlane('XZ')
      .revolve([1, 0, 0]) as Solid

  const inner = halfCapsule(ballR + ballClearance, ballR)
  const outer = ringCylinder(ballR + ballClearance + 1e-3, ballR + ballClearance + cylinderThickness, ballR + ballClearance + 0.5, cylinderAboveBall)
    .translateX(-ballR + cylinderAboveBall)

  // return combine(bearingTrsfs(opts).map(t => t.transform(outer).cut(t.transform(inner))))
  return bearingTrsfs(opts).reduce((socket, t) => (socket
    .cut(t.transform(inner))
    .fuse(t.transform(outer))), socket)
}

/** Add roller bearings (a 2.5 x 6mm OD wheel attached to a 8mm x 3mm OD rod) to the socket. */
function addRollerBearings(socket: Solid, opts: TrackballOptions) {
  const { r, innerR } = trackballGeometry(opts)

  const dowelR = 1.5 // Dowel radius
  const dowelVClearance = 0.05 // Space to add around dowel's circumference
  const dowelHClearance = 0.2 // Space to add around dowel length-wise
  const dowelLength = 8 // Length of the dowel
  const dowelHolderThick = 0.8 // Thickness of the dowel holder

  const wheelR = 3 // Bearing wheel outer radius
  const wheelVClearance = 0.5 // Clearance around the bearing's circumerence
  const wheelHClearance = 0.2 // Clearance around the bearing, length-wise
  const wheelHolderThick = 0.8 // Thickness of the bearing holder
  const wheelLength = 2.5 // Length of the wheel

  // Generates a holder for the bearing or the dowel
  const holder = (start: number, radius: number, length: number) =>
    draw()
      .movePointerTo([start, 0])
      .lineTo([start, -radius])
      .hLineTo(-wheelR)
      .ellipseTo([-wheelR - radius, 0], radius, radius)
      .closeWithMirror()
      .sketchOnPlane('XZ')
      .extrude(length)
      .translateY(length / 2) as Solid

  const dowelHolderInner = holder(0, dowelR + dowelVClearance, dowelLength + dowelHClearance * 2)
  const dowelOuterR = dowelR + dowelVClearance + dowelHolderThick
  if (wheelR < innerR - r) throw new Error('bearing is too close to center')
  const dowelHolderOuter = holder(-innerR + r, dowelOuterR, dowelLength + dowelHClearance * 2 + dowelHolderThick * 2)

  const bearingHolderInner = holder(0, wheelR + wheelVClearance, wheelLength + wheelHClearance * 2)
  const bearingHolderOuter = holder(-innerR + r, wheelR + wheelVClearance + wheelHolderThick, wheelLength + wheelHClearance * 2 + wheelHolderThick * 2)

  const inners = dowelHolderInner.fuse(bearingHolderInner)
  const outers = dowelHolderOuter.fuse(bearingHolderOuter)

  return bearingTrsfs(opts).reduce((socket, t) => (socket
    .fuse(t.transform(outers))
    .cut(t.transform(inners))), socket)
}

/** Add sensor mount for the PMW Sensor PCB designed by Joe's Sensors. */
function addJoesSensor(socket: Solid, opts: TrackballOptions) {
  const { innerR, outerR, outerArcEndY } = trackballGeometry(opts)

  const sensorCylinderWidth = 4
  const sensorClearance = 0.5 // Space around sensor lens
  const bottomWidth = JOE_SENSOR_LENS_WIDTH + sensorClearance * 2 + sensorCylinderWidth * 2
  // Bottom plate to hold sensor in place
  let bottom = drawRoundedRectangle(bottomWidth, 21, 8).sketchOnPlane('XY').extrude(outerArcEndY) as Solid
  // Post with screwhole for sensor
  const cylinder = drawRoundedRectangle(sensorCylinderWidth, 10, 1.6)
    .translate(JOE_SENSOR_LENS_WIDTH / 2 + sensorCylinderWidth / 2 + sensorClearance, 0)
    .cut(drawCircle(JOE_SENSOR_CLEAR_HOLE_DIAM / 2).translate(JOE_SENSOR_HOLE_SPACING / 2, 0))
    .sketchOnPlane('XY').extrude(-PMW_LENS_HEIGHT) as Solid
  const holeInnerIntersectY = -Math.sqrt(innerR * innerR - (JOE_SENSOR_HOLE_SPACING / 2) ** 2) - 0.1
  const hole = draw().movePointerTo([0, holeInnerIntersectY])
    .line(-JOE_SENSOR_TAP_HOLE_DIAM / 2, -JOE_SENSOR_TAP_HOLE_DIAM)
    .vLineTo(outerArcEndY - PMW_LENS_HEIGHT)
    .hLineTo(0).close().sketchOnPlane('XZ').revolve() as Solid
  bottom = bottom.cut(makeSphere(innerR * 0.1 + outerR * 0.9))
  bottom = bottom.fuse(new Trsf().translate(0, 0, outerArcEndY).transform(cylinder))
  bottom = bottom.fuse(new Trsf().translate(0, 0, outerArcEndY).mirror([1, 0, 0]).transform(cylinder))

  return socket.fuse(bottom)
    .cut(new Trsf().translate(JOE_SENSOR_HOLE_SPACING / 2, 0, 0).transform(hole))
    .cut(new Trsf().translate(-JOE_SENSOR_HOLE_SPACING / 2, 0, 0).transform(hole))
}

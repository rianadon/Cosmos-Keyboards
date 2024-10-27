import { SCREWS } from '$lib/geometry/screws'
import { combine } from '$lib/worker/modeling/index'
import Trsf from '$lib/worker/modeling/transformation'
import { draw, drawCircle, drawEllipse, drawRoundedRectangle, makeSphere, type SketchInterface, Solid } from 'replicad'

const PMW_LENS_HEIGHT = 3.4 // Height of PMW sensor lens

const JOE_SENSOR_HOLE_SPACING = 24.5 // Distance between the two holes on the sensor
const JOE_SENSOR_TAP_HOLE_DIAM = 2.05 // For M2.5 screw
const JOE_SENSOR_CLEAR_HOLE_DIAM = 3 // For M2.5 screw
const JOE_SENSOR_LENS_WIDTH = 21 // Width of lense on sensor

const BKB_SENSOR_HOLE_SPACING = 37 // Distance between two mounting holes
const BKB_SENSOR_INSERT_DIAMETER = SCREWS.M3.mounting['screw insert'].diameter
const BKB_SENSOR_INSERT_HEIGHT = 6.5

const SKREE610_SENSOR_HOLE_X = 12.75
const SKREE610_SENSOR_HOLE_Y = 8.75
const SKREE610_SENSOR_INSERT_DIAMETER = SCREWS.M3.mounting['screw insert'].diameter - 0.8
const SKREE610_SENSOR_INSERT_HEIGHT = BKB_SENSOR_INSERT_HEIGHT

const DEFAULT_OPTS = {
  /** Trackball diameter */
  diameter: 34,
  /** Space between the trackball and the walls */
  spaceAroundBall: 1,
  /** Wall thickness of the socket */
  thickness: 3,
  /** How far the sensor is from the trackball. Must be between 2.2 and 2.6 to meet pmw3360 specs */
  sensorDistance: 2.2,
  /** How much material to add for sensor alignment */
  sensorAlignHeight: 1,

  sensor: 'Joe (QMK)' as 'Joe (QMK)' | 'Bastardkb' | 'Skree (ZMK)',
  bearings: 'Ball' as 'Roller' | 'Ball' | 'BTU (9mm)' | 'BTU (7.5mm)',

  /** Angle from horizontal at which bearings are placed (~phi in polar coordinates) */
  bearingPhi: 13,
  /** Angles at which bearings are placed about the Z axis (~theta in polar coodinates) */
  bearingThetas: [90, 210, 330],

  /** Radius of the ball for ball bearings */
  ballBearingRadius: 1.585, // 1/8 inch outer diameter ball bearings
}

interface BTUProps {
  /** Diameter of the BTU */
  btuDiameter: number
  /** Total height of the BTU, including the ball */
  btuTotalHeight: number
  /** Diameter of the lip (widest part of the BTU) */
  btuLipDiameter: number
  /** Thickness of the lip */
  btuLipThickness: number
  /** Height up to the bottom of the lip */
  btuHeightToLip: number
  /** Diameter of the ball in the BTU */
  ballDiameter: number
}

const BTU_PROPS = {
  '9mm': {
    btuDiameter: 9,
    btuTotalHeight: 7.15,
    btuLipDiameter: 11,
    btuLipThickness: 1,
    btuHeightToLip: 5,
    ballDiameter: 4.5,
  },
  '7.5mm': {
    btuDiameter: 7.5,
    btuTotalHeight: 6.05,
    btuLipDiameter: 9,
    btuLipThickness: 1,
    btuHeightToLip: 4,
    ballDiameter: 3.5,
  },
} satisfies Record<string, BTUProps>

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
  const sensorY = -r - sensorDistance
  const outerArcEndY = Math.max(sensorY, -outerR + 1e-3)
  const innerArcEndY = Math.max(sensorY + 0.3, -innerR + 1e-3)
  const outerArcEndX = Math.sqrt(outerR * outerR - outerArcEndY ** 2)
  const innerArcEndX = Math.sqrt(innerR * innerR - innerArcEndY ** 2)
  return { r, innerR, outerR, outerArcEndX, outerArcEndY, innerArcEndX, innerArcEndY, sensorY }
}

/**
 * Returns the transformations to put the bearings (roller or ball bearings) into place.
 * The origin of the workspace is placed at the diameter of the ball,
 * and the x axis is aligned to be normal to the trackball.
 *
 * Therefore, make sure to place the edge of ball or roller or whatever is touching
 * the trackball at X=0.
 */
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

  if (opts.sensor == 'Joe (QMK)') socket = addJoesSensor(socket, opts)
  if (opts.sensor == 'Bastardkb') socket = addBkbSensor(socket, opts)
  if (opts.sensor == 'Skree (ZMK)') socket = addSkree610Sensor(socket, opts)
  socket = cutoutPMW(socket, opts)

  if (opts.bearings == 'Roller') socket = addRollerBearings(socket, opts)
  if (opts.bearings == 'Ball') socket = addBallBearings(socket, opts)
  if (opts.bearings == 'BTU (7.5mm)') socket = addBtuBearings(socket, opts, '7.5mm')
  if (opts.bearings == 'BTU (9mm)') socket = addBtuBearings(socket, opts, '9mm')

  return socket.translateZ(-webThickness)
}

export function trackballPart(opt: Partial<TrackballOptions>): Solid {
  const opts = { ...DEFAULT_OPTS, ...opt }
  const webThickness = 4 // Height of web to be drawn around the part

  let model = makeSphere(opts.diameter / 2)
  if (opts.bearings == 'BTU (7.5mm)') model = combine([model, btuModel(opts, '7.5mm')])
  if (opts.bearings == 'BTU (9mm)') model = combine([model, btuModel(opts, '9mm')])

  return model.translateZ(-webThickness)
}

function addBallBearings(socket: Solid, opts: TrackballOptions) {
  const ballR = opts.ballBearingRadius
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

// Add Ball Transfer Unit (BTU) bearings
function addBtuBearings(socket: Solid, opts: TrackballOptions, diameter: keyof typeof BTU_PROPS) {
  const btuOpts = BTU_PROPS[diameter]
  const btuClearance = 0.1 // Space to add around BTU on all sides

  // The BTU is extruded from X=0 (touching the trackball).
  const cylinder = drawCircle((btuOpts.btuDiameter / 2) + btuClearance)
    .sketchOnPlane('YZ')
    .extrude(-btuOpts.btuTotalHeight - btuClearance) as Solid

  const lip = drawCircle((btuOpts.btuLipDiameter / 2) + btuClearance)
    .sketchOnPlane('YZ')
    .extrude(-btuOpts.btuTotalHeight + btuOpts.btuHeightToLip - btuClearance) as Solid

  const btu = cylinder.fuse(lip)
  return bearingTrsfs(opts).reduce((socket, t) => (socket.cut(t.transform(btu))), socket)
}

export function btuModel(opts: TrackballOptions, diameter: keyof typeof BTU_PROPS) {
  const btuOpts = BTU_PROPS[diameter]

  const ball = makeSphere(btuOpts.ballDiameter / 2).translateX(-btuOpts.ballDiameter / 2)
  const lip = drawCircle(btuOpts.btuLipDiameter / 2)
    .sketchOnPlane('YZ')
    .extrude(btuOpts.btuLipThickness)
    .translateX(btuOpts.btuHeightToLip - btuOpts.btuTotalHeight) as Solid
  const cylinder = drawCircle(btuOpts.btuDiameter / 2)
    .sketchOnPlane('YZ')
    .extrude(btuOpts.btuHeightToLip + btuOpts.btuLipThickness)
    .translateX(-btuOpts.btuTotalHeight) as Solid

  const btu = combine([ball, cylinder.fuse(lip)])
  // const btu = cylinder.fuse(lip)
  return combine(bearingTrsfs(opts).map(t => t.transform(btu)))
}

/** Cut out alignment area and opening for PMW sensor */
function cutoutPMW(socket: Solid, opts: TrackballOptions) {
  const { innerR, outerR, sensorY } = trackballGeometry(opts)
  const { sensorAlignHeight } = opts
  const TOLERANCE = 0.1

  // Cut out jig used to align sensor
  if (sensorAlignHeight) {
    const lensCutout = opts.sensor == 'Skree (ZMK)'
      ? drawRoundedRectangle(7.6 * 2, 8.3, 1.2) // PMW3610 with LM18-LSI SFF lens
      : drawRoundedRectangle(10.97 * 2, 19, 7.05) // PMW3360 and PMW3389

    const alignment = lensCutout.offset(TOLERANCE)
      .sketchOnPlane('XY', sensorY).extrude(-sensorAlignHeight) as Solid
    socket = socket.cut(alignment)
  }

  const chamferY = 2
  const chamferX = chamferY / Math.tan(68.5 * Math.PI / 180)

  // To prevent opencascade bugs, sensor cutout is flared from 2mm downwards instead of all the way
  const openingMin = drawRoundedRectangle(8, 4.5).sketchOnPlane('XY', sensorY).extrude(2 * opts.sensorDistance) as Solid

  // Taken from the datasheet, but doubled so that the pcb can be inserted in either orientation.
  const opening = (drawRoundedRectangle(8, 4.5).sketchOnPlane('XY', chamferY) as SketchInterface)
    .loftWith(drawRoundedRectangle(8 + chamferX * 2, 4.5 + chamferX * 2).sketchOnPlane('XY') as SketchInterface, {})
    .translateZ(sensorY) as Solid

  return socket.cut(openingMin.fuse(opening))
}

/** Add sensor mount for the PMW Sensor PCB designed by Joe's Sensors. */
function addJoesSensor(socket: Solid, opts: TrackballOptions) {
  const { innerR, outerR, sensorY } = trackballGeometry(opts)
  const { sensorAlignHeight } = opts

  const sensorCylinderWidth = 4
  const sensorClearance = 0.5 // Space around sensor lens
  const bottomWidth = JOE_SENSOR_LENS_WIDTH + sensorClearance * 2 + sensorCylinderWidth * 2
  // Bottom plate to hold sensor in place
  let bottom = drawRoundedRectangle(bottomWidth, 22, 8).sketchOnPlane('XY').extrude(sensorY - sensorAlignHeight + 0.1) as Solid
  // Post with screwhole for sensor
  const cylinder = drawRoundedRectangle(sensorCylinderWidth, 10, 1.6)
    .translate(JOE_SENSOR_LENS_WIDTH / 2 + sensorCylinderWidth / 2 + sensorClearance, 0)
    .cut(drawCircle(JOE_SENSOR_CLEAR_HOLE_DIAM / 2).translate(JOE_SENSOR_HOLE_SPACING / 2, 0))
    .sketchOnPlane('XY').extrude(-PMW_LENS_HEIGHT) as Solid
  const holeInnerIntersectY = -Math.sqrt(innerR * innerR - (JOE_SENSOR_HOLE_SPACING / 2) ** 2) - 0.1
  const hole = draw().movePointerTo([0, holeInnerIntersectY])
    .line(-JOE_SENSOR_TAP_HOLE_DIAM / 2, -JOE_SENSOR_TAP_HOLE_DIAM)
    .vLineTo(sensorY - PMW_LENS_HEIGHT)
    .hLineTo(0).close().sketchOnPlane('XZ').revolve() as Solid
  bottom = bottom.cut(makeSphere(innerR * 0.1 + outerR * 0.9))
  bottom = bottom.fuse(new Trsf().translate(0, 0, sensorY).transform(cylinder))
  bottom = bottom.fuse(new Trsf().translate(0, 0, sensorY).mirror([1, 0, 0]).transform(cylinder))

  return socket.fuse(bottom)
    .cut(new Trsf().translate(JOE_SENSOR_HOLE_SPACING / 2, 0, 0).transform(hole))
    .cut(new Trsf().translate(-JOE_SENSOR_HOLE_SPACING / 2, 0, 0).transform(hole))
}

/** Add sensor mount for BastardKB's PMW shield */
function addBkbSensor(socket: Solid, opts: TrackballOptions) {
  const { innerR, outerR, sensorY } = trackballGeometry(opts)
  const { sensorAlignHeight } = opts

  // Bottom plate to hold sensor in place
  let bottom = drawEllipse(21, 20).sketchOnPlane('XY').extrude(sensorY - sensorAlignHeight + 0.1) as Solid as Solid
  // Post with screwhole for sensor
  const insertHolderRadius = Math.max(21 - BKB_SENSOR_HOLE_SPACING / 2, BKB_SENSOR_INSERT_DIAMETER / 2 + 2)
  const cylinder = draw().line(insertHolderRadius, sensorY)
    .vLineTo(sensorY - PMW_LENS_HEIGHT).hLineTo(0).close()
    .sketchOnPlane('XZ').revolve() as Solid
  // Screw insert hole
  const hole = drawCircle(BKB_SENSOR_INSERT_DIAMETER / 2)
    .sketchOnPlane('XY', sensorY).extrude(-BKB_SENSOR_INSERT_HEIGHT) as Solid

  bottom = bottom.fuse(new Trsf().translate(BKB_SENSOR_HOLE_SPACING / 2, 0, 0).transform(cylinder))
  bottom = bottom.fuse(new Trsf().translate(-BKB_SENSOR_HOLE_SPACING / 2, 0, 0).transform(cylinder))
  bottom = bottom.cut(makeSphere(innerR * 0.1 + outerR * 0.9))

  return socket.fuse(bottom)
    .cut(new Trsf().translate(BKB_SENSOR_HOLE_SPACING / 2, 0, 0).transform(hole))
    .cut(new Trsf().translate(-BKB_SENSOR_HOLE_SPACING / 2, 0, 0).transform(hole))
}

/** Add sensor mount for the PMW Sensor PCB designed by Joe's Sensors. */
function addSkree610Sensor(socket: Solid, opts: TrackballOptions) {
  const { innerR, outerR, sensorY, outerArcEndX, outerArcEndY } = trackballGeometry(opts)
  const { sensorAlignHeight } = opts

  let socketOuter = draw()
    .hLineTo(outerR)
    .ellipseTo([outerArcEndX, outerArcEndY], outerR, outerR)
    .hLineTo(0)
    .close()
    .sketchOnPlane('XZ')
    .revolve() as Solid

  // Post with screwhole for sensor
  const insertHolderRadius = SKREE610_SENSOR_INSERT_DIAMETER / 2 + 2
  const cylinder = draw().line(insertHolderRadius, sensorY)
    .vLineTo(sensorY - PMW_LENS_HEIGHT).hLineTo(0).close()
    .sketchOnPlane('XZ').revolve() as Solid

  let bottom = drawRoundedRectangle(32, 24, 2.5).sketchOnPlane('XY').extrude(sensorY - sensorAlignHeight + 0.1) as Solid
  // Tapped screw hole
  // const holeInnerIntersectY = -Math.sqrt(innerR * innerR - SKREE610_SENSOR_HOLE_X ** 2 - SKREE610_SENSOR_HOLE_Y ** 2) - 0.1
  // const hole = draw().movePointerTo([0, holeInnerIntersectY])
  //   .line(-JOE_SENSOR_TAP_HOLE_DIAM / 2, -JOE_SENSOR_TAP_HOLE_DIAM)
  //   .vLineTo(sensorY - PMW_LENS_HEIGHT)
  //   .hLineTo(0).close().sketchOnPlane('XZ').revolve() as Solid
  const hole = drawCircle(SKREE610_SENSOR_INSERT_DIAMETER / 2)
    .sketchOnPlane('XY', sensorY - PMW_LENS_HEIGHT).extrude(SKREE610_SENSOR_INSERT_HEIGHT) as Solid

  bottom = bottom.fuse(new Trsf().translate(SKREE610_SENSOR_HOLE_X, SKREE610_SENSOR_HOLE_Y, 0).transform(cylinder))
  bottom = bottom.fuse(new Trsf().translate(SKREE610_SENSOR_HOLE_X, -SKREE610_SENSOR_HOLE_Y, 0).transform(cylinder))
  bottom = bottom.fuse(new Trsf().translate(-SKREE610_SENSOR_HOLE_X, SKREE610_SENSOR_HOLE_Y, 0).transform(cylinder))
  bottom = bottom.fuse(new Trsf().translate(-SKREE610_SENSOR_HOLE_X, -SKREE610_SENSOR_HOLE_Y, 0).transform(cylinder))
  bottom = bottom.cut(socketOuter)

  return socket.fuse(bottom)
    .cut(new Trsf().translate(SKREE610_SENSOR_HOLE_X, SKREE610_SENSOR_HOLE_Y, 0).transform(hole))
    .cut(new Trsf().translate(SKREE610_SENSOR_HOLE_X, -SKREE610_SENSOR_HOLE_Y, 0).transform(hole))
    .cut(new Trsf().translate(-SKREE610_SENSOR_HOLE_X, SKREE610_SENSOR_HOLE_Y, 0).transform(hole))
    .cut(new Trsf().translate(-SKREE610_SENSOR_HOLE_X, -SKREE610_SENSOR_HOLE_Y, 0).transform(hole))
}

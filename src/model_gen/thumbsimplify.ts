/** Thumbs from the original models are configured such that each key is
 * positioned independently. This makes mudifying the thumb config difficult.
 *
 * Ideally, all thumbs are defined off a single plane. To do this, I compute
 * the best fit plane intersecting the thumb keys. Then redefine the thumbs
 * in terms of that plane...
 */

import cuttleform from '$assets/cuttleform.json' assert { type: 'json' }
import type { CuttleformProto, CuttleKey } from '$lib/worker/config'
import Trsf from '$lib/worker/modeling/transformation'
import { Vector } from '$lib/worker/modeling/transformation'
import { Matrix, SingularValueDecomposition, solve } from 'ml-matrix'
import { Cuttleform_DefaultThumb_KEY_COUNT } from '../../target/proto/cuttleform'
// import { type Plot, plot } from 'nodeplotlib';
import ETrsf, { Constant } from '$lib/worker/modeling/transformation-ext'
import { Matrix3, Matrix4, Quaternion } from 'three'

const CUTTLEFORM = cuttleform.options

type Point = [number, number, number]
const CENTER: Point = [0, 0, 0]
const X: Point = [1, 0, 0]
const Y: Point = [0, 1, 0]
const Z: Point = [0, 0, 1]

function matrixToRPY(R: Matrix): [number, number, number] {
  const Z_rot = Math.atan2(R.get(1, 0), R.get(0, 0))
  const Y_rot = Math.atan2(-R.get(2, 0), Math.sqrt(Math.pow(R.get(2, 1), 2) + Math.pow(R.get(2, 2), 2)))
  const X_rot = Math.atan2(R.get(2, 1), R.get(2, 2))
  return [X_rot * 180 / Math.PI, Y_rot * 180 / Math.PI, Z_rot * 180 / Math.PI]
}

function trsfToRPY(R: Trsf): [number, number, number] {
  const e = R.wrapped.elements
  const Z_rot = Math.atan2(e[1], e[0])
  const Y_rot = Math.atan2(-e[2], Math.sqrt(Math.pow(e[6], 2) + Math.pow(e[10], 2)))
  const X_rot = Math.atan2(e[6], e[10])
  return [X_rot * 180 / Math.PI, Y_rot * 180 / Math.PI, Z_rot * 180 / Math.PI]
}

function RPYtoETrsf(x: number, y: number, z: number, name?: string) {
  const t = name ? new Constant(name) : new ETrsf()
  if (x != 0) t.rotate(x, [0, 0, 0], [1, 0, 0])
  if (y != 0) t.rotate(y, [0, 0, 0], [0, 1, 0])
  if (z != 0) t.rotate(z, [0, 0, 0], [0, 0, 1])
  return t
}

function TrsftoString(t: ETrsf, extra: string[] = []) {
  // return 'new Trsf()\n' + [...t.history, ...extra].map(h => '      .' + h).join('\n')
  return t.toString(0)
}

const GRID_W = 20
const GRID_H = 18.5

function main(th: CuttleKey[], filter = (k: CuttleKey) => true, flatten = false) {
  // Create a matrix for the filtered positions (to be used in plane fitting)
  // and all positions (to be used in calculating the new thumb positions)
  const P = new Matrix(th.filter(filter).map(f => f.position.evaluate({ flat: false }, new Trsf()).xyz()))
  const PAll = new Matrix(th.map(f => f.position.evaluate({ flat: false }, new Trsf()).xyz()))
  // Create a matrix of all the x axes. Used for aligning the plane
  const X = new Matrix(th.filter(filter).map(f => f.position.evaluate({ flat: false }, new Trsf()).axis(1, 0, 0).xyz()))

  const center = P.mean('column') as [number, number, number]
  P.subRowVector(center)
  PAll.subRowVector(center)

  const { diagonal, rightSingularVectors } = new SingularValueDecomposition(P)
  console.log('Average error', diagonal[2])

  const VSpaceX = X.mmul(rightSingularVectors)
  const [rx, ry] = VSpaceX.mean('column')
  const correction = Math.atan2(ry, rx) * 180 / Math.PI // - 90
  console.log('Rotational correction', correction)

  console.log(matrixToRPY(rightSingularVectors))
  let R = new ETrsf().rotate(180, [0, 0, 0], [1, 0, 0]).rotate(correction).transformBy(RPYtoETrsf(...matrixToRPY(rightSingularVectors)))
  R = RPYtoETrsf(...trsfToRPY(R.evaluate({ flat: false }, new Trsf()) as Trsf), 'THUMB_PLANE').translate(center)

  const Rinv = (R.evaluate({ flat: false }, new Trsf()) as Trsf).invert()

  // const R = RPYtoTrsf(...matrixToRPY(rightSingularVectors)).translate(center)
  console.log(`const THUMB_PLANE = ` + TrsftoString(R))
  // console.log(new Matrix4().extractRotation

  // const VSpace = PAll.mmul(rightSingularVectors)
  // if (flatten) VSpace.setColumn(2, new Array(th.length).fill(0))
  function mergeThumbCurvature(opts: any) {
    const base = {
      curvatureOfRow: 0,
      curvatureOfColumn: 0,
      spacingInRow: 2.5,
      spacingInColumn: 2.5,
    }
    return {
      merged: { ...base, ...opts },
      unmerged: opts,
      name: 'thumbCurvature',
    } as any
  }

  for (let i = 0; i < th.length; i++) {
    const relativeTrsf = th[i].position.evaluate({ flat: false }, new Trsf()).preMultiplied(Rinv) as Trsf
    const transform = relativeTrsf.xyz()
    let rotation = trsfToRPY(relativeTrsf)
    if (flatten) {
      transform[2] = 0
      rotation = [0, 0, 0]

      const offset = new ETrsf().placeOnMatrix(mergeThumbCurvature({
        row: -Math.round(transform[1] * 50) / 1000,
        column: Math.round(transform[0] * 50) / 1000,
      })).transformBy(R)
      console.log(offset.toString(2))
    } else {
      const offset = TrsftoString(RPYtoETrsf(...rotation).translate(transform).transformBy(R))
      console.log(offset)
    }
    // console.log(matrixToRPY(relativeRotation))
    // console.log(th[i].offset.xyz(), rightSingularVectors.mmul(VSpace.getRowVector(i).transpose()).addColumnVector(center))
  }

  // const reprojected = US.mmul(rightSingularVectors.transpose())
  // const error = P.clone().subtract(reprojected)
  // console.log(P.clone().subtract(reprojected).norm("frobenius"))

  // const Mesh = new Matrix([...new Array(10).keys()].flatMap(i => [...new Array(10).keys()].flatMap(j => [
  //     [i*10-50, j*10-50, 0],
  //     [(i+1)*10-50, j*10-50, 0],
  //     [(i+1)*10-50, (j+1)*10-50, 0],
  //     [i*10-50, (j+1)*10-50, 0]
  // ])))
  // const Plane = rightSingularVectors.mmul(Mesh.transpose())

  // const data: Plot[] = [
  //     {
  //     x: P.getColumnVector(0).to1DArray(),
  //     y: P.getColumnVector(1).to1DArray(),
  //     z: P.getColumnVector(2).to1DArray(),
  //     mode: 'markers',
  //     type: 'scatter3d',
  //     },
  //     {
  //         x: Plane.getRowVector(0).to1DArray(),
  //         y: Plane.getRowVector(1).to1DArray(),
  //         z: Plane.getRowVector(2).to1DArray(),
  //         mode: 'lines',
  //         type: 'scatter3d'
  //     }
  // ];

  // plot(data);
}

// main({
//     ...CUTTLEFORM,
//     thumbCluster: {
//         oneofKind: 'defaultThumb',
//         defaultThumb: {
//             thumbCount: Cuttleform_DefaultThumb_KEY_COUNT.SIX
//         }
//     }
// })

// main({
//     ...CUTTLEFORM,
//     thumbCluster: {
//         oneofKind: 'orbylThumb',
//         orbylThumb: {}
//     }
// }, k => k.type !== 'trackball')

type KeyType = CuttleKey['type']
type CapType = Required<CuttleKey>['keycap']['profile']

function carbonfetThumbs(keyType: KeyType, capType: CapType): CuttleKey[] {
  const thumbBase = {
    type: keyType,
    keycap: {
      profile: capType,
      row: 5,
    },
  }

  return [{
    ...thumbBase,
    aspect: 1,
    position: new ETrsf().rotate(10, CENTER, X)
      .rotate(-24, CENTER, Y)
      .rotate(10, CENTER, Z)
      .translate(-13, -9.8, 4),
  }, {
    ...thumbBase,
    aspect: 1,
    position: new ETrsf().rotate(6, CENTER, X)
      .rotate(-25, CENTER, Y)
      .rotate(10, CENTER, Z)
      .translate(-7.5, -29.5, 0),
  }, {
    ...thumbBase,
    aspect: 1 / 1.5,
    position: new ETrsf().rotate(8, CENTER, X)
      .rotate(-31, CENTER, Y)
      .rotate(14, CENTER, Z)
      .translate(-30.5, -17, -6),
  }, {
    ...thumbBase,
    aspect: 1,
    position: new ETrsf().rotate(4, CENTER, X)
      .rotate(-31, CENTER, Y)
      .rotate(14, CENTER, Z)
      .translate(-22.2, -41, -10.3),
  }, {
    ...thumbBase,
    aspect: 1 / 1.5,
    position: new ETrsf().rotate(6, CENTER, X)
      .rotate(-37, CENTER, Y)
      .rotate(18, CENTER, Z)
      .translate(-47, -23, -19),
  }, {
    ...thumbBase,
    aspect: 1,
    position: new ETrsf().rotate(2, CENTER, X)
      .rotate(-37, CENTER, Y)
      .rotate(18, CENTER, Z)
      .translate(-37, -46.4, -22),
  }]
}

const manuformShaping = {
  'stagger': true,
  'customThumbCluster': false,
  'staggerIndexY': 0.0,
  'staggerIndexZ': 0.0,
  'staggerMiddleY': 2.8,
  'staggerMiddleZ': -6.5,
  'staggerPinkyY': -13.0,
  'staggerPinkyZ': 6.0,
  'staggerRingY': 0.0,
  'staggerRingZ': 0.0,
  'thumbClusterOffsetX': 6.0,
  'thumbClusterOffsetY': -3,
  'thumbClusterOffsetZ': 7,
  'thumbBottomLeftOffsetX': -56.3,
  'thumbBottomLeftOffsetY': -43.3,
  'thumbBottomLeftOffsetZ': -23.5,
  'thumbBottomLeftTentingX': -180,
  'thumbBottomLeftTentingY': -1575,
  'thumbBottomLeftTentingZ': 2340,
  'thumbBottomRightOffsetX': -37.8,
  'thumbBottomRightOffsetY': -55.3,
  'thumbBottomRightOffsetZ': -25.3,
  'thumbBottomRightTentingX': -720,
  'thumbBottomRightTentingY': -1485,
  'thumbBottomRightTentingZ': 2430,
  'thumbMiddleLeftOffsetX': -52,
  'thumbMiddleLeftOffsetY': -26,
  'thumbMiddleLeftOffsetZ': -12,
  'thumbMiddleLeftTentingX': 270,
  'thumbMiddleLeftTentingY': -1530,
  'thumbMiddleLeftTentingZ': 1800,
  'thumbMiddleRightOffsetX': -29,
  'thumbMiddleRightOffsetY': -41,
  'thumbMiddleRightOffsetZ': -13,
  'thumbMiddleRightTentingX': -270,
  'thumbMiddleRightTentingY': -1530,
  'thumbMiddleRightTentingZ': 2160,
  'thumbTopLeftOffsetX': -35,
  'thumbTopLeftOffsetY': -15,
  'thumbTopLeftOffsetZ': -2,
  'thumbTopLeftTentingX': 450,
  'thumbTopLeftTentingY': -1035,
  'thumbTopLeftTentingZ': 450,
  'thumbTopRightOffsetX': -12,
  'thumbTopRightOffsetY': -16,
  'thumbTopRightOffsetZ': 3,
  'thumbTopRightTentingX': 450,
  'thumbTopRightTentingY': -1035,
  'thumbTopRightTentingZ': 450,
  'extraWidth': 2.5,
  'extraHeight': 1,
}

const curvedShaping = {
  'thumbClusterOffsetX': 6.0,
  'thumbClusterOffsetY': -3,
  'thumbClusterOffsetZ': 7,
  'thumbBottomLeftOffsetX': -51,
  'thumbBottomLeftOffsetY': -25,
  'thumbBottomLeftOffsetZ': -11.5,
  'thumbBottomLeftTentingX': 270,
  'thumbBottomLeftTentingY': -1440,
  'thumbBottomLeftTentingZ': 1575,
  'thumbBottomRightOffsetX': -39,
  'thumbBottomRightOffsetY': -43,
  'thumbBottomRightOffsetZ': -16,
  'thumbBottomRightTentingX': 270,
  'thumbBottomRightTentingY': -1530,
  'thumbBottomRightTentingZ': 1575,
  'thumbMiddleLeftOffsetX': -52,
  'thumbMiddleLeftOffsetY': -26,
  'thumbMiddleLeftOffsetZ': -12,
  'thumbMiddleLeftTentingX': 270,
  'thumbMiddleLeftTentingY': -1530,
  'thumbMiddleLeftTentingZ': 1800,
  'thumbMiddleRightOffsetX': -23,
  'thumbMiddleRightOffsetY': -34,
  'thumbMiddleRightOffsetZ': -6,
  'thumbMiddleRightTentingX': 450,
  'thumbMiddleRightTentingY': -1035,
  'thumbMiddleRightTentingZ': 1125,
  'thumbTopLeftOffsetX': -35,
  'thumbTopLeftOffsetY': -16,
  'thumbTopLeftOffsetZ': -2,
  'thumbTopLeftTentingX': 450,
  'thumbTopLeftTentingY': -1035,
  'thumbTopLeftTentingZ': 1125,
  'thumbTopRightOffsetX': -15,
  'thumbTopRightOffsetY': -10,
  'thumbTopRightOffsetZ': 5,
  'thumbTopRightTentingX': 630,
  'thumbTopRightTentingY': -510,
  'thumbTopRightTentingZ': 450,
}

function defaultThumbs(keyType: KeyType, capType: CapType, shaping: Manuform['shaping'], encoder = false): CuttleKey[] {
  const topAspect = 1
  const thumbBase = {
    type: keyType,
    keycap: {
      profile: capType,
      row: 5,
    },
  }

  const topLeft: CuttleKey = {
    ...thumbBase,
    keycap: { profile: capType, row: 5, letter: ' ', home: 'thumb' },
    aspect: topAspect,
    position: new ETrsf().rotate(shaping.thumbTopLeftTentingX / 45, CENTER, X)
      .rotate(shaping.thumbTopLeftTentingY / 45, CENTER, Y)
      .rotate(shaping.thumbTopLeftTentingZ / 45, CENTER, Z)
      .translate(shaping.thumbTopLeftOffsetX + 0.3, shaping.thumbTopLeftOffsetY, shaping.thumbTopLeftOffsetZ),
  }
  const topRight: CuttleKey = {
    ...thumbBase,
    aspect: topAspect,
    position: new ETrsf().rotate(shaping.thumbTopRightTentingX / 45, CENTER, X)
      .rotate(shaping.thumbTopRightTentingY / 45, CENTER, Y)
      .rotate(shaping.thumbTopRightTentingZ / 45, CENTER, Z)
      .translate(shaping.thumbTopRightOffsetX, shaping.thumbTopRightOffsetY, shaping.thumbTopRightOffsetZ),
  }
  let middleLeft: CuttleKey = {
    ...thumbBase,
    aspect: 1,
    position: new ETrsf().rotate(shaping.thumbMiddleLeftTentingX / 45, CENTER, X)
      .rotate(shaping.thumbMiddleLeftTentingY / 45, CENTER, Y)
      .rotate(shaping.thumbMiddleLeftTentingZ / 45, CENTER, Z)
      .translate(shaping.thumbMiddleLeftOffsetX, shaping.thumbMiddleLeftOffsetY, shaping.thumbMiddleLeftOffsetZ),
  }
  let middleRight: CuttleKey = {
    ...thumbBase,
    aspect: 1,
    position: new ETrsf().rotate(shaping.thumbMiddleRightTentingX / 45, CENTER, X)
      .rotate(shaping.thumbMiddleRightTentingY / 45, CENTER, Y)
      .rotate(shaping.thumbMiddleRightTentingZ / 45, CENTER, Z)
      .translate(shaping.thumbMiddleRightOffsetX, shaping.thumbMiddleRightOffsetY, shaping.thumbMiddleRightOffsetZ),
  }
  let bottomLeft: CuttleKey = {
    ...thumbBase,
    aspect: 1,
    position: new ETrsf().rotate(shaping.thumbBottomLeftTentingX / 45, CENTER, X)
      .rotate(shaping.thumbBottomLeftTentingY / 45, CENTER, Y)
      .rotate(shaping.thumbBottomLeftTentingZ / 45, CENTER, Z)
      .translate(shaping.thumbBottomLeftOffsetX, shaping.thumbBottomLeftOffsetY, shaping.thumbBottomLeftOffsetZ),
  }
  let bottomRight: CuttleKey = {
    ...thumbBase,
    aspect: 1,
    position: new ETrsf().rotate(shaping.thumbBottomRightTentingX / 45, CENTER, X)
      .rotate(shaping.thumbBottomRightTentingY / 45, CENTER, Y)
      .rotate(shaping.thumbBottomRightTentingZ / 45, CENTER, Z)
      .translate(shaping.thumbBottomRightOffsetX, shaping.thumbBottomRightOffsetY, shaping.thumbBottomRightOffsetZ),
  }
  if (encoder) {
    bottomLeft = {
      type: 'ec11',
      aspect: bottomLeft.aspect,
      position: bottomLeft.position,
    }
  }

  const thumbs: CuttleKey[] = [topLeft, topRight]
  thumbs.push(middleLeft)
  thumbs.push(middleRight)
  thumbs.push(bottomLeft)
  thumbs.push(bottomRight)
  return thumbs
}

// main(carbonfetThumbs('mx', 'dsa'), () => true, true)
// main(defaultThumbs('mx', 'dsa', manuformShaping), () => true, false)
main(defaultThumbs('mx', 'dsa', curvedShaping), () => true, false)

/**
 * A library to help work with hands.
 *
 * I'll briefly explain the theory here. The hand that comes from mediapipe is described as a bunch of keypoints.
 * This doc explains it well: https://github.com/google/mediapipe/blob/master/docs/solutions/hands.md
 *
 * A better representation of the points is as vectors. Each hand is made up of 5 fingers,
 * each represented as a chain of 4 vectors. Each of the 4 vectors correspond to a bone in the hand.
 * This is what makeHand() calculates.
 *
 * This is great at representing a hand in a moment of time, but it fails to capture the kinematics of the hand:
 * what the degrees of freedom are in the hand and which way joints can move.
 *
 * I make the following assumptions about the hand's degrees of freedom:
 * - The metacarpal bones (first of the 4 bones in the chain) are fixed (the carpometacarpal joints have 0 DOF)
 * - The metacarpophalangeal joints have 2 DOF (side-to-side and up-down)
 * - The remaining 2 joints have 1 DOF (up-down).
 * - The up-down motion of the phalanges (last 3 bones) are all in the same plane.
 * - The thumb is slightly different, in that the 2nd joint has 1 DOF and the 3rd joint has 2 DOF.
 *
 * To find the direction of the up-down motion, I gather all joint vectors that have up-down motion and
 * find the principal components via PCA. One of the components is chosen to be the Z axis of the joint's
 * coordinate frame, and the X axis is calculated as the average vector position projected onto the XY plane
 * (might want to revisit this later).
 *
 * The rest of the joints get coordinate frames as well to expess their motion: the up-down motion is about the
 * Z axis, and the side-to-side motion is about the Y axis. The X axis points in the direction of the joint.
 * These coordinate frames are stored in a SolvedHand object. The Vinv transformation matrix goes from the local
 * frame to world space. V goes from world space to local space.
 *
 * If you're unfamiliar with using matrices as transformations, it might be helpful to read linear algebra/robotics
 * resources like https://modernrobotics.northwestern.edu/nu-gm-book-resource/3-3-1-homogeneous-transformation-matrices/
 *
 * With the coordinate frames FK is fairly simple. Perform the up-down and side-to-side rotations in local space,
 * then multiply by the Vinv matrix to get the world space transformation.
 *
 * For IK, I rely on the asumption that all the up-down motions are coplanar. I simplify the 4-bone linkage to 2 joints.
 * The first joint is the MCP joint, which as 2 DOF (second assumption). The second fake joint goes straight from the end
 * of the metacarpal bone to the target position. It has 1 DOF in its length. Altogether, that makes 3 DOF for a target
 * positioned with 3 DOF, which means there is 1 unique solution!
 *
 * After finding the orientation of the MCP joint, I draw a plane containing both the target position and end position
 * of the metacarpal. The plane is oriented normal to the Z axis of the MCP joint. Along the plane I draw a quadrilateral.
 * One edge is that fake joint, while the other 3 are the 3 phalanges. I could choose any type of quadrilateral, but I
 * choose a cyclic quadrilateral, which has maximum area (there's no biological explanation but it produces natural-looking
 * grasps).
 *
 * Altogether it's a lot of math :) But that's what makes it fun.
 *
 * Copyright (C) 2023 rianadon. See the LICENSE file for the license.
 */

import type { LandmarkList, NormalizedLandmarkList } from '@mediapipe/hands'
import { SVD } from 'svd-js'
import { Euler, Matrix4, Quaternion, Vector3, type Vector3Tuple } from 'three'
import { DEG2RAD } from 'three/src/math/MathUtils'

export interface PoseHand {
  keypoints: NormalizedLandmarkList
  keypoints3D: LandmarkList
  handedness: 'Left' | 'Right'
  score: number
}

export interface Hand {
  handedness: string
  score: number
  hand: PoseHand
  vectors: Vector3[]
  limbs: Record<string, Vector3[]>
  /** Rotation matrix used to transform camera points into hand points */
  basis: Matrix4
}

export interface Hands {
  Left?: Hand
  Right?: Hand
}

export const CONNECTIONS = {
  thumb: [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 4],
  ],
  indexFinger: [
    [0, 5],
    [5, 6],
    [6, 7],
    [7, 8],
  ],
  middleFinger: [
    [0, 9],
    [9, 10],
    [10, 11],
    [11, 12],
  ],
  ringFinger: [
    [0, 13],
    [13, 14],
    [14, 15],
    [15, 16],
  ],
  pinky: [
    [0, 17],
    [17, 18],
    [18, 19],
    [19, 20],
  ],
}
export const FINGERS = Object.keys(CONNECTIONS) as Finger[]
export const LIMBS = [0, 1, 2, 3]

const Y_AXIS = new Vector3(0, 1, 0)
const Z_AXIS = new Vector3(0, 0, 1)

function MAX_PAN(finger: Finger) {
  if (finger == 'thumb') return 40 * DEG2RAD
  return 30 * DEG2RAD
}

export type Joint =
  | { length: number; degree: 0; position: Vector3; V: Matrix4; Vinv: Matrix4 }
  | { length: number; degree: 1 | 2; V: Matrix4; Vinv: Matrix4 }
type Finger = string
export type Joints = Record<Finger, Joint[]>

/** Create a basis to orient the hand in a standard position.
 * This standardizes the orientation of all hands.
 * The re-orientation uses the vectors between thumb->pinky MCPs and the middle finger MCP->CMC.
 */
function makeBasis(vectors: Vector3[], reverse: boolean) {
  const up = new Vector3()
    .subVectors(vectors[CONNECTIONS.middleFinger[0][1]], vectors[CONNECTIONS.middleFinger[0][0]])
    .normalize()

  const left = new Vector3()
    .subVectors(vectors[CONNECTIONS.pinky[0][1]], vectors[CONNECTIONS.thumb[0][1]])
    .normalize()
  if (reverse) left.negate()

  const proj = new Vector3().addScaledVector(up, up.dot(left))
  left.sub(proj).normalize()

  const x = new Vector3().crossVectors(up, left)

  return new Matrix4().makeBasis(x, up, left)
}

/** Transform a hand's keypoints into a list of vectors for each finger. */
export function makeHand(hand: PoseHand, is2D = false, ptTransform = (pt: Vector3) => pt): Hand {
  const vectors = is2D
    ? hand.keypoints.map(a => ptTransform(new Vector3(1 - a.x, a.y, 0)))
    : hand.keypoints3D.map(a => ptTransform(new Vector3(a.x, -a.y, a.z)))
  const handedness = hand.handedness
  const score = hand.score

  const basis = makeBasis(vectors, handedness === 'Right').invert()
    .premultiply(
      new Matrix4().makeBasis(
        new Vector3(0, -1, 0),
        new Vector3(1, 0, 0),
        new Vector3(0, 0, 1),
      ),
    )
  // const transform = new Matrix4()

  const limbs = Object.fromEntries(
    Object.entries(CONNECTIONS).map(([name, limb]) => [
      name,
      limb.map(([a, b]) =>
        new Vector3()
          .subVectors(vectors[b], vectors[a])
          .applyMatrix4(basis)
      ),
    ]),
  )
  return { hand, vectors, handedness, score, limbs, basis }
}

export function handOrientation(hand: Hand): Quaternion {
  const mat = hand.basis.clone().invert()
  return new Quaternion().setFromRotationMatrix(mat)
}

/** Create a joint by averaging together vectors.
 *
 * The joint's x axis will point in the average vector direction, and the z vector will point in the -z direction. */
export function averageNorms(v: Vector3[], length: number, matrix: Matrix4, degree: 0 | 1 | 2): Joint {
  const position = v
    .reduce((a, h) => a.addScaledVector(h, 1 / h.length()), new Vector3(0, 0, 0))
    .normalize().applyMatrix4(matrix)
  const x = position
  const z = new Vector3(0, 0, -1).addScaledVector(x, x.z).normalize()
  const y = new Vector3().crossVectors(z, x)

  const Vinv = new Matrix4().makeBasis(x, y, z)
  const V = new Matrix4().copy(Vinv).invert()
  return { length, position, V, Vinv, degree }
}

function decompose(v: Vector3) {
  return [v.x, v.y, v.z] as Vector3Tuple
}

/** Create a joint by averaging vectors then setting the z direction to be along one of the principal components.
 *
 * The principal component with the largest magnitude in the z direction is chosen.
 */
export function fitNorms(vecs: Vector3[], fit: boolean, length: number, matrix: Matrix4): Joint {
  const normvecs = vecs.map((v) => new Vector3().copy(v).normalize().applyMatrix4(matrix))
  const average = normvecs.reduce((a, h) => a.add(h), new Vector3(0, 0, 0)).normalize()

  const { v, q } = SVD(normvecs.map(decompose), false)
  // The basis elememts for the transformation, in world space
  let vVecs = [
    new Vector3(v[0][0], v[1][0], v[2][0]),
    new Vector3(v[0][1], v[1][1], v[2][1]),
    new Vector3(v[0][2], v[1][2], v[2][2]),
  ]
  const alignDown = vVecs.map((v) => Math.abs(v.z))
  const z = vVecs[alignDown.indexOf(Math.max(...alignDown))]

  const avgProject = new Vector3(average.x, 0, average.y).normalize()
  if (avgProject.x < 0) avgProject.negate()
  const x = avgProject.addScaledVector(z, -z.dot(avgProject)).normalize()
  const y = new Vector3().crossVectors(z, x)

  if (z.z < 0) {
    // z.z should be positive so the axes align
    z.negate()
    y.negate()
  }

  const Vinv = new Matrix4().makeBasis(x, y, z)
  const V = new Matrix4().copy(Vinv).invert()
  return { length, V, Vinv, degree: fit ? 1 : 2 }
}

/** Find the interior angle of a cyclic quadrilateral (a quadrilateral whose vertices
 * lie on a cirle. This quadrilateral maximizes the area given the 4 side lengths.
 * a, b, c, and d are the side lengths. */
function cyclicQuadAngle(a: number, b: number, c: number, d: number) {
  return Math.acos((a * a - b * b - c * c + d * d) / (2 * a * d + 2 * b * c))
}

export function objectFromFingers<U>(f: (finger: Finger) => U) {
  return Object.fromEntries(FINGERS.map((l) => [l, f(l)])) as Record<Finger, U>
}

export class SolvedHand {
  private matrices: Record<Finger, Matrix4[]>

  constructor(private joints: Joints, private position: Matrix4) {
    this.matrices = objectFromFingers(() => LIMBS.map(() => new Matrix4()))
  }

  ik(finger: Finger, target: Vector3, scale = 100): Vector3[] | false {
    const joints = this.joints[finger]
    const worldToFirstLimb = new Matrix4()
      .makeTranslation(joints[0].length * scale, 0, 0)
      .premultiply(joints[0].Vinv)
      .premultiply(this.position)
      .invert()

    const targetFromFirstLimb = new Vector3().copy(target).applyMatrix4(worldToFirstLimb)
    const reach = targetFromFirstLimb.length() / scale
    const maxreach = joints[1].length + joints[2].length + joints[3].length
    if (reach > maxreach) return false // The target is out of reach

    const theta1 = cyclicQuadAngle(joints[1].length, joints[2].length, joints[3].length, reach)
    const theta2 = cyclicQuadAngle(joints[2].length, joints[3].length, reach, joints[1].length)
    const theta3 = cyclicQuadAngle(joints[3].length, reach, joints[1].length, joints[2].length)

    const x = new Vector3().copy(targetFromFirstLimb).normalize().applyMatrix4(joints[1].V)

    // The fingers cannot rotate about the X axis.
    // Therefore, treat the transformation as a YZ proper Euler angle.
    // Because the x axis of the new coordinate frame is given,
    // I can solve for the y and z angles. Then find the y and z axes.
    const zAngle = Math.asin(x.y)
    const yAngle = Math.asin(x.z / -Math.cos(zAngle))
    if (Math.abs(yAngle) > MAX_PAN(finger)) return false

    const z = new Vector3(Math.sin(yAngle), 0, Math.cos(yAngle))
    const y = new Vector3().crossVectors(z, x)

    const localToParent = new Matrix4().makeBasis(x, y, z)

    this.matrices[finger] = [
      new Matrix4(),
      new Matrix4().makeRotationAxis(Z_AXIS, theta1).premultiply(localToParent),
      new Matrix4().makeRotationAxis(Z_AXIS, -Math.PI + theta2),
      new Matrix4().makeRotationAxis(Z_AXIS, -Math.PI + theta3),
    ]
    return [
      new Vector3(),
      new Vector3(0, yAngle, zAngle + theta1),
      new Vector3(0, 0, -Math.PI + theta2),
      new Vector3(0, 0, -Math.PI + theta3),
    ]
  }

  fkBy(finger: Finger, fn: (i: number) => [number, number]) {
    this.matrices[finger].forEach((m, i) => {
      let [angleZ, angleY] = fn(i)
      const degree = this.joints[finger][i].degree

      if (degree < 1) angleZ = 0
      if (degree < 2) angleY = 0

      m.makeRotationFromEuler(new Euler(0, angleY, angleZ, 'XYZ'))
    })
  }

  fromLimbs(finger: Finger, limbs: Vector3[], fit: boolean) {
    let reference = new Matrix4()

    this.matrices[finger].forEach((m, i) => {
      const joint = this.joints[finger][i]
      const refToLocal = new Matrix4().extractRotation(reference).invert().premultiply(joint.V)

      const x = new Vector3().copy(limbs[i]).applyMatrix4(refToLocal)
      if (fit) {
        if (joint.degree == 0) x.set(1, 0, 0)
        if (joint.degree <= 1) x.z = 0
      }
      x.normalize()
      const z = new Vector3(0, 0, 1).addScaledVector(x, -x.z).normalize()
      const y = new Vector3().crossVectors(z, x)
      m.makeBasis(x, y, z)

      reference.multiply(joint.Vinv).multiply(m)
    })
  }

  fromAllLimbs(limbs: Record<Finger, Vector3[]>, fit: boolean) {
    for (const finger of FINGERS) {
      this.fromLimbs(finger, limbs[finger], fit)
    }
  }

  worldPositions(finger: Finger, scale = 100): Vector3[] {
    return this.matrices[finger]
      .reduce<Matrix4[]>(
        (acc, matrix, i) => {
          acc.push(
            new Matrix4()
              .makeTranslation(this.joints[finger][i].length * scale, 0, 0)
              .premultiply(matrix)
              .premultiply(this.joints[finger][i].Vinv)
              .premultiply(acc[acc.length - 1]),
          )
          return acc
        },
        [this.position],
      )
      .map((m) => new Vector3().setFromMatrixPosition(m))
  }

  worldAllPositions(scale = 100): Record<Finger, Vector3[]> {
    return objectFromFingers((finger) => this.worldPositions(finger, scale))
  }

  localTransforms(baseMatrix = new Matrix4(), scale = 100): Record<Finger, Matrix4[]> {
    const baseMatrixI = new Matrix4().copy(baseMatrix).invert()

    return objectFromFingers((finger) => {
      let parentTranslate = new Vector3(0, 0.5, 0)
      return this.matrices[finger].map((matrix, i) => {
        const mat = new Matrix4()
          .multiplyMatrices(baseMatrixI, this.joints[finger][i].Vinv)
          .multiply(matrix)
          .multiply(baseMatrix)
        mat.setPosition(parentTranslate)

        parentTranslate = new Vector3(this.joints[finger][i].length * scale, 0, 0).applyMatrix4(
          baseMatrixI,
        )
        return mat
      })
    })
  }

  deg1Angles(finger: Finger) {
    return this.matrices[finger].map((matrix) => {
      const pos = new Vector3(1, 0, 0).applyMatrix4(matrix)
      pos.z = 0
      return pos.angleTo(new Vector3(1, 0, 0))
    })
  }

  decomposeAngles(finger: Finger) {
    return this.matrices[finger].map((matrix) => {
      return new Euler().setFromRotationMatrix(matrix, 'ZYX').toArray()
    })
  }

  decomposeAllAngles() {
    return Object.fromEntries(FINGERS.map(f => [f, this.decomposeAngles(f)]))
  }
}

export function calculateJoints(history: Hand[], means: Record<string, number[]>) {
  return Object.fromEntries(
    FINGERS.map((l) => {
      const deg1 = averageNorms(
        history.map((h) => h.limbs[l][0]),
        means[l][0],
        new Matrix4(),
        0,
      )
      const mat = deg1.V

      const rest = history.flatMap((h) => h.limbs[l].slice(1))

      const deg2 = fitNorms(rest, l === 'thumb', means[l][1], mat)
      mat.premultiply(deg2.V)
      const deg3 = fitNorms(rest, l !== 'thumb', means[l][2], mat)
      mat.premultiply(deg3.V)
      const deg4 = fitNorms(rest, true, means[l][3], mat)
      return [l, [deg1, deg2, deg3, deg4]]
    }),
  )
}

/** Like calculatejoints, but used when there is no 3d data.
	This gives a hand that at least looks ok in 2d.
	*/
export function calculateJoints2D(history: Hand[], means: Record<string, number[]>) {
  return Object.fromEntries(
    FINGERS.map((l) => {
      const deg1 = fitNorms(
        history.map((h) => h.limbs[l][0]),
        true,
        means[l][0],
        new Matrix4(),
      )
      const mat = deg1.V

      const rest = history.flatMap((h) => h.limbs[l].slice(1))

      const deg2 = fitNorms(rest, l === 'thumb', means[l][1], mat)
      mat.premultiply(deg2.V)
      const deg3 = fitNorms(rest, l !== 'thumb', means[l][2], mat)
      mat.premultiply(deg3.V)
      const deg4 = fitNorms(rest, true, means[l][3], mat)
      return [l, [deg1, deg2, deg3, deg4]]

      // const deg2 = averageNorms(rest, means[l][1], mat, l === 'thumb' ? 2 : 2);
      // mat.premultiply(deg2.V);
      // const deg3 = averageNorms(rest, means[l][2], mat, l !== 'thumb' ? 1 : 2);
      // mat.premultiply(deg3.V);
      // const deg4 = averageNorms(rest, means[l][3], mat, 1);
      // return [l, [deg1, deg2, deg3, deg4]];
    }),
  )
}

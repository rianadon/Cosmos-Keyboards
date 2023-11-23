import { Euler, Matrix4, Vector3 } from 'three'
import { DEG2RAD } from 'three/src/math/MathUtils'

const CONNECTIONS = {
  thumb: [[0, 1], [1, 2], [2, 3], [3, 4]],
  indexFinger: [[0, 5], [5, 6], [6, 7], [7, 8]],
  middleFinger: [[0, 9], [9, 10], [10, 11], [11, 12]],
  ringFinger: [[0, 13], [13, 14], [14, 15], [15, 16]],
  pinky: [[0, 17], [17, 18], [18, 19], [19, 20]],
}
export const FINGERS = Object.keys(CONNECTIONS) as Finger[]
export const LIMBS = [0, 1, 2, 3]

const Y_AXIS = new Vector3(0, 1, 0)
const Z_AXIS = new Vector3(0, 0, 1)

function MAX_PAN(finger: Finger) {
  return Infinity
  if (finger == 'thumb') return 40 * DEG2RAD
  return 30 * DEG2RAD
}

export type Joint =
  | { length: number; degree: 0; position: Vector3; V: Matrix4; Vinv: Matrix4 }
  | { length: number; degree: 1 | 2; V: Matrix4; Vinv: Matrix4 }
export type Finger = keyof typeof CONNECTIONS
export type Joints = Record<Finger, Joint[]>

/** Find the interior angle of a cyclic quadrilateral (a quadrilateral whos vertices
 * lie on a cirle. This quadrilateral maximizes the area given the 4 side lengths.
 * a, b, c, and d are the side lengths. */
function cyclicQuadAngle(a: number, b: number, c: number, d: number) {
  return Math.acos((a * a - b * b - c * c + d * d) / (2 * a * d + 2 * b * c))
}

export function objectFromFingers<U>(f: (finger: Finger) => U) {
  return Object.fromEntries(FINGERS.map(l => [l, f(l)])) as Record<Finger, U>
}

export class SolvedHand {
  private matrices: Record<Finger, Matrix4[]>

  constructor(private joints: Joints, public position: Matrix4) {
    this.matrices = objectFromFingers(() => LIMBS.map(() => new Matrix4()))
  }

  ik(finger: Finger, target: Vector3, scale = 100) {
    const joints = this.joints[finger]
    const worldToFirstLimb = new Matrix4()
      .makeTranslation(joints[0].length * scale, 0, 0)
      .premultiply(joints[0].Vinv)
      .premultiply(this.position).invert()

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
      new Matrix4().makeRotationAxis(Z_AXIS, theta1)
        .premultiply(localToParent),
      new Matrix4().makeRotationAxis(Z_AXIS, -Math.PI + theta2),
      new Matrix4().makeRotationAxis(Z_AXIS, -Math.PI + theta3),
    ]

    return [new Vector3(), new Vector3(0, yAngle, zAngle + theta1), new Vector3(0, 0, -Math.PI + theta2), new Vector3(0, 0, -Math.PI + theta3)]
  }

  fkBy(finger: Finger, fn: (i: number) => [number, number]) {
    this.matrices[finger].forEach((m, i) => {
      let [angleZ, angleY] = fn(i)
      const degree = this.joints[finger][i].degree

      if (degree < 1) angleZ = 0
      if (degree < 2) angleY = 0

      m.makeRotationFromEuler(new Euler(0, angleY, angleZ, 'XYZ'))
      // m.makeRotationAxis(Z_AXIS, angleZ)
      // if (angleY != 0) m.premultiply(new Matrix4().makeRotationAxis(Y_AXIS, angleY))
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
    console.log('position', this.position)
    return this.matrices[finger]
      .reduce<Matrix4[]>((acc, matrix, i) => {
        acc.push(
          new Matrix4().makeTranslation(this.joints[finger][i].length * scale, 0, 0)
            .premultiply(matrix)
            .premultiply(this.joints[finger][i].Vinv)
            .premultiply(acc[acc.length - 1]),
        )
        return acc
      }, [this.position])
      .map(m => new Vector3().setFromMatrixPosition(m))
  }

  worldAllPositions(scale = 100): Record<Finger, Vector3[]> {
    return objectFromFingers(finger => this.worldPositions(finger, scale))
  }

  localTransforms(baseMatrix = new Matrix4(), scale = 100): Record<Finger, Matrix4[]> {
    const baseMatrixI = new Matrix4().copy(baseMatrix).invert()

    return objectFromFingers(finger => {
      let parentTranslate = new Vector3(0, 0.5, 0)
      return this.matrices[finger].map((matrix, i) => {
        const mat = new Matrix4().multiplyMatrices(baseMatrixI, this.joints[finger][i].Vinv)
          .multiply(matrix).multiply(baseMatrix)
        mat.setPosition(parentTranslate)

        parentTranslate = new Vector3(this.joints[finger][i].length * scale, 0, 0).applyMatrix4(baseMatrixI)
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
}

import { Euler, Matrix4, Vector3 } from 'three'
import { type Finger, FINGERS, type Joint, type Joints, objectFromFingers } from './hand'

/**
 * Optimize the hand position! (IK!)
 *
 * The error E_fingers is K((Rx - t)^2 - l)^2, where R is the rotation matrix,
 * X is the position out to the beginning of the finger, K is a constant,
 * t is the point where the end of the finger should be,
 * and l is the desired length between start and end of the finger.
 *
 * In order to run gradient descent, the code needs to calculate the gradients!.
 * The rotation matrix is defined in terms the the Euler components A, B, and C.
 * I used the computer to solve partial R/partial A and the other partials of R.
 * Those are the tricky derivatives! The rest is careful application of the chain rule.
 *
 * There is another error component E_joints which is nonzero when joints have moved past their limits.
 * For each joint E_joint = K2 * (radians past the joint limit), where K2 is a constant.
 * I define angle = f(distance) and distance = sqrt((Rx - t)^2).
 * Using some calculus I can find the full derivative!
 *
 * For the metecarpal joint, I approximate the radians past the limit as arccos(((RV)^T t).z) = arccos(last row of (RV^T) * t) = arccos(last col of RV * t)
 */

/** Returns the partial derivatives of the euler rotation matrix with respect ot a, b, and c.
 * This is a element-wise derivative.
 *
 * Note the returned matrix isn't a valid transformation matrix.
 */
function RDerivABC(a: number, b: number, c: number) {
  const ca = Math.cos(a)
  const sa = Math.sin(a)
  const cb = Math.cos(b)
  const sb = Math.sin(b)
  const cc = Math.cos(c)
  const sc = Math.sin(c)
  // dprint-ignore
  return {
    a: new Matrix4().set(-cb*cc*sa - ca*sc, -ca*cc + cb*sa*sc, -sa*sb, 0,
                         ca*cb*cc - sa*sc, -cc*sa - ca*cb*sc, ca*sb, 0,
                         0, 0, 0, 0,
                         0, 0, 0, 1),
    b: new Matrix4().set(-ca*cc*sb, ca*sb*sc, ca*cb, 0,
      -cc*sa*sb, sa*sb*sc, cb*sa, 0,
      -cb*cc, cb*sc, -sb, 0,
                         0, 0, 0, 1),
    c: new Matrix4().set(-cc*sa - ca*cb*sc, -ca*cb*cc + sa*sc, 0, 0,
                         ca*cc - cb*sa*sc, -cb*cc*sa - ca*sc, 0, 0,
                         sb*sc, cc*sb, 0, 0,
                         0, 0, 0, 1)
  }
}

function sqDistanceGrad(e: Euler, x: Vector3, y: Vector3, length: number, Vt: Matrix4) {
  const distVector = new Vector3().copy(x).applyEuler(e).sub(y)
  const distLength = Math.sqrt(distVector.dot(distVector))
  const error = distLength - length

  const { a: da, b: db, c: dc } = RDerivABC(e.x, e.y, e.z)
  const Da = new Vector3().copy(x).applyMatrix4(da).dot(distVector) / distLength
  const Db = new Vector3().copy(x).applyMatrix4(db).dot(distVector) / distLength
  const Dc = new Vector3().copy(x).applyMatrix4(dc).dot(distVector) / distLength

  const jointVector = new Vector3().copy(y).applyMatrix4(
    new Matrix4().multiplyMatrices(Vt, new Matrix4().makeRotationFromEuler(e).invert()),
  )
  const jointAngle = Math.atan2(jointVector.y, jointVector.x)
  // console.log(jointAngle * 180/Math.PI, jointVector)

  const ja = new Vector3().copy(y).applyMatrix4(new Matrix4().multiplyMatrices(Vt, da))
  const jb = new Vector3().copy(y).applyMatrix4(new Matrix4().multiplyMatrices(Vt, db))
  const jc = new Vector3().copy(y).applyMatrix4(new Matrix4().multiplyMatrices(Vt, dc))
  // const Ja = jointAngle/(1 + (jointVector.y/jointVector.x)**2) * (ja.y * jointVector.x - ja.x * jointVector.y) / jointVector.y**2
  // const Jb = jointAngle/(1 + (jointVector.y/jointVector.x)**2) * (jb.y * jointVector.x - jb.x * jointVector.y) / jointVector.y**2
  // const Jc = jointAngle/(1 + (jointVector.y/jointVector.x)**2) * (jc.y * jointVector.x - jc.x * jointVector.y) / jointVector.y**2
  let Ja = jointVector.y < 0 ? 0.01 * jointVector.y * ja.y : 0.001 * jointVector.y ** 3 * ja.y
  let Jb = jointVector.y < 0 ? 0.01 * jointVector.y * jb.y : 0.001 * jointVector.y ** 3 * jb.y
  let Jc = jointVector.y < 0 ? 0.01 * jointVector.y * jc.y : 0.001 * jointVector.y ** 3 * jc.y

  // Ja += 0.0001*jointVector.z**3*ja.z
  // Jb += 0.0001*jointVector.z**3*jb.z
  // Jc += 0.0001*jointVector.z**3*jc.z

  // Error function is linear for x<0, quadratic for x > 0
  // We just care that hands are placed, not that every finger is fullly outstretched
  // Plus the error function blows up when some errors are really big and some are really tiny
  if (error < 0) {
    return {
      a: Ja - .1 * Da,
      b: Jb - .1 * Db,
      c: Jc - .1 * Dc,
      error,
    }
  }

  return {
    a: error * Da + Ja,
    b: error * Db + Jb,
    c: error * Dc + Jc,
    error,
  }
}

function refineIter(m: Matrix4, joints: Joints, targets: Record<Finger, Vector3>, scale = 1000, rate = 5e-6) {
  const e = new Euler().setFromRotationMatrix(m)
  const pos = new Vector3().setFromMatrixPosition(m)

  const totalGrad = new Vector3()
  let totalError = 0
  let debug = new Matrix4()
  for (const f of Object.keys(targets)) {
    const x = new Vector3(joints[f][0].length * scale, 0, 0).applyMatrix4(joints[f][0].Vinv)
    const length = (joints[f][1].length + joints[f][2].length + joints[f][3].length) * scale
    const y = new Vector3().subVectors(targets[f], pos)

    const Vt = new Matrix4().copy(joints[f][0].Vinv).multiply(
      new Matrix4().makeTranslation(joints[f][0].length * scale, 0, 0),
    ).multiply(joints[f][1].Vinv).invert()

    const jointVector = new Vector3().copy(y).applyMatrix4(
      new Matrix4().multiplyMatrices(Vt, new Matrix4().makeRotationFromEuler(e).invert()),
    )
    if (f === 'indexFinger') {
      debug = new Matrix4().setPosition(jointVector.applyMatrix4(new Matrix4().copy(Vt).invert()))
    }

    // The gradient descent will bounce around the 0 error point (when the arm is exactly outstretched)
    // Make the target length sligtly smaller so there will always be an ik solution
    // console.log(f)
    const grad = sqDistanceGrad(e, x, y, length * .99, Vt)
    totalGrad.x += grad.a
    totalGrad.y += grad.b
    totalGrad.z += grad.c
    totalError += Math.abs(grad.error)
  }
  totalGrad.multiplyScalar(rate)
  if (totalGrad.length() > 0.3) totalGrad.normalize().multiplyScalar(0.3)

  const enew = new Euler(e.x - totalGrad.x, e.y - totalGrad.y, e.z - totalGrad.z)
  return {
    matrix: new Matrix4().makeRotationFromEuler(enew).setPosition(pos),
    error: totalError,
    debug,
  }
}

export function refine(m: Matrix4, joints: Joints, targets: Record<Finger, Vector3>, scale = 1000) {
  let prevError = Infinity
  let Vt = new Matrix4()
  const rate = Object.keys(targets).length == 1 ? 10e-6 : 1e-6 * Object.keys(targets).length
  for (let i = 0; i < 300; i++) {
    const { matrix, error, debug } = refineIter(m, joints, targets, scale, rate)
    Vt = debug
    const errorDelta = Math.abs(prevError - error)
    prevError = error
    m = matrix
    // if (errorDelta < 0.001) break
  }
  return { m, Vt }
}

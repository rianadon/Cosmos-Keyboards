import { Matrix3, Matrix4, Vector3 } from 'three'

const HAND_DEPTH = 0

// based on https://stackoverflow.com/questions/12299870/computing-x-y-coordinate-3d-from-image-point
export function cameraToMarkerPoint(cameraMatrix: Matrix4, size: number[], xc: number, yc: number, z = HAND_DEPTH) {
  const Ginv = new Matrix4().copy(cameraMatrix).invert()
  // const T = new Vector3(camera2AR.elements[12], camera2AR.elements[13], camera2AR.elements[14])
  const uv = new Vector3(xc, yc, 1)

  const Rinv = new Matrix3().setFromMatrix4(Ginv)
  const Cinv = new Matrix3().set(1 / 1000, 0, -size[0] / 2000, 0, 1 / 1000, -size[1] / 2000, 0, 0, 1)
  // const camMatrixThree = new Matrix3().set(1000, 0, size[0]/2, 0, 1000, size[1]/2,  0, 0, 1)

  const left = uv.clone().applyMatrix3(Cinv).applyMatrix3(Rinv).z
  const right = z - Ginv.elements[14] // = z + Rinv * T
  const s = right / left

  const pt = uv.clone().applyMatrix3(Cinv).multiplyScalar(s).applyMatrix4(Ginv)
  return pt
}

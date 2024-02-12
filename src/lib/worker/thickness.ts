import { Triangle } from 'three/src/math/Triangle'
import { Vector3 } from 'three/src/math/Vector3'

export function thickness(pta: Vector3, ptb: Vector3, ptc: Vector3, pba: Vector3, pbb: Vector3, pbc: Vector3) {
  const topTri = new Triangle(pta, ptb, ptc)
  const botTri = new Triangle(pbc, pbb, pba)

  // Assemble all triangles from the volume formed by connecting topTri and botTri
  const triangles = [
    topTri,
    botTri,
    new Triangle(pta, pba, pbb),
    new Triangle(pta, pbb, ptb),
    new Triangle(ptb, pbb, pbc),
    new Triangle(ptb, pbc, ptc),
    new Triangle(ptc, pbc, pba),
    new Triangle(ptc, pba, pta),
  ]

  // Compute the volume of the shape
  let volume = 0
  let normal = new Vector3()
  let midpoint = new Vector3()
  for (const tri of triangles) {
    volume += tri.getNormal(normal).dot(tri.getMidpoint(midpoint)) * tri.getArea() / 3
  }
  const avgArea = (topTri.getArea() + botTri.getArea()) / 2

  return Math.max(volume / avgArea, 0)
}

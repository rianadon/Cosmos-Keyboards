// import AR from '../lib/aruco/aruco.mjs';
import { Matrix4, Vector3 } from 'three'
import type { Detector } from '../lib/detector'
import type { PoseHand } from '../lib/hand'

type OpenCV = typeof import('$assets/opencv.d.ts')

export default class ChessboardDetector {
  private mat: any
  // private mat3: any
  private gray: any

  private board: any
  private dictionary: any
  private size = [0, 0]

  public valid = false
  public markermatrix = new Matrix4()
  public hands: { Left?: PoseHand; Right?: PoseHand } = {}

  public boardWidth = 0
  public boardHeight = 0

  private corners: any
  private ids: any
  private charucoCorners: any
  private charucoIds: any

  constructor(public cv: OpenCV, w: number, h: number, private scale = 0.7) {
    this.mat = new cv.Mat()
    // this.mat3 = new cv.Mat()
    this.gray = new cv.Mat()
    this.corners = new this.cv.MatVector()
    this.ids = new this.cv.Mat()
    this.charucoCorners = new this.cv.Mat()
    this.charucoIds = new this.cv.Mat()

    // const dict = Uint8Array.from(atob(DICTIONARY), c => c.charCodeAt(0))
    // const dictMat = new cv.Mat(50, 8, cv.CV_8U)
    // console.log(this.cv.aruco_Dictionary)
    this.dictionary = new this.cv.aruco_Dictionary(0)
    this.resizeBoard(w, h)
  }

  resizeBoard(w: number, h: number): boolean {
    if (w == this.boardWidth && h == this.boardHeight) return false
    this.boardWidth = w
    this.boardHeight = h
    if (this.board) this.board.delete()
    this.board = new this.cv.aruco_CharucoBoard(this.boardWidth, this.boardHeight, 1, this.scale, this.dictionary)
    return true
  }

  image() {
    const arucoPts = 6
    const marginpts = (1 - this.scale) * arucoPts
    const ptsize = Math.round(arucoPts + marginpts) * 6
    const width = this.boardWidth * ptsize
    const height = this.boardHeight * ptsize

    const size = new this.cv.Size(width, height)
    const img = new this.cv.Mat(height, width, this.cv.CV_8UC1)
    this.board.draw(size, img)

    const canvas = document.createElement('canvas')
    this.cv.imshow(canvas, img)
    img.delete()
    return canvas.toDataURL()
  }

  setSize(width: number, height: number) {
    this.mat.delete()
    this.gray.delete()
    this.mat = new this.cv.Mat(height, width, this.cv.CV_8UC4)
    // this.mat3 = new this.cv.Mat(height, width, this.cv.CV_8UC3)
    this.gray = new this.cv.Mat(height, width, this.cv.CV_8UC1)
  }

  drawAxes(context: CanvasRenderingContext2D) {
    const width = this.size[0]
    const height = this.size[1]

    // dprint-ignore
    const camMatrixThree = new Matrix4().set(
      1000, 0, width / 2, 0,
      0, 1000, height / 2, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    )

    const s = 10
    let pt1 = new Vector3(0, 0, 0).applyMatrix4(this.markermatrix).applyMatrix4(camMatrixThree)
    let pt2 = new Vector3(s, 0, 0).applyMatrix4(this.markermatrix).applyMatrix4(camMatrixThree)
    let pt3 = new Vector3(0, s, 0).applyMatrix4(this.markermatrix).applyMatrix4(camMatrixThree)
    let pt4 = new Vector3(0, 0, s).applyMatrix4(this.markermatrix).applyMatrix4(camMatrixThree)

    context.lineWidth = 40
    context.strokeStyle = 'red'
    context.beginPath()
    context.moveTo(pt1.x / pt1.z, pt1.y / pt1.z)
    context.lineTo(pt2.x / pt2.z, pt2.y / pt2.z)
    context.stroke()
    context.strokeStyle = 'green'
    context.beginPath()
    context.moveTo(pt1.x / pt1.z, pt1.y / pt1.z)
    context.lineTo(pt3.x / pt3.z, pt3.y / pt3.z)
    context.stroke()
    context.strokeStyle = 'blue'
    context.beginPath()
    context.moveTo(pt1.x / pt1.z, pt1.y / pt1.z)
    context.lineTo(pt4.x / pt4.z, pt4.y / pt4.z)
    context.stroke()
  }

  async detect(imageData: ImageData, hdetector: Detector) {
    this.mat.data.set(imageData.data)
    this.cv.cvtColor(this.mat, this.gray, this.cv.COLOR_BGR2GRAY)

    this.cv.detectMarkers(this.gray, this.dictionary, this.corners, this.ids)
    this.valid = false
    this.size = [imageData.width, imageData.height]

    // this.cv.cvtColor(this.mat, this.mat3, this.cv.COLOR_RGBA2RGB)
    if (this.corners.size() > 0) {
      const detectorPromise = hdetector.estimateHands(imageData as any, { flipHorizontal: true })
      // this.cv.drawDetectedMarkers(this.mat3, corners, ids)

      this.cv.interpolateCornersCharuco(
        this.corners,
        this.ids,
        this.gray,
        this.board,
        this.charucoCorners,
        this.charucoIds,
      )

      if (this.charucoCorners.rows > 3) {
        const width = this.mat.cols
        const height = this.mat.rows

        // dprint-ignore
        const cameraMatrix = this.cv.matFromArray(3, 3, this.cv.CV_64F, [
          1000, 0, width / 2,
          0, 1000, height / 2,
          0, 0, 1,
        ])

        const distCoeffs = new this.cv.Mat()
        const rvec = new this.cv.Mat(3, 1, this.cv.CV_64F)
        const tvec = new this.cv.Mat(3, 1, this.cv.CV_64F)

        // this.cv.drawDetectedCornersCharuco(this.mat3, charucoCorners, charucoIds)
        const valid = this.cv.estimatePoseCharucoBoard(
          this.charucoCorners,
          this.charucoIds,
          this.board,
          cameraMatrix,
          distCoeffs,
          rvec,
          tvec,
        )
        if (valid) {
          this.valid = true
          // this.cv.drawFrameAxes(this.mat3, cameraMatrix, distCoeffs, rvec, tvec, 10, 3)
          const axis = new Vector3().fromArray(rvec.data64F)
          const length = axis.length()
          this.markermatrix = new Matrix4().makeRotationAxis(axis.normalize(), length)
          this.markermatrix.setPosition(new Vector3().fromArray(tvec.data64F))
          this.hands = await detectorPromise
          return true
        }
      }
      // this.cv.imshow(canvas, this.mat3)
      return false
    }
  }

  public debugData() {
    return {
      charucoCorners: [...this.charucoCorners.data32F],
      charucoIds: [...this.charucoIds.data32S],
      matrix: this.markermatrix.elements,
      corners: Array.from(Array(this.corners.size()), (_, i) => [...this.corners.get(i).data32F]),
      ids: [...this.ids.data32S],
      idsType: this.ids.type(),
    }
  }
}

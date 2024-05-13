type Size = [number, number]

const HASH_SAMPLES = 10 // Number of datapoints (channel of a pixel) to sample for hash

export class Camera {
  /** id of the requestanimationframe */
  private rid = -1
  /** size of the video */
  private size: Size = [0, 0]
  /** hash code of the previous frame */
  private lastHash = 0

  /** Count of number of frames since last FPS measurement */
  private frameCount = 0
  /** Time of last FPS measurement */
  private lastFPSMeasure = 0

  // Event handlers
  public onsize = (_size: Size) => {}
  public ondetect = async (_data: ImageData) => {}
  public ontick = (_ctx?: CanvasRenderingContext2D) => true
  public onfps = (_fps: number) => {}

  constructor(private video: HTMLVideoElement, private canvas: HTMLCanvasElement) {}

  start() {
    this.rid = requestAnimationFrame(() => this.tick(0))
  }

  stop() {
    cancelAnimationFrame(this.rid)
  }

  /**
   * Read a frame from the video
   */
  async tick(time: number) {
    let ctx: CanvasRenderingContext2D | undefined = undefined
    if (this.video.readyState == this.video.HAVE_ENOUGH_DATA && this.video.videoWidth > 0) {
      const { videoWidth, videoHeight } = this.video
      this.canvas.width = videoWidth
      this.canvas.height = videoHeight
      if (this.canvas.width != this.size[0]) {
        this.size = [videoWidth, videoHeight]
        this.onsize(this.size)
      }

      ctx = this.canvas.getContext('2d', { willReadFrequently: true })!
      ctx.drawImage(this.video, 0, 0, videoWidth, videoHeight)
      const imageData = ctx.getImageData(0, 0, videoWidth, videoHeight)
      const imageHash = this.hash(imageData)
      if (this.lastHash != imageHash) {
        this.lastHash = imageHash
        this.frameCount++
        await this.ondetect(imageData)
      }
    }
    if (time - this.lastFPSMeasure > 1000) {
      this.lastFPSMeasure = time
      this.onfps(this.frameCount)
      this.frameCount = 0
    }
    if (this.ontick(ctx)) {
      this.rid = requestAnimationFrame((time) => this.tick(time))
    }
  }

  /** Return a hashcode for image data.
   *  Since the data should be frequently changing,
   *  it is expected every frame has a different hashcode
   *  than the previous.
   */
  hash(data: ImageData) {
    const stride = Math.floor(data.data.length / HASH_SAMPLES)
    // Based on the Java hashcode implementation
    let hashcode = 0
    for (let i = 0; i < data.data.length; i += stride) {
      hashcode = 31 * hashcode + data.data[i]
    }

    return hashcode
  }
}

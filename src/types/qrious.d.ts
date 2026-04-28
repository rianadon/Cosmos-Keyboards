declare module 'qrious' {
  /**
   * Options interface for configuring the QRious QR code generator.
   */
  export interface QRiousOptions {
    /**
     * The HTML Canvas or Image element to render the QR code on.
     * Required for rendering directly to an existing element.
     */
    element?: HTMLCanvasElement | HTMLImageElement
    /**
     * The foreground color of the QR code (default: 'black').
     * Can be a CSS color string (e.g., 'red', '#FF0000', 'rgb(255,0,0)').
     */
    foreground?: string
    /**
     * The alpha (opacity) of the foreground color (default: 1.0).
     * Value between 0.0 and 1.0.
     */
    foregroundAlpha?: number
    /**
     * The background color of the QR code (default: 'white').
     * Can be a CSS color string.
     */
    background?: string
    /**
     * The alpha (opacity) of the background color (default: 1.0).
     * Value between 0.0 and 1.0.
     */
    backgroundAlpha?: number
    /**
     * The error correction level (default: 'L').
     * - 'L': Low (7% of codewords can be restored)
     * - 'M': Medium (15% can be restored)
     * - 'Q': Quartile (25% can be restored)
     * - 'H': High (30% can be restored)
     */
    level?: 'L' | 'M' | 'Q' | 'H'
    /**
     * The MIME type used to render the image for the QR code (default: 'image/png').
     * This affects the output of toDataURL().
     */
    mime?: string
    /**
     * The padding around the QR code in pixels (default: null for auto-padding).
     */
    padding?: number | null
    /**
     * The size of the QR code in pixels (width and height) (default: 100).
     */
    size?: number
    /**
     * The content to encode in the QR code.
     * This can be any string, such as a URL, text, etc.
     */
    value?: string
  }

  /**
   * The main QRious class for generating QR codes.
   */
  class QRious {
    /**
     * Creates a new QRious instance.
     * @param options The configuration options for the QR code.
     */
    constructor(options?: QRiousOptions)

    /**
     * Gets or sets the background color of the QR code.
     */
    background: string

    /**
     * Gets or sets the alpha (opacity) of the background color.
     */
    backgroundAlpha: number

    /**
     * The HTML Canvas element generated or provided to render the QR code.
     * This property is read-only as it refers to the underlying DOM element.
     */
    readonly canvas: HTMLCanvasElement

    /**
     * The HTML Image element generated or provided for rendering.
     * This property is read-only as it refers to the underlying DOM element.
     */
    readonly image: HTMLImageElement

    /**
     * The HTML Canvas or Image element initially provided to the constructor.
     * This property is read-only.
     */
    readonly element: HTMLCanvasElement | HTMLImageElement

    /**
     * Gets or sets the foreground color of the QR code.
     */
    foreground: string

    /**
     * Gets or sets the alpha (opacity) of the foreground color.
     */
    foregroundAlpha: number

    /**
     * Gets or sets the error correction level.
     */
    level: 'L' | 'M' | 'Q' | 'H'

    /**
     * Gets or sets the MIME type used to render the image for the QR code.
     */
    mime: string

    /**
     * Gets or sets the padding around the QR code in pixels.
     */
    padding: number | null

    /**
     * Gets or sets the size of the QR code in pixels (width and height).
     */
    size: number

    /**
     * Gets or sets the value/content encoded in the QR code.
     */
    value: string

    /**
     * Sets multiple options for the QR code at once.
     * The QR code will only update once after all options are set.
     * @param options The options to set.
     */
    set(options: QRiousOptions): void

    /**
     * Renders the QR code to a data URL (e.g., 'data:image/png;base64,...').
     * @param mimeType The MIME type of the image (default: 'image/png' or the instance's 'mime' property).
     * @returns A data URL string representing the QR code image.
     */
    toDataURL(mimeType?: string): string
  }

  /**
   * Exports the QRious class as the default export of the module.
   */
  export default QRious
}

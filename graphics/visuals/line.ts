import { CanvasRenderingInfo, Visual } from "../visual"

export interface LineCreateOptions  {
    lineWidth?: Line["lineWidth"]
    strokeStyle?: Line["strokeStyle"]
}
export class Line extends Visual {
    private readonly normalizedX1
    private readonly normalizedY1
    private readonly normalizedX2
    private readonly normalizedY2
    private readonly lineWidth: CanvasRenderingContext2D["lineWidth"]
    private readonly strokeStyle: CanvasRenderingContext2D["strokeStyle"]

    constructor(
        renderingContext: CanvasRenderingContext2D,
        startX: number, startY: number,
        endX: number, endY: number,
        options?: LineCreateOptions
    ) {
        super()
        const { canvas: { width: canvasWidth, height: canvasHeight } } = renderingContext
        this.normalizedX1 = startX / canvasWidth
        this.normalizedY1 = startY / canvasHeight
        this.normalizedX2 = endX / canvasWidth
        this.normalizedY2 = endY / canvasHeight

        this.lineWidth = options?.lineWidth ?? Visual.Defaults.lineWidth
        this.strokeStyle = options?.strokeStyle ?? Visual.Defaults.strokeStyle
    }
    render({ context, canvasWidth, canvasHeight }: CanvasRenderingInfo) {
        context.lineWidth = this.lineWidth
        context.strokeStyle = this.strokeStyle

        context.beginPath()
        context.moveTo(
            (this.normalizedX1 * canvasWidth) | 0,
            (this.normalizedY1 * canvasHeight) | 0,
        )
        context.lineTo(
            (this.normalizedX2 * canvasWidth) | 0,
            (this.normalizedY2 * canvasHeight) | 0,
        )
        context.stroke()
    }
}

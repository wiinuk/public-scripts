import { textMetricsHeight } from "../../document"
import { CanvasRenderingInfo, Visual } from "../visual"

export interface LabelCreateOptions {
    font?: Label["font"]
    fillStyle?: Label["fillStyle"]
    textAlign?: Label["textAlign"]
    textBaseline?: Label["textBaseline"]
}

export class Label extends Visual {
    private readonly text
    private readonly normalizedX
    private readonly normalizedY

    private readonly font: CanvasRenderingContext2D["font"]
    private readonly fillStyle: CanvasRenderingContext2D["fillStyle"]
    private readonly textAlign: CanvasRenderingContext2D["textAlign"]
    private readonly textBaseline: CanvasRenderingContext2D["textBaseline"]

    readonly width
    readonly height

    constructor (
        renderingContext: CanvasRenderingContext2D,
        text: string,
        x: number,
        y: number,
        options?: LabelCreateOptions
    ) {
        super()
        const { canvas } = renderingContext
        this.text = text
        this.normalizedX = x / canvas.width
        this.normalizedY = y / canvas.height

        this.font = options?.font ?? "0.8rem 'YuGothic', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica', sans-serif"
        this.fillStyle = options?.fillStyle ?? Visual.Defaults.fillStyle
        this.textAlign = options?.textAlign ?? "start"
        this.textBaseline = options?.textBaseline ?? "alphabetic"

        const metrics = renderingContext.measureText(text)
        this.width = metrics.width
        this.height = textMetricsHeight(metrics)
    }
    render({ context, canvasWidth, canvasHeight }: CanvasRenderingInfo) {
        context.font = this.font
        context.fillStyle = this.fillStyle
        context.textAlign = this.textAlign
        context.textBaseline = this.textBaseline
        context.fillText(
            this.text,
            canvasWidth * this.normalizedX,
            canvasHeight * this.normalizedY
        )
    }
}


// spell-checker: ignore Segoe Helvetica
import { CanvasRenderingInfo, Visual } from "../visual"

export interface LabelCreateOptions {
    font?: Label["font"]
    fillStyle?: Label["fillStyle"]
    textAlign?: Label["textAlign"]
    textBaseline?: Label["textBaseline"]
}

export class Label extends Visual {
    private readonly text
    private readonly x
    private readonly y

    private readonly font: CanvasRenderingContext2D["font"]
    private readonly fillStyle: CanvasRenderingContext2D["fillStyle"]
    private readonly textAlign: CanvasRenderingContext2D["textAlign"]
    private readonly textBaseline: CanvasRenderingContext2D["textBaseline"]

    constructor (
        text: string,
        x: number,
        y: number,
        options?: LabelCreateOptions
    ) {
        super()
        this.text = text
        this.x = x
        this.y = y
        this.font = options?.font ?? "0.8rem 'YuGothic', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica', sans-serif"
        this.fillStyle = options?.fillStyle ?? Visual.Defaults.fillStyle
        this.textAlign = options?.textAlign ?? "start"
        this.textBaseline = options?.textBaseline ?? "alphabetic"
    }
    render({ context }: CanvasRenderingInfo) {
        context.font = this.font
        context.fillStyle = this.fillStyle
        context.textAlign = this.textAlign
        context.textBaseline = this.textBaseline
        context.fillText(
            this.text,
            this.x,
            this.y
        )
    }
}

import { CanvasRenderingInfo, Visual } from "../visual"

export interface LineCreateOptions  {
    lineWidth?: Line["lineWidth"]
    strokeStyle?: Line["strokeStyle"]
}
export class Line extends Visual {
    private readonly x1
    private readonly y1
    private readonly x2
    private readonly y2
    private readonly lineWidth: CanvasRenderingContext2D["lineWidth"]
    private readonly strokeStyle: CanvasRenderingContext2D["strokeStyle"]

    constructor(
        startX: number, startY: number,
        endX: number, endY: number,
        options?: LineCreateOptions
    ) {
        super()
        this.x1 = startX
        this.y1 = startY
        this.x2 = endX
        this.y2 = endY

        this.lineWidth = options?.lineWidth ?? Visual.Defaults.lineWidth
        this.strokeStyle = options?.strokeStyle ?? Visual.Defaults.strokeStyle
    }
    render({ context }: CanvasRenderingInfo) {
        context.lineWidth = this.lineWidth
        context.strokeStyle = this.strokeStyle

        context.beginPath()
        context.moveTo(
            this.x1 | 0,
            this.y1 | 0,
        )
        context.lineTo(
            this.x2 | 0,
            this.y2 | 0,
        )
        context.stroke()
    }
}

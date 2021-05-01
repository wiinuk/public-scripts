import { error, exhaustiveCheck } from "../../error"
import { CanvasRenderingInfo, Visual } from "../visual"

interface PolylineCreateOptions {
    lineWidth?: Polyline["lineWidth"]
    strokeStyle?: Polyline["strokeStyle"]
    fillStyle?: Polyline["fillStyle"]
    drawingMode?: PathDrawingMode
}

export const enum SegmentKind {
    Move,
    Line,
}
export interface ReadonlyPathBuffer {
    serialize(): Float64Array
}
export class PathBuffer implements ReadonlyPathBuffer {
    private _segments: number[] = []
    constructor() {}

    moveTo(x: number, y: number) { this._segments.push(SegmentKind.Move, x, y) }
    lineTo(x: number, y: number) { this._segments.push(SegmentKind.Line, x, y) }

    itemKind(index: number) { return this._segments[index * 3] }
    itemX(index: number) { return this._segments[index * 3 + 1] }
    itemY(index: number) { return this._segments[index * 3 + 2] }
    get count() { return this._segments.length / 3 }
    serialize() { return new Float64Array(this._segments) }
}
export const enum PathDrawingMode {
    Fill,
    Stroke,
}
export class Polyline extends Visual {
    private readonly normalizedPath
    private readonly lineWidth: CanvasRenderingContext2D["lineWidth"]
    private readonly strokeStyle: CanvasRenderingContext2D["strokeStyle"]
    private readonly fillStyle: CanvasRenderingContext2D["fillStyle"]
    private readonly drawingMode

    constructor(
        renderingContext: CanvasRenderingContext2D,
        path: ReadonlyPathBuffer,
        options?: PolylineCreateOptions
    ) {
        super()
        const { canvas: { width: canvasWidth, height: canvasHeight } } = renderingContext

        const normalizedPath = this.normalizedPath = path.serialize()
        for (let i = 0, length = normalizedPath.length; i < length; i += 3) {
            normalizedPath[i + 1] /= canvasWidth
            normalizedPath[i + 2] /= canvasHeight
        }
        this.lineWidth = options?.lineWidth ?? Visual.Defaults.lineWidth
        this.strokeStyle = options?.strokeStyle ?? Visual.Defaults.strokeStyle
        this.fillStyle = options?.fillStyle ?? Visual.Defaults.fillStyle
        this.drawingMode = options?.drawingMode ?? PathDrawingMode.Stroke
    }

    render({ context, canvasWidth, canvasHeight }: CanvasRenderingInfo) {
        const { normalizedPath, drawingMode } = this
        context.lineWidth = this.lineWidth
        context.strokeStyle = this.strokeStyle
        context.fillStyle = this.fillStyle

        context.beginPath()
        context.moveTo(0, 0)
        for (let i = 0, length = normalizedPath.length; i < length; i += 3) {
            const kind = normalizedPath[i] as SegmentKind
            const x = normalizedPath[i + 1]! * canvasWidth
            const y = normalizedPath[i + 2]! * canvasHeight

            switch (kind) {
                case SegmentKind.Move:
                    context.moveTo(x, y)
                    break

                case SegmentKind.Line:
                    context.lineTo(x, y)
                    break

                default:
                    exhaustiveCheck(kind)
            }
        }
        switch (drawingMode) {
            case PathDrawingMode.Fill:
                return context.fill()

            case PathDrawingMode.Stroke:
                return context.stroke()

            default:
                exhaustiveCheck(drawingMode)
        }
    }
}

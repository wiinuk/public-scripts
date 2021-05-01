
export interface CanvasRenderingInfo {
    readonly context: CanvasRenderingContext2D
    readonly canvasWidth: number
    readonly canvasHeight: number
}
export abstract class Visual {
    abstract render(renderingInfo: CanvasRenderingInfo): void
    protected static readonly Defaults = {
        fillStyle: "#000",
        lineWidth: 1,
        strokeStyle: "#000",
    } as const
}
export class VisualCollection {
    private readonly visuals: Visual[] = []
    push(visual: Visual) { this.visuals.push(visual) }
    clear() { this.visuals.length = 0 }
    render(renderingInfo: CanvasRenderingInfo) {
        renderingInfo.context.save()
        for (let i = 0, visuals = this.visuals; i < visuals.length; i++) {
            visuals[i]!.render(renderingInfo)
        }
        renderingInfo.context.restore()
    }
}

//spell-checker: ignore Segoe Helvetica
import { Box } from "../box"
import { error } from "../error"
import { collectWeeklyPredications, WeeklyPredictions } from "./detail-data-parser"
import * as ArrayEx from "../array"
import { ready, textMetricsHeight } from "../document"
import { hsvToRgb } from "../color"
import FixedSizeArray from "../fixed-size-array"
import { Label, LabelCreateOptions } from "../graphics/visuals/label"
import { CanvasRenderingInfo, VisualCollection } from "../graphics/visual"
import { Line, LineCreateOptions } from "../graphics/visuals/line"
import { PathBuffer, PathDrawingMode, Polyline } from "../graphics/visuals/polyline"


const createElements = () => {
    const pictureFrame = document.createElement("div")
    const style = pictureFrame.style
    style.width = "100%"
    style.height = "32em"
    style.marginTop = style.marginBottom = "2%"

    const canvas = document.createElement("canvas")
    canvas.style.display = "block"

    pictureFrame.appendChild(canvas)

    return { pictureFrame, canvas }
}

const getMaxAxis = (maxValue: number) => {
    const scale = Math.pow(10, Math.floor(Math.log10(Math.abs(maxValue))))
    return Math.ceil(maxValue / scale) * scale
}

class Plotter {
    private readonly pictureFrame
    private readonly canvas
    private readonly renderingContext

    constructor() {
        const { pictureFrame, canvas } = createElements()
        this.pictureFrame = pictureFrame
        this.canvas = canvas
        this.renderingContext = canvas.getContext("2d") ?? error`2d context`
    }
    get element() { return this.pictureFrame }

    private createLabel(text: string) {
        const font = this.renderingContext.font = "0.8rem 'YuGothic', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica', sans-serif"
        const metrics = this.renderingContext.measureText(text)
        return { text, font, metrics }
    }
    private dataSource: readonly WeeklyPredictions[] = []
    setDataSource(dataSource: readonly WeeklyPredictions[]) {
        this.dataSource = dataSource

        this.updateGraphVisuals()
        this.drawGraph(performance.now())
    }
    setCanvasSize(width: number, height: number) {
        this.canvas.width = width
        this.canvas.height = height

        this.updateGraphVisuals()
        this.drawGraph(performance.now())
    }

    private readonly visuals = new VisualCollection()
    private updateGraphVisuals() {
        const { canvas, visuals, dataSource: predications } = this

        // ????????????????????????????????????
        const canvasBox = Box.create({
            x: 0,
            y: 0,
            width: canvas.width,
            height: canvas.height
        })

        // cc.fillStyle = "rgb(0, 0, 255)"
        // cc.fillRect(0, 0, canvasWidth, canvasHeight)
        canvas.scrollIntoView()

        /** X????????????????????? */
        const scalesX = Array
            .from("??????????????????")
            .flatMap(n => ([`${n}???`, `${n}???`]))
            .map(text => ({ label: this.createLabel(text) }))

        /** ????????????????????? */
        const maxValue = ArrayEx.maxValue(0, predications, p =>
            ArrayEx.maxValue(0, p.values, ([min, max]) => Math.max(min, max))
        )
        /** Y?????????????????????????????? */
        const maxScaleYValue = getMaxAxis(maxValue)
        const scaleY = maxScaleYValue / 4
        /** Y????????????????????? ( ?????? ??? ?????? ) */
        const scalesY = [0, scaleY, scaleY * 2, scaleY * 3, maxScaleYValue]
            .map(value => {
                const text = String(value)
                const label = this.createLabel(text)
                return { value, label }
            })

        /** Y??????????????????????????? ( px ) */
        const maxYLabelWidth = ArrayEx.maxValue(0, scalesY, scale => scale.label.metrics.width)

        /** X?????????????????????????????? ( px ) */
        const maxXLabelHeight = ArrayEx.maxValue(0, scalesX, s => textMetricsHeight(s.label.metrics))

        //  [canvas]
        //  +-----------------------------------+-----------+
        //  |yLabelMargin                       |xLabel-    |
        //  +-----------+-----------------------+Margin     |
        //  |yLabelArea | graphArea             |           |
        //  |           |                       |           |
        //  |           |                       |           |
        //  |           |                       |           |
        //  |           |                       |           |
        //  |           |                       |           |
        //  |           |                       |           |
        //  +-----------+-----------------------+           |
        //  |           | xLabelArea            |           |
        //  +-----------+-----------------------+-----------+
        const [restCanvas0, xLabelMargin] = canvasBox.splitRight(
            ArrayEx.maxValue(0, scalesX, s => s.label.metrics.width / 2)
        )
        // Y????????????????????????????????????????????????????????????
        const [_yLabelMargin, restCanvas1] = restCanvas0.splitTop(
            ArrayEx.maxValue(0, scalesY, s => textMetricsHeight(s.label.metrics))
        )
        const [restCanvas2, xLabelArea0] = restCanvas1.splitBottom(
            maxXLabelHeight + canvasBox.height * 0.05
        )
        const yLabelAreaPadding = xLabelMargin.width
        const [yLabelArea, graphArea] = restCanvas2.splitLeft(maxYLabelWidth + yLabelAreaPadding)
        const [, xLabelArea] = xLabelArea0.splitLeft(yLabelArea.width)

        const getYLabelLineY = (index: number) =>
            yLabelArea.y + (yLabelArea.height - index * (yLabelArea.height / (scalesY.length - 1)))

        visuals.clear()

        // Y??????????????????
        const scaleYLabelOption: LabelCreateOptions = {
            fillStyle: "gray",
            textAlign: "right",
            textBaseline: "middle",
        }
        scalesY.forEach(({ label }, index) => {
            const x = yLabelArea.width - yLabelAreaPadding
            const y = getYLabelLineY(index)
            visuals.push(new Label(
                label.text, x, y,
                scaleYLabelOption
            ))
        })

        // Y??????????????????
        const yLineOptions: LineCreateOptions = {
            lineWidth: 1
        }
        scalesY.forEach((_, index) => {
            if (index === 0) {
                yLineOptions.strokeStyle = "rgba(0, 0, 0, 0.5)"
            }
            else {
                yLineOptions.strokeStyle = "rgba(0, 0, 0, 0.2)"
            }
            const x = yLabelArea.width - yLabelAreaPadding
            const y = getYLabelLineY(index)
            visuals.push(new Line(
                x, y,
                canvasBox.width, y,
                yLineOptions
            ))
        })

        // X??????????????????
        const xScaleLabelOptions: LabelCreateOptions = {
            textAlign: "center",
            textBaseline: "bottom",
            fillStyle: "gray",
        }
        scalesX.forEach(({ label }, index) => {
            const x = xLabelArea.x + (index * (xLabelArea.width / (scalesX.length - 1)))
            const y = canvasBox.height
            visuals.push(new Label(
                label.text,
                x, y,
                xScaleLabelOptions
            ))
        })

        /** ?????????????????? */
        const createPredicationLine = (ps: WeeklyPredictions, h: number, fillMode: boolean = false) => {
            const { values, probability } = ps
            const getPosition = (value: number, index: number): [x: number, y: number] => {
                const x = graphArea.x + index * (graphArea.width / (values.length - 1))
                const y = graphArea.y + graphArea.height - (
                    graphArea.height * (value / maxScaleYValue)
                )
                return [x, y]
            }
            const [, max0] = values[0]
            const [r, g, b] = hsvToRgb(h, 1, 1)

            const path = new PathBuffer()
            path.moveTo(...getPosition(max0, 0))

            values.forEach(([, max], index) => {
                path.lineTo(...getPosition(max, index))
            })

            const [minLast, ] = FixedSizeArray.last(values)
            const pos = getPosition(minLast, values.length - 1)
            if (fillMode) {
                path.lineTo(...pos)
            }
            else {
                path.moveTo(...pos)
            }

            values.concat().reverse().forEach(([min, ], index, values) => {
                path.lineTo(...getPosition(min, values.length - index - 1))
            })

            return new Polyline(path, {
                lineWidth: 1,
                strokeStyle: `rgba(${r}, ${g}, ${b}, 0.2)`,
                fillStyle: `rgba(${r}, ${g}, ${b}, ${0.5 * probability})`,
                drawingMode: fillMode ? PathDrawingMode.Fill : PathDrawingMode.Stroke,
            })
        }
        predications.forEach((ps, index) => {
            const h = (index / predications.length) * 360
            visuals.push(createPredicationLine(ps, h))
            visuals.push(createPredicationLine(ps, h, true))
        })

        console.log(JSON.stringify({
            // maxValue,
            // scalesYLength: scalesY.length,

            // canvasBox,
            // yLabelMargin,
            // xLabelArea,
            yLabelArea,
            // graphArea,
        }))
    }

    private previousTimestampMs = performance.now()
    private drawGraph(nowMs: number) {
        const frameTimeMs = this.previousTimestampMs - nowMs
        this.previousTimestampMs = nowMs

        const { canvas, renderingContext: rc, visuals } = this

        rc.clearRect(0, 0, canvas.width, canvas.height)
        const renderer: CanvasRenderingInfo = {
            context: rc,
            timeSpan: frameTimeMs,
        }
        visuals.render(renderer)
    }
    draw(nowMs: number) {
        this.drawGraph(nowMs)
    }
}

/** ???????????????????????? */
export const setup = () => {
    const plotter = new Plotter()
    const { element: pictureFrame } = plotter

    ready(async () => {

        // ?????????????????????????????????????????????
        const sibling = document.querySelector("#filter") ?? error`#filter`;
        const parent = sibling.parentElement ?? error`parent`
        parent.insertBefore(pictureFrame, sibling.nextSibling);

        // ??????????????????????????????????????????????????????
        const output = document.querySelector("#output") ?? error`#output`

        // ????????????????????????????????????
        new ResizeObserver(() => {
            console.log("?????????????????? ( ???????????????????????? )")
            plotter.setCanvasSize(pictureFrame.offsetWidth, pictureFrame.offsetHeight)
        }).observe(pictureFrame)

        // ????????????????????????
        new MutationObserver(() => {
            console.log("?????????????????? ( ????????????????????? )")
            plotter.setDataSource(collectWeeklyPredications(output))
        }).observe(output, { childList: true, subtree: true })

        // ????????????????????????
        requestAnimationFrame(function loop(nowMs) {
            plotter.draw(nowMs)
            requestAnimationFrame(loop)
        })
    })
}

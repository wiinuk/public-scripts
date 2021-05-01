//spell-checker: ignore Segoe Helvetica
import { Box } from "../box"
import { error } from "../error"
import { collectWeeklyPredications, WeeklyPredictions } from "./detail-data-parser"
import * as ArrayEx from "../array"
import { ready, textMetricsHeight } from "../document"
import { hsvToRgb } from "../color"
import FixedSizeArray from "../fixed-size-array"
import { Label, LabelCreateOptions } from "../graphics/visuals/label"
import { VisualCollection } from "../graphics/visual"
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
    updateCanvasSize() {
        const { canvas, pictureFrame, renderingContext: rc } = this
        canvas.width = pictureFrame.offsetWidth
        canvas.height = pictureFrame.offsetHeight
    }

    private readonly visuals = new VisualCollection()
    createGraphVisuals(predications: readonly WeeklyPredictions[]) {
        const { canvas, renderingContext: rc, visuals } = this
        this.updateCanvasSize()

        // キャンバスの大きさを設定
        const canvasBox = Box.create({
            x: 0,
            y: 0,
            width: canvas.width,
            height: canvas.height
        })

        // cc.fillStyle = "rgb(0, 0, 255)"
        // cc.fillRect(0, 0, canvasWidth, canvasHeight)
        canvas.scrollIntoView()

        /** X軸の目盛り一覧 */
        const scalesX = Array
            .from("月火水木金土")
            .flatMap(n => ([`${n}前`, `${n}後`]))
            .map(text => ({ label: this.createLabel(text) }))

        /** グラフの最大値 */
        const maxValue = ArrayEx.maxValue(0, predications, p =>
            ArrayEx.maxValue(0, p.values, ([min, max]) => Math.max(min, max))
        )
        /** Y軸の最大の目盛りの値 */
        const maxScaleYValue = getMaxAxis(maxValue)
        const scaleY = maxScaleYValue / 4
        /** Y軸の目盛り一覧 ( 最少 ～ 最大 ) */
        const scalesY = [0, scaleY, scaleY * 2, scaleY * 3, maxScaleYValue]
            .map(value => {
                const text = String(value)
                const label = this.createLabel(text)
                return { value, label }
            })

        /** Y軸のラベルの最大幅 ( px ) */
        const maxYLabelWidth = ArrayEx.maxValue(0, scalesY, scale => scale.label.metrics.width)

        /** X軸のラベルの最大高さ ( px ) */
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
        // Y軸ラベルの最大文字高さだけマージンを取る
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

        // Yラベルを作成
        const scaleYLabelOption: LabelCreateOptions = {
            fillStyle: "gray",
            textAlign: "right",
            textBaseline: "middle",
        }
        scalesY.forEach(({ label }, index) => {
            const x = yLabelArea.width - yLabelAreaPadding
            const y = getYLabelLineY(index)
            visuals.push(new Label(
                rc,
                label.text, x, y,
                scaleYLabelOption
            ))
        })

        // Y補助線を作成
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
                rc,
                x, y,
                canvasBox.width, y,
                yLineOptions
            ))
        })

        // Xラベルを作成
        const xScaleLabelOptions: LabelCreateOptions = {
            textAlign: "center",
            textBaseline: "bottom",
            fillStyle: "gray",
        }
        scalesX.forEach(({ label }, index) => {
            const x = xLabelArea.x + (index * (xLabelArea.width / (scalesX.length - 1)))
            const y = canvasBox.height
            visuals.push(new Label(
                rc,
                label.text,
                x, y,
                xScaleLabelOptions
            ))
        })

        /** グラフを作成 */
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

            return new Polyline(rc, path, {
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
    drawGraph(nowMs: number) {
        const frameTimeMs = this.previousTimestampMs - nowMs
        this.previousTimestampMs = nowMs

        const { canvas, renderingContext: rc, visuals } = this

        rc.clearRect(0, 0, canvas.width, canvas.height)
        const renderer = {
            context: rc,
            canvasWidth: canvas.width,
            canvasHeight: canvas.height
        }
        visuals.render(renderer)
    }
}

/** 詳細グラフの描画 */
export const setup = () => {
    const plotter = new Plotter()
    const { element: pictureFrame } = plotter

    ready(async () => {

        // この要素の後にグラフを挿入する
        const sibling = document.querySelector("#filter") ?? error`#filter`;
        const parent = sibling.parentElement ?? error`parent`
        parent.insertBefore(pictureFrame, sibling.nextSibling);

        // グラフの元データが表示されている要素
        const output = document.querySelector("#output") ?? error`#output`

        // 額縁の大きさの変更を検知
        new ResizeObserver(() => {
            console.log("グラフ再描画 ( 額縁のサイズ変更 )")
            plotter.updateCanvasSize()
            plotter.drawGraph(performance.now())
        }).observe(pictureFrame)

        // 出力の変更を検知
        new MutationObserver(() => {
            console.log("グラフ再描画 ( 元データの変更 )")
            plotter.createGraphVisuals(collectWeeklyPredications(output))
        }).observe(output, { childList: true, subtree: true })

        // 定期アップデート
        requestAnimationFrame(function loop(nowMs) {
            plotter.drawGraph(nowMs)
            requestAnimationFrame(loop)
        })
    })
}

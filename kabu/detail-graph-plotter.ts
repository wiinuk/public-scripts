//spell-checker: ignore Segoe Helvetica
import { Box } from "../box"
import { error } from "../error"
import { collectWeeklyPredications, WeeklyPredictions } from "./detail-data-parser"
import * as ArrayEx from "../array"
import { ready, textMetricsHeight } from "../document"
import { hsvToRgb } from "../color"
import FixedSizeArray from "../fixed-size-array"

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
    drawGraph(predications: readonly WeeklyPredictions[]) {
        const { canvas, pictureFrame, renderingContext: rc } = this

        // キャンバスの大きさを設定
        const canvasBox = Box.create({
            x: 0,
            y: 0,
            width: canvas.width = pictureFrame.offsetWidth,
            height: canvas.height = pictureFrame.offsetHeight
        })

        rc.clearRect(0, 0, canvasBox.width, canvasBox.height)

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

        // Yラベルを描画
        rc.fillStyle = "gray"
        rc.textAlign = "right"
        rc.textBaseline = "middle"
        scalesY.forEach(({ label }, index) => {
            const x = yLabelArea.width - yLabelAreaPadding
            const y = getYLabelLineY(index)
            rc.font = label.font
            rc.fillText(label.text, x, y)
        })

        // Y補助線を描画
        rc.lineWidth = 1
        scalesY.forEach((_, index) => {
            if (index === 0) {
                rc.strokeStyle = "rgba(0, 0, 0, 0.5)"
            }
            else {
                rc.strokeStyle = "rgba(0, 0, 0, 0.2)"
            }
            const x = yLabelArea.width - yLabelAreaPadding
            const y = getYLabelLineY(index)
            rc.beginPath()
            rc.moveTo(x | 0, y | 0)
            rc.lineTo(canvasBox.width | 0, y | 0)
            rc.stroke()
        })

        // Xラベルを描画
        rc.textAlign = "center"
        rc.textBaseline = "bottom"
        scalesX.forEach(({ label }, index) => {
            const x = xLabelArea.x + (index * (xLabelArea.width / (scalesX.length - 1)))
            const y = canvasBox.height
            rc.font = label.font
            rc.fillText(label.text, x, y)
        })

        /** グラフを描画 */
        const drawPredicationLine = (ps: WeeklyPredictions, h: number, fillMode: boolean = false) => {
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
            rc.lineWidth = 1
            rc.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.2)`
            rc.fillStyle = `rgba(${r}, ${g}, ${b}, ${0.5 * probability})`
            rc.beginPath()
            rc.moveTo(...getPosition(max0, 0))

            values.forEach(([, max], index) => {
                rc.lineTo(...getPosition(max, index))
            })

            const [minLast, ] = FixedSizeArray.last(values)
            const pos = getPosition(minLast, values.length - 1)
            if (fillMode) {
                rc.lineTo(...pos)
            }
            else {
                rc.moveTo(...pos)
            }

            values.concat().reverse().forEach(([min, ], index, values) => {
                rc.lineTo(...getPosition(min, values.length - index - 1))
            })

            if (fillMode) {
                rc.fill()
            }
            else {
                rc.stroke()
            }
        }
        predications.forEach((ps, index) => {
            const h = (index / predications.length) * 360
            drawPredicationLine(ps, h)
            drawPredicationLine(ps, h, true)
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
            plotter.drawGraph(collectWeeklyPredications(output))
        }).observe(pictureFrame)

        // 出力の変更を検知
        new MutationObserver(() => {
            console.log("グラフ再描画 ( 元データの変更 )")
            plotter.drawGraph(collectWeeklyPredications(output))
        }).observe(output, { childList: true, subtree: true })
    })
}

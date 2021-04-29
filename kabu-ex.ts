//spell-checker: ignore Segoe Helvetica

type MakeFixedSizeArray<Length extends number, T, Tuple extends [...any[]]> =
    Length extends Tuple["length"]
        ? Tuple
        : MakeFixedSizeArray<Length, T, [T, ...Tuple]>

type FixedSizeArray<Length extends number, T> = MakeFixedSizeArray<Length, T, []>

const asFixedSizeArray = <N extends number, T>(length: N, array: T[]) => {
    if (array.length === length) {
        return array as unknown as FixedSizeArray<N, T>
    }
    throw new Error(`length: ${length}, array.length: ${array.length}, array: ${JSON.stringify(array)}`)
}

const fixedSizeArrayLast = <T>(tuple: [T, ...T[]]) => tuple[tuple.length - 1] as T

const error = (message: TemplateStringsArray, ...substitutions: unknown[]) => {
    throw new Error(String.raw(message, ...substitutions))
}

interface BoxCreateOptions {
    x: number
    y: number
    width: number
    height: number
    position?: undefined
    size?: undefined
}
class Box {
    readonly x
    readonly y
    readonly width
    readonly height
    constructor(x: number, y: number, width: number, height: number) {
        this.x = x
        this.y = y
        this.width = width
        this.height = height
    }
    static create(options: BoxCreateOptions) {
        const { x, y, width, height } = options
        return new this(x, y, width, height)
    }

    /**
     * この Box を上と下に分割する。
     * @param topHeight 上の Box の高さ
     */
    splitTop(topHeight: number): [top: Box, bottom: Box] {
        return [
            new Box(this.x, this.y, this.width, topHeight),
            new Box(this.x, this.y + topHeight, this.width, this.height - topHeight)
        ]
    }
    /**
     * この Box を上と下に分割する。
     * @param bottomHeight 下の Box の高さ
     */
    splitBottom(bottomHeight: number): [top: Box, bottom: Box] {
        return [
            new Box(this.x, this.y, this.width, this.height - bottomHeight),
            new Box(this.x, this.y + (this.height - bottomHeight), this.width, bottomHeight)
        ]
    }
    /**
     * この Box を左と右に分割する
     * @param leftWidth 左の Box の幅
     */
    splitLeft(leftWidth: number): [left: Box, right: Box] {
        return [
            new Box(this.x, this.y, leftWidth, this.height),
            new Box(this.x + leftWidth, this.y, this.width - leftWidth, this.height)
        ]
    }
    /**
     * この Box を左と右に分割する
     * @param rightWidth 右の Box の幅
     */
    splitRight(rightWidth: number): [left: Box, right: Box] {
        return [
            new Box(this.x, this.y, this.width - rightWidth, this.height),
            new Box(this.x + (this.width - rightWidth), this.y, rightWidth, this.height)
        ]
    }
}
const getMaxValue = <T, Item>(initialValue: T, items: readonly Item[], mapping: (item: Item) => T) =>
    items.reduce((currentMax, x) => {
        const n = mapping(x)
        if (currentMax < n) { return n }
        return currentMax
    }, initialValue)

const textMetricsHeight = (metrics: TextMetrics) => metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent

const hsvToRgb = (H: number, S: number, V: number) => {
    const
        C = V * S,
        Hp = H / 60,
        X = C * (1 - Math.abs(Hp % 2 - 1))

    let R = 0, G = 0, B = 0
    if (0 <= Hp && Hp < 1) { R = C; G = X; B = 0 }
    if (1 <= Hp && Hp < 2) { R = X; G = C; B = 0 }
    if (2 <= Hp && Hp < 3) { R = 0; G = C; B = X }
    if (3 <= Hp && Hp < 4) { R = 0; G = X; B = C }
    if (4 <= Hp && Hp < 5) { R = X; G = 0; B = C }
    if (5 <= Hp && Hp < 6) { R = C; G = 0; B = X }

    const m = V - C
    R += m
    G += m
    B += m

    R = (R * 255) | 0
    G = (G * 255) | 0
    B = (B * 255) | 0

    return [R, G, B]
}
const ready = (onDocumentLoaded: () => void) => {
    if (document.readyState === "complete") {
        onDocumentLoaded()
    }
    else {
        document.addEventListener("readystatechange", () => {
            if (document.readyState === "complete") {
                onDocumentLoaded()
            }
        })
    }
}

/** 変動型 */
const enum VariantType {
    /** 波型 */
    Wave = "Wave",
    /** 跳ね小型 */
    JumpSmall = "JumpSmall",
    /** 跳ね大型 */
    JumpBig = "JumpBig",
    /** 減少型 */
    Decrease = "Decrease",
    /** 不明 */
    Unknown = "?"
}

/** 週間予測 */
interface WeeklyPredictions {
    /** 変動型 */
    variant: VariantType
    /** 確率 */
    probability: number
    /** 予測値列 ( 日曜午前 ～ 土曜午後 ) */
    values: FixedSizeArray<12, [ min: number, max: number ]>
}

const parseVariant = (s: string) => {
    switch (s) {
        case "波型": return VariantType.Wave
        case "跳ね小型": return VariantType.JumpSmall
        case "跳ね大型": return VariantType.JumpBig
        case "減少型": return VariantType.Decrease
        default: return VariantType.Unknown
    }
}

const collectWeeklyPredications = (outputTBody: Element) =>
    Array.from(outputTBody.querySelectorAll(":scope > tr"))
        .filter(tr => tr.classList.length === 0)
        .map(tr => {
            const [variant = error`variant`, probability = error`probability`, , ...rest] = Array.from(tr.querySelectorAll("td"))
            const values = rest.slice(0, rest.length - 2)

            const result: WeeklyPredictions = {
                variant: parseVariant(variant.innerText.trim()),
                probability: Number(/^\s*(.+)%\s*$/.exec(probability.innerText)?.[1] ?? error`probability`) * 0.01,
                values: asFixedSizeArray(12, values.map(values => {
                    const [, min = error`values.min`, , max = min] = /^\s*(\d+)(~(\d+))?\s*$/.exec(values.innerText) ?? error`values`
                    const result: [min: number, max: number] = [Number(min), Number(max)]
                    return result
                }))
            }
            return result
        })

/** スクロール位置の永続化 */
const setupScrollPositionSerializer = () => {
    const SCROLL_KEY = "__SCROLL"
    ready(() => {
        const top = Number(JSON.parse(localStorage.getItem(SCROLL_KEY) || String(0)))
        window.scrollTo({ top })
    })
    window.addEventListener("scroll", () => {
        localStorage.setItem(SCROLL_KEY, JSON.stringify(window.scrollY))
    })
}

/** 詳細グラフの描画 */
const setupDetailGraphPlotter = () => {
    const createPlotterElements = () => {
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
    const { pictureFrame, canvas } = createPlotterElements()
    const cc = canvas.getContext("2d") ?? error`2d context`

    const getMaxAxis = (maxValue: number) => {
        const scale = Math.pow(10, Math.floor(Math.log10(Math.abs(maxValue))))
        return Math.ceil(maxValue / scale) * scale
    }

    const createLabel = (text: string) => {
        const font = cc.font = "0.8rem 'YuGothic', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica', sans-serif"
        const metrics = cc.measureText(text)
        return { text, font, metrics }
    }
    const drawGraph = (output: Element) => {

        // キャンバスの大きさを設定
        const canvasBox = Box.create({
            x: 0,
            y: 0,
            width: canvas.width = pictureFrame.offsetWidth,
            height: canvas.height = pictureFrame.offsetHeight
        })

        cc.clearRect(0, 0, canvasBox.width, canvasBox.height)

        // cc.fillStyle = "rgb(0, 0, 255)"
        // cc.fillRect(0, 0, canvasWidth, canvasHeight)
        canvas.scrollIntoView()

        /** グラフの元データ */
        const predications = collectWeeklyPredications(output)

        /** X軸の目盛り一覧 */
        const scalesX = Array
            .from("月火水木金土")
            .flatMap(n => ([`${n}前`, `${n}後`]))
            .map(text => ({ label: createLabel(text) }))

        /** グラフの最大値 */
        const maxValue = getMaxValue(0, predications, p =>
            getMaxValue(0, p.values, ([min, max]) => Math.max(min, max))
        )
        /** Y軸の最大の目盛りの値 */
        const maxScaleYValue = getMaxAxis(maxValue)
        const scaleY = maxScaleYValue / 4
        /** Y軸の目盛り一覧 ( 最少 ～ 最大 ) */
        const scalesY = [0, scaleY, scaleY * 2, scaleY * 3, maxScaleYValue]
            .map(value => {
                const text = String(value)
                const label = createLabel(text)
                return { value, label }
            })

        /** Y軸のラベルの最大幅 ( px ) */
        const maxYLabelWidth = getMaxValue(0, scalesY, scale => scale.label.metrics.width)

        /** X軸のラベルの最大高さ ( px ) */
        const maxXLabelHeight = getMaxValue(0, scalesX, s => textMetricsHeight(s.label.metrics))

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
            getMaxValue(0, scalesX, s => s.label.metrics.width / 2)
        )
        // Y軸ラベルの最大文字高さだけマージンを取る
        const [_yLabelMargin, restCanvas1] = restCanvas0.splitTop(
            getMaxValue(0, scalesY, s => textMetricsHeight(s.label.metrics))
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
        cc.fillStyle = "gray"
        cc.textAlign = "right"
        cc.textBaseline = "middle"
        scalesY.forEach(({ label }, index) => {
            const x = yLabelArea.width - yLabelAreaPadding
            const y = getYLabelLineY(index)
            cc.font = label.font
            cc.fillText(label.text, x, y)
        })

        // Y補助線を描画
        cc.lineWidth = 1
        scalesY.forEach((_, index) => {
            if (index === 0) {
                cc.strokeStyle = "rgba(0, 0, 0, 0.5)"
            }
            else {
                cc.strokeStyle = "rgba(0, 0, 0, 0.2)"
            }
            const x = yLabelArea.width - yLabelAreaPadding
            const y = getYLabelLineY(index)
            cc.beginPath()
            cc.moveTo(x | 0, y | 0)
            cc.lineTo(canvasBox.width | 0, y | 0)
            cc.stroke()
        })

        // Xラベルを描画
        cc.textAlign = "center"
        cc.textBaseline = "bottom"
        scalesX.forEach(({ label }, index) => {
            const x = xLabelArea.x + (index * (xLabelArea.width / (scalesX.length - 1)))
            const y = canvasBox.height
            cc.font = label.font
            cc.fillText(label.text, x, y)
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
            cc.lineWidth = 1
            cc.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.2)`
            cc.fillStyle = `rgba(${r}, ${g}, ${b}, ${0.5 * probability})`
            cc.beginPath()
            cc.moveTo(...getPosition(max0, 0))

            values.forEach(([, max], index) => {
                cc.lineTo(...getPosition(max, index))
            })

            const [minLast, ] = fixedSizeArrayLast(values)
            const pos = getPosition(minLast, values.length - 1)
            if (fillMode) {
                cc.lineTo(...pos)
            }
            else {
                cc.moveTo(...pos)
            }

            values.concat().reverse().forEach(([min, ], index, values) => {
                cc.lineTo(...getPosition(min, values.length - index - 1))
            })

            if (fillMode) {
                cc.fill()
            }
            else {
                cc.stroke()
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
            drawGraph(output)
        }).observe(pictureFrame)

        // 出力の変更を検知
        new MutationObserver(() => {
            console.log("グラフ再描画 ( 元データの変更 )")
            drawGraph(output)
        }).observe(output, { childList: true, subtree: true })
    })
}

// setupScrollPositionSerializer()
setupDetailGraphPlotter()

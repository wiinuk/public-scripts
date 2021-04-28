//@ts-check
(() => {
    "use strict";

    /**
     * @template {number} Length
     * @template T
     * @typedef {number extends 0 ? never[] : { 0: T, length: Length } & readonly T[]} FixedSizeArray
     */

    /**
     * @template {number} N
     * @template T
     * @param {N} length
     * @param {T[]} array
     * @returns {FixedSizeArray<N, T>}
     */
    const asFixedSizeArray = (length, array) => {
        if (array.length === length) {
            return /** @type {FixedSizeArray<N, T>} */(/** @type {unknown} */(array))
        }
        throw new Error(`length: ${length}, array.length: ${array.length}, array: ${JSON.stringify(array)}`)
    }

    const timeout = (/** @type {number} */ ms) => new Promise(resolve => setTimeout(resolve, ms))

    /**
     * @param {TemplateStringsArray} message
     * @param  {...unknown} substitutions
     */
    const error = (message, ...substitutions) => {
        throw new Error(String.raw(message, ...substitutions))
    }
    /**
     * @template T
     * @typedef Vector2
     * @property {T} x
     * @property {T} y
     */
    /**
     * @template T
     * @param {T} x
     * @param {T} y
     */
    const vector2 = (x, y) => ({x, y})

    /**
     * @typedef BoxCreateOptions
     * @property {number} x
     * @property {number} y
     * @property {number} width
     * @property {number} height
     * @property {undefined} [position]
     * @property {undefined} [size]
     */
    class Box {
        /**
         * @param {number} x
         * @param {number} y
         * @param {number} width
         * @param {number} height
         */
        constructor(x, y, width, height) {
            this._x = x
            this._y = y
            this._width = width
            this._height = height
        }
        get x() { return this._x }
        get y() { return this._y }
        get width() { return this._width }
        get height() { return this._height }

        /**
         * @param {BoxCreateOptions} options
         */
        static create(options) {
            const { x, y, width, height } = options
            return new this(x, y, width, height)
        }
    }
    /**
     *
     * @template T, Item
     * @param {T} initialValue
     * @param {readonly Item[]} items
     * @param {(item: Item) => T} mapping
     */
    const getMaxValue = (initialValue, items, mapping) =>
        items.reduce((currentMax, x) => {
            const n = mapping(x)
            if (currentMax < n) { return n }
            return currentMax
        }, initialValue)

    const textMetricsHeight = (/** @type {TextMetrics} */ metrics) => metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent
    /**
     * @typedef {"Wave"} WaveType 波型
     * @typedef {"JumpSmall"} JumpSmallType 跳ね小型
     * @typedef {"JumpBig"} JumpBigType 跳ね大型
     * @typedef {"Decrease"} DecreaseType 減少型
     * @typedef {WaveType | JumpSmallType | JumpBigType | DecreaseType | "?"} VariantType 変動型
     */
    /**
     * 週間予測
     * @typedef WeeklyPredictions
     * @property variant {VariantType} 変動型
     * @property probability {number} 確率
     * @property values {FixedSizeArray<12, [ min: number, max: number ]>} 予測値列 ( 日曜午前 ～ 土曜午後 )
     */

    /**
     * @param {string} s
     * @returns {VariantType}
     */
    const parseVariant = s => {
        switch (s) {
            case "波型": return "Wave"
            case "跳ね小型": return "JumpSmall"
            case "跳ね大型": return "JumpBig"
            case "減少型": return "Decrease"
            default: return "?"
        }
    }

    /**
     * @param {Element} outputTBody
     * @returns {Array<WeeklyPredictions>}
     */
    const collectWeeklyPredications = outputTBody =>
        Array.from(outputTBody.querySelectorAll(":scope > tr"))
            .filter(tr => tr.classList.length === 0)
            .map(tr => {
                const [variant = error`variant`, probability = error`probability`, , ...rest] = Array.from(tr.querySelectorAll("td"))
                const values = rest.slice(0, rest.length - 2)

                /** @type {WeeklyPredictions} */
                const result = {
                    variant: parseVariant(variant.innerText.trim()),
                    probability: Number(/^\s*(.+)%\s*$/.exec(probability.innerText)?.[1] ?? error`probability`) * 0.01,
                    values: asFixedSizeArray(12, values.map(values => {
                        const [, min = error`values.min`, , max = min] = /^\s*(\d+)(~(\d+))?\s*$/.exec(values.innerText) ?? error`values`
                        return [Number(min), Number(max)]
                    }))
                }
                return result
            })

    /** スクロール位置の永続化 */
    const setupScrollPositionSerializer = () => {
        const SCROLL_KEY = "__SCROLL"
        window.addEventListener("load", () => {
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
            style.height = "16em"
            style.marginTop = style.marginBottom = "2%"

            const canvas = document.createElement("canvas")
            canvas.style.display = "block"

            pictureFrame.appendChild(canvas)

            return { pictureFrame, canvas }
        }
        const { pictureFrame, canvas } = createPlotterElements()
        const cc = canvas.getContext("2d") ?? error`2d context`

        const getMaxAxis = (/** @type {number} */ maxValue) => {
            const scale = Math.pow(10, Math.floor(Math.log10(Math.abs(maxValue))))
            return Math.ceil(maxValue / scale) * scale
        }
        console.assert(getMaxAxis(20) === 20)
        console.assert(getMaxAxis(19) === 20)
        console.assert(getMaxAxis(11) === 20)
        console.assert(getMaxAxis(10) === 10)
        console.assert(getMaxAxis(200) === 200)
        console.assert(getMaxAxis(199) === 200)
        console.assert(getMaxAxis(101) === 200)
        console.assert(getMaxAxis(100) === 100)

        const createLabel = (/** @type {string} */ text) => {
            const font = cc.font = "0.8rem 'YuGothic', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica', sans-serif"
            const metrics = cc.measureText(text)
            return { text, font, metrics }
        }
        const drawGraph = (/** @type {Element} */ output) => {

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
            const maxScaleY = getMaxAxis(maxValue)
            const scaleY = maxScaleY / 4
            /** Y軸の目盛り一覧 ( 最少 ～ 最大 ) */
            const scalesY = [0, scaleY, scaleY * 2, scaleY * 3, maxScaleY]
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
            //  +-----------------------------------+
            //  |yLabelMargin                       |
            //  +-----------+-----------------------+
            //  |yLabelArea | graphArea             |
            //  |           |                       |
            //  |           |                       |
            //  |           |                       |
            //  |           |                       |
            //  |           |                       |
            //  |           |                       |
            //  +-----------+-----------------------+
            //  |           | xLabelArea            |
            //  +-----------+-----------------------+
            //
            //  [yLabelArea]
            //  +        100+
            //
            //            75
            //
            //            50
            //
            //            25
            //
            //  +          0+
            //
            //  [graphArea]
            //              +-----------------------+
            //
            //              -------------------------
            //
            //              -------------------------
            //
            //              -------------------------
            //
            //              +-----------------------+
            //
            // [xLabelArea]
            //              +                       +
            //              A  B  C  D  E  F  G  H  I
            //              +                       +
            const yLabelMargin = {
                box: Box.create({
                    x: 0, y: 0,
                    width: canvasBox.width,

                    // Y軸ラベルの最大文字高さだけマージンを取る
                    height: getMaxValue(0, scalesY, s => textMetricsHeight(s.label.metrics))
                })
            }
            const xLabelArea = {
                box: Box.create({
                    x: maxYLabelWidth,
                    y: canvasBox.height - maxXLabelHeight,
                    width: canvasBox.width - maxYLabelWidth,

                    height: maxXLabelHeight + canvasBox.height * 0.05
                })
            }
            const yLabelArea = {
                box: Box.create({
                    x: 0,
                    y: yLabelMargin.box.height,
                    width: maxYLabelWidth,
                    height: canvasBox.height - yLabelMargin.box.height - xLabelArea.box.height
                })
            }
            const graphArea = {
                box: Box.create({
                    x: yLabelArea.box.width,
                    y: yLabelMargin.box.height,
                    width: canvasBox.width - yLabelArea.box.width,
                    height: canvasBox.height - yLabelMargin.box.height - xLabelArea.box.height
                })
            }
            const getYLabelLineY = (/** @type {number} */ index) =>
                yLabelArea.box.y + (yLabelArea.box.height - index * (yLabelArea.box.height / (scalesY.length - 1)))

            // Yラベルを描画
            cc.fillStyle = "gray"
            cc.textAlign = "right"
            cc.textBaseline = "middle"
            scalesY.forEach(({ label }, index) => {
                const x = yLabelArea.box.width
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
                const x = yLabelArea.box.width | 0
                const y = getYLabelLineY(index) | 0
                cc.beginPath()
                cc.moveTo(x, y)
                cc.lineTo(canvasBox.width | 0, y)
                cc.stroke()
            })
            // Xラベルを描画
            cc.textAlign = "center"
            cc.textBaseline = "bottom"
            scalesX.forEach(({ label }, index) => {
                const x = yLabelArea.box.width + (index * (xLabelArea.box.width / (scalesX.length - 1)))
                const y = canvasBox.height
                cc.font = label.font
                cc.fillText(label.text, x, y)
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

        window.addEventListener("load", async () => {

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
})()

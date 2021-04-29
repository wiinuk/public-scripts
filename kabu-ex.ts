//spell-checker: ignore kabu
import { ready } from "./document"
import * as DetailGraphPlotter from "./kabu/detail-graph-plotter"

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

// setupScrollPositionSerializer()
DetailGraphPlotter.setup()

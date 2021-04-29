
export const textMetricsHeight = (metrics: TextMetrics) => metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent

export const ready = (onDocumentLoaded: () => void) => {
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

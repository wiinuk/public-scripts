import { error } from "../error"
import FixedSizeArray from "../fixed-size-array"

/** 変動型 */
export const enum VariantType {
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
export interface WeeklyPredictions {
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

export const collectWeeklyPredications = (outputTBody: Element) =>
    Array.from(outputTBody.querySelectorAll(":scope > tr"))
        .filter(tr => tr.classList.length === 0)
        .map(tr => {
            const [variant = error`variant`, probability = error`probability`, , ...rest] = Array.from(tr.querySelectorAll("td"))
            const values = rest.slice(0, rest.length - 2)

            const result: WeeklyPredictions = {
                variant: parseVariant(variant.innerText.trim()),
                probability: Number(/^\s*(.+)%\s*$/.exec(probability.innerText)?.[1] ?? error`probability`) * 0.01,
                values: FixedSizeArray.fromArrayOrError(12, values.map(values => {
                    const [, min = error`values.min`, , max = min] = /^\s*(\d+)(~(\d+))?\s*$/.exec(values.innerText) ?? error`values`
                    const result: [min: number, max: number] = [Number(min), Number(max)]
                    return result
                }))
            }
            return result
        })

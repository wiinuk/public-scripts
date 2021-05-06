import * as String from "./string"
import { kind } from "./types"
import * as N from "./natural"

// ---------- CharStream ----------
export type CharStreamKind = {
    remaining: string
    consumed: string
}
type asStream<T extends CharStreamKind> = T

export type charStreamFromString<source extends string> = asStream<{
    remaining: source
    consumed: ""
}>

export type positionAsNat<stream extends CharStreamKind> = String.lengthAsNat<stream["consumed"]>
export type position<stream extends CharStreamKind> = N.toNumber<positionAsNat<stream>>

// --------- scanners ----------
/** `[ ]*` */
export type skipSpaces<stream extends CharStreamKind> = asStream<
    stream["remaining"] extends ` ${infer remaining}`
    ? skipSpaces<kind<CharStreamKind, {
        consumed: `${stream["consumed"]} `
        remaining: remaining
    }>>
    : stream
>

/** `[^targetChar]` */
export type noneOrUndefined<stream extends CharStreamKind, targetChar extends string> =
    stream["remaining"] extends `${infer char}${infer remaining}`
    ? (
        char extends targetChar
        ? undefined
        : [stream: asStream<{ remaining: remaining, consumed: `${stream["consumed"]}${char}` }>, char: char]
    )
    : undefined

/** `[targetChar]` */
export type anyOrUndefined<stream extends CharStreamKind, targetChar extends string> =
    stream["remaining"] extends `${infer char}${infer remaining}`
    ? (
        char extends targetChar
        ? [stream: asStream<{ remaining: remaining, consumed: `${stream["consumed"]}${char}` }>, char: char]
        : undefined
    )
    : undefined

// ---------- Stream ----------
export interface StreamKind<ItemKind, DiagnosticKind> {
    consumed: ItemKind[]
    remaining: ItemKind[]
    diagnostics: DiagnosticKind[]
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyStreamKind = StreamKind<any, any>

export type streamFromItems<items extends unknown[]> = kind<AnyStreamKind, {
    consumed: []
    remaining: items
    diagnostics: []
}>

export type isEos<stream extends AnyStreamKind> =
    stream["remaining"] extends [] ? true : false

export type pushDiagnostic<stream extends AnyStreamKind, diagnostic> =
    kind<AnyStreamKind, {
        consumed: stream["consumed"]
        remaining: stream["remaining"]
        diagnostics: [...stream["diagnostics"], diagnostic]
    }>

export type takeOrUndefined<stream extends AnyStreamKind> =
    stream["remaining"] extends [infer item, ...infer remaining]
    ? [
        stream: kind<AnyStreamKind, {
            consumed: [...stream["consumed"], item],
            remaining: remaining,
            diagnostics: stream["diagnostics"]
        }>,
        item: item
    ]
    : undefined

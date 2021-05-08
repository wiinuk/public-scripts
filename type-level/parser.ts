import * as String from "./string"
import { kind, unreachable } from "./types"
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
type takeSpacesWorker<spaces extends string, rest extends string> =
    rest extends ` ${infer rest2}`
    ? (
        rest extends `                                ${infer rest}`
        ? takeSpacesWorker<`${spaces}                                `, rest> :
        rest extends `                ${infer rest}`
        ? takeSpacesWorker<`${spaces}                `, rest> :
        rest extends `        ${infer rest}`
        ? takeSpacesWorker<`${spaces}        `, rest> :
        rest extends `    ${infer rest}`
        ? takeSpacesWorker<`${spaces}    `, rest> :
        rest extends `  ${infer rest}`
        ? takeSpacesWorker<`${spaces}  `, rest> :
        takeSpacesWorker<`${spaces} `, rest2>
    )
    : [spaces: spaces, rest: rest]

/** `[ ]*` */
export type skipSpaces<stream extends CharStreamKind> =
    takeSpacesWorker<"", stream["remaining"]> extends [kind<string, infer spaces>, kind<string, infer remaining>]
    ? kind<CharStreamKind, {
        consumed: `${stream["consumed"]}${spaces}`
        remaining: remaining
    }>
    : unreachable

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
export interface StreamKind<ItemKind, DiagnosticKind, ContextKind> {
    consumed: ItemKind[]
    remaining: ItemKind[]
    diagnostics: DiagnosticKind[]
    context: ContextKind
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyStreamKind = StreamKind<any, any, any>

/** @internal */
export type streamFromItems<items extends unknown[], context> = kind<AnyStreamKind, {
    consumed: []
    remaining: items
    diagnostics: []
    context: context
}>

export type isEos<stream extends AnyStreamKind> =
    stream["remaining"] extends [] ? true : false

export type pushDiagnostic<stream extends AnyStreamKind, diagnostic> =
    kind<AnyStreamKind, {
        consumed: stream["consumed"]
        remaining: stream["remaining"]
        diagnostics: [...stream["diagnostics"], diagnostic]
        context: stream["context"]
    }>

export type takeOrUndefined<stream extends AnyStreamKind> =
    stream["remaining"] extends [infer item, ...infer remaining]
    ? [
        stream: kind<AnyStreamKind, {
            consumed: [...stream["consumed"], item],
            remaining: remaining,
            diagnostics: stream["diagnostics"]
            context: stream["context"]
        }>,
        item: item
    ]
    : undefined

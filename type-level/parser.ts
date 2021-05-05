import { Failure, Ok } from "./result"
import * as String from "./string"

// ---------- Error ----------
export type ParseErrorKind = Failure<string, {
    source: string
    position: number
}>
export type parseError<message extends string, stream extends StreamKind> =
    Failure<message, {
        source: `${stream["consumed"]}${stream["remaining"]}`
        position: String.length<stream["consumed"]>
    }>

export type mergeError<stream extends StreamKind, error1 extends ParseErrorKind, error2 extends ParseErrorKind> =
    parseError<`Multiple errors:\n- ${error1["message"]}\n- ${error2["message"]}`, stream>

// ---------- Stream ----------
export type StreamKind = {
    remaining: string,
    consumed: string
}
type asStream<T extends StreamKind> = T

export type streamFromString<source extends string> = asStream<{
    remaining: source
    consumed: ""
}>

export type isEos<stream extends StreamKind> =
    stream["remaining"] extends "" ? true : false

// --------- parsers ----------
/** `[ ]*` */
export type skipSpaces<stream extends StreamKind> = asStream<
    stream["remaining"] extends ` ${infer remaining}`
    ? skipSpaces<{
        consumed: `${stream["consumed"]} `
        remaining: remaining
    }>
    : stream
>

/** `[^targetChar]` */
export type noneOf<stream extends StreamKind, targetChar extends string, customErrorMessage extends string> =
    stream["remaining"] extends `${infer char}${infer remaining}`
    ? (
        char extends targetChar
        ? parseError<customErrorMessage, stream>
        : Ok<[stream: asStream<{ remaining: remaining, consumed: `${stream["consumed"]}${char}` }>, char: char]>
    )
    : parseError<"Any character is required.", stream>

/** `[targetChar]` */
export type anyOf<stream extends StreamKind, targetChar extends string, customErrorMessage extends string> =
    stream["remaining"] extends `${infer char}${infer remaining}`
    ? (
        char extends targetChar
        ? Ok<[stream: asStream<{ remaining: remaining, consumed: `${stream["consumed"]}${char}` }>, char: char]>
        : parseError<customErrorMessage, stream>
    )
    : parseError<customErrorMessage, stream>

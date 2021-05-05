import { Failure, Ok } from "./result"
import * as String from "./string"

// ---------- Error ----------
export type ParseErrorKind = Failure<string, {
    source: string
    position: number
}>
export type parseError<message extends string, stream extends CharStreamKind> =
    Failure<message, {
        source: `${stream["consumed"]}${stream["remaining"]}`
        position: String.length<stream["consumed"]>
    }>

export type mergeError<stream extends CharStreamKind, error1 extends ParseErrorKind, error2 extends ParseErrorKind> =
    parseError<`Multiple errors:\n- ${error1["message"]}\n- ${error2["message"]}`, stream>

// ---------- CharStream ----------
export type CharStreamKind = {
    remaining: string,
    consumed: string
}
type asStream<T extends CharStreamKind> = T

export type charStreamFromString<source extends string> = asStream<{
    remaining: source
    consumed: ""
}>

export type isEos<stream extends CharStreamKind> =
    stream["remaining"] extends "" ? true : false

// --------- parsers ----------
/** `[ ]*` */
export type skipSpaces<stream extends CharStreamKind> = asStream<
    stream["remaining"] extends ` ${infer remaining}`
    ? skipSpaces<{
        consumed: `${stream["consumed"]} `
        remaining: remaining
    }>
    : stream
>

/** `[^targetChar]` */
export type noneOf<stream extends CharStreamKind, targetChar extends string, customErrorMessage extends string> =
    stream["remaining"] extends `${infer char}${infer remaining}`
    ? (
        char extends targetChar
        ? parseError<customErrorMessage, stream>
        : Ok<[stream: asStream<{ remaining: remaining, consumed: `${stream["consumed"]}${char}` }>, char: char]>
    )
    : parseError<"Any character is required.", stream>

/** `[targetChar]` */
export type anyOf<stream extends CharStreamKind, targetChar extends string, customErrorMessage extends string> =
    stream["remaining"] extends `${infer char}${infer remaining}`
    ? (
        char extends targetChar
        ? Ok<[stream: asStream<{ remaining: remaining, consumed: `${stream["consumed"]}${char}` }>, char: char]>
        : parseError<customErrorMessage, stream>
    )
    : parseError<customErrorMessage, stream>

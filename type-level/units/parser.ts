import { cast, equals, kind, unreachable } from "../types"
import { charStreamFromString, isEos, pushDiagnostic, streamFromItems, StreamKind, takeOrUndefined } from "../parser"
import { Int, Integer, IntegerKind, minusSign, plusSign } from "../integer"
import { IdToken, NaturalToken, parseTokens, RangeKind, Range, TokenKind } from "./scanner"
import { Nat, NaturalKind } from "../natural"
import { DimensionlessUnits, UnitsViewKind } from "../../type-safe-units"
import { mul, neg, normalize, UnitsRepresentationKind } from "./representation"
import { Failure } from "../result"
import * as N from "../natural"
import * as String from "../string"
import * as Array from "../array"
import { recursiveKey, unwrapRecursiveObject } from "../recursive-object"

/** @internal */
export interface UnitsDiagnostic<message extends string, range extends RangeKind, data> {
    message: message
    range: range
    data: data
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UnitsDiagnosticKind = UnitsDiagnostic<any, any, any>
type TokenStreamKind = StreamKind<TokenKind, UnitsDiagnosticKind>

/*
 * type source = "-  abc"
 * type stream = { consumed: ["-"], remaining: ["abc"] }
 * の時
 * missingTokenRange<stream> = Range<1, 1>
 */
type missingTokenRange<stream extends TokenStreamKind> =
    stream["consumed"] extends [...infer _, kind<TokenKind, infer latestToken>]
    ? Range<latestToken["range"]["end"], latestToken["range"]["end"]>
    : Range<0, 0>

/** `currentToken["tag"] extends tag` なら true */
type currentTokenKindIs<tag extends TokenKind["tag"], stream extends TokenStreamKind> =
    takeOrUndefined<stream> extends [infer _, kind<TokenKind, infer token>]
    ? (token["tag"] extends tag ? true : false)
    : false

/** `equals<currentToken["tag"], tag>` なら currentToken["value"] を返す */
type takeTokenValueOrUndefined<tag extends TokenKind["tag"], stream extends TokenStreamKind> =
    takeOrUndefined<stream> extends [kind<TokenStreamKind, infer stream2>, kind<TokenKind, infer token>]
    ? (
        equals<token["tag"], tag> extends true
        ? [stream2, token["value"]]
        : undefined
    )
    : undefined

// eslint-disable-next-line @typescript-eslint/ban-types
type report<stream extends TokenStreamKind, message extends string, range extends RangeKind, data = {}> =
    pushDiagnostic<stream, UnitsDiagnostic<message, range, data>>

type anyTokenAsId<token extends TokenKind> = {
    "Id": token extends IdToken<infer id, infer _range> ? id : unreachable
    "Natural": token extends NaturalToken<infer n, infer _range> ? `(${N.toNumber<n>})` : unreachable
    "^": "(^)"
    "/": "(/)"
    "*": "(*)"
    "-": "(-)"
}[token["tag"]]

type takeAnyTokenAsTermOrUndefined<stream extends TokenStreamKind, sentinelTag extends TokenKind["tag"]> =
    takeOrUndefined<stream> extends [infer stream2, kind<TokenKind, infer token>]
    ? (
        token["tag"] extends sentinelTag

        // sentinel
        ? undefined

        // !sentinel . => { id: 1 }
        : [stream2, token, { [k in anyTokenAsId<token>]: Int<1> }]
    )
    // $
    : undefined

/** integer = Minus? Natural */
type parseInteger<stream extends TokenStreamKind> =
    // Minus
    takeTokenValueOrUndefined<"-", stream> extends [kind<TokenStreamKind, infer stream>, infer _]
    ? (
        // Minus Natural
        takeTokenValueOrUndefined<"Natural", stream> extends [infer stream, kind<NaturalKind, infer natural>]
        ? [stream, Integer<minusSign, natural>]

        // Minus !Natural => -1
        : [report<stream, "Number is required.", missingTokenRange<stream>>, Int<-1>]
    )
    : (
        // Natural
        takeTokenValueOrUndefined<"Natural", stream> extends [infer stream, kind<NaturalKind, infer natural>]
        ? [stream, Integer<plusSign, natural>]

        // !Natural => 1
        : [report<stream, "Number is required.", missingTokenRange<stream>>, Int<1>]
    )

/** ascii-exponent = Circumflex integer)` */
type parseAsciiExponent<stream extends TokenStreamKind> =
    takeTokenValueOrUndefined<"^", stream> extends [kind<TokenStreamKind, infer stream>, infer _]

    // Circumflex
    ? parseInteger<stream>

    // !Circumflex => 1
    : [report<stream, "Circumflex ( ^ ) is required.", missingTokenRange<stream>>, Int<1>]

type isAsciiExponentStart<stream extends TokenStreamKind> =
    currentTokenKindIs<"^", stream>

/** exponent = ascii-exponent | Superscript-integer */
type parseExponent<stream extends TokenStreamKind> =
    parseAsciiExponent<stream>

type isExponentStart<stream extends TokenStreamKind> =
    isAsciiExponentStart<stream>

/** term = 1 | Id exponent? */
type parseTerm<stream extends TokenStreamKind> =
    takeTokenValueOrUndefined<"Id", stream> extends [kind<TokenStreamKind, infer stream>, kind<string, infer id>]
    ? (
        isExponentStart<stream> extends true

        // id exponent
        ? (
            parseExponent<stream> extends [kind<TokenStreamKind, infer stream>, kind<IntegerKind, infer exponent>]
            ? [stream, { [k in id]: exponent }]
            : unreachable
        )

        // id !exponent
        : [stream, { [k in id]: Int<1> }]
    )

    : (
        takeTokenValueOrUndefined<"Natural", stream> extends [infer stream, Nat<1>]

        // 1 => {}
        ? [stream, DimensionlessUnits]

        // !(id | 1) => {}
        : [report<stream, "Unit name or 1 ( for dimensionless ) is required.", missingTokenRange<stream>>, DimensionlessUnits]
    )

type isTermStart<stream extends TokenStreamKind> =
    currentTokenKindIs<"Id", stream> extends true
    ? true
    : (
        takeTokenValueOrUndefined<"Natural", stream> extends [infer _stream, Nat<1>]
        ? true
        : false
    )

/** tail-term = Asterisk? term */
type parseTailTerm<stream extends TokenStreamKind> =
    takeTokenValueOrUndefined<"*", stream> extends [kind<TokenStreamKind, infer stream>, infer _]

    // Asterisk
    ? parseTerm<stream>

    // !Asterisk
    : parseTerm<stream>

type isTailTermStart<stream extends TokenStreamKind> =
    currentTokenKindIs<"*", stream> extends true
    ? true
    : isTermStart<stream>

/** tail-terms = tail-term* */
type parseTailTerms<stream extends TokenStreamKind, sentinelTag extends TokenKind["tag"], terms extends UnitsRepresentationKind> =
    isTailTermStart<stream> extends true
    ? (
        // tail-term
        parseTailTerm<stream> extends [kind<TokenStreamKind, infer stream>, kind<UnitsRepresentationKind, infer term>]
        ? parseTailTerms<stream, sentinelTag, mul<terms, term>>
        : unreachable
    )
    : (
        // !(tail-term | sentinel) . => { id: 1 }
        takeAnyTokenAsTermOrUndefined<stream, sentinelTag> extends [kind<TokenStreamKind, infer stream>, kind<TokenKind, infer token>, kind<UnitsRepresentationKind, infer term>]
        ? [report<stream, "Unexpected token. Unit name or 1 is required.", token["range"]>, mul<terms, term>]

        // !tail-term =(sentinel | $)
        : [stream, terms]
    )

/** terms1 = term tail-terms */
type parseTerms1<stream extends TokenStreamKind, sentinelTag extends TokenKind["tag"]> =
    isTermStart<stream> extends true

    // term
    ? (
        parseTerm<stream> extends [kind<TokenStreamKind, infer stream>, kind<UnitsRepresentationKind, infer term0>]
        ? parseTailTerms<stream, sentinelTag, term0>
        : unreachable
    )

    // !(term | sentinel) . => {}
    : [report<stream, "Unit name or 1 ( for dimensionless ) is required.", missingTokenRange<stream>>, DimensionlessUnits]

/** single-fraction-tail = Slash terms1 */
type parseSingleFractionTail<stream extends TokenStreamKind> =
    takeTokenValueOrUndefined<"/", stream> extends [kind<TokenStreamKind, infer stream>, infer _]

    // Slash terms1
    ? parseTerms1<stream, never>

    // !Slash => {}
    : [report<stream, `Fraction symbol ( / ) required.`, missingTokenRange<stream>>, DimensionlessUnits]

type isSingleFractionTailStart<stream extends TokenStreamKind> =
    currentTokenKindIs<"/", stream>

/** units-body = terms1 single-fraction-tail? */
type parseUnitsBody<stream extends TokenStreamKind> =
    parseTerms1<stream, "/"> extends [kind<TokenStreamKind, infer stream2>, kind<UnitsRepresentationKind, infer numeratorTerms>]
    ? (
        isSingleFractionTailStart<stream2> extends true

        // terms1 single-fraction-tail
        ? (
            parseSingleFractionTail<stream2> extends [kind<TokenStreamKind, infer stream3>, kind<UnitsRepresentationKind, infer denominatorTerms>]
            ? [stream3, mul<numeratorTerms, neg<denominatorTerms>>]
            : unreachable
        )

        // terms1 !single-fraction-tail
        : [stream2, numeratorTerms]
    )
    : unreachable

/**
 * units = units-body $
 * @internal
 */
export type parseUnits<stream extends TokenStreamKind> =
    parseUnitsBody<stream> extends [kind<TokenStreamKind, infer stream2>, kind<UnitsRepresentationKind, infer units>]
    ? (
        [isEos<stream2>, stream2["diagnostics"]] extends [false, []]

        // units-body !$ ( 他の診断がない場合 )
        ? [report<stream2, "End of source is required.", missingTokenRange<stream2>>, units]

        // units-body $
        // units-body !$ ( 他の診断がある場合 )
        : [stream2, units]
    )
    : unreachable

interface CharInfo {
    readingMessages: string[]
    sourceChar: string
    trailingMessages: string[]
}
type MessageBufferKind = CharInfo[]

type createMessageBuffer<source extends string> = kind<MessageBufferKind,
    String.toChars<source> extends kind<string[], infer sourceChars>
    ? [
        ...{ [i in keyof sourceChars]: { readingMessages: [], sourceChar: sourceChars[i], trailingMessages: [] } },

        // 診断位置は `ソースの終わりのインデックス + 1` を示すことがある
        { readingMessages: [], sourceChar: "", trailingMessages: [] }
    ]
    : unreachable
>
type messageBufferToString<buffer extends MessageBufferKind> =
    { [i in keyof buffer]:
        buffer[i] extends kind<CharInfo, infer char>
        ? `${String.join<char["readingMessages"], "">}${char["sourceChar"]}${String.join<char["trailingMessages"], "">}`
        : unreachable
    } extends kind<string[], infer messages>
    ? String.join<messages, "">
    : unreachable

type putCharInfo<buffer extends MessageBufferKind, index extends number, info extends CharInfo> = kind<MessageBufferKind,
    { [i in keyof buffer]:
        i extends `${index}`
        ? info
        : buffer[i]
    }
>
type insertReadingMessage<buffer extends MessageBufferKind, index extends number, message extends string> = putCharInfo<buffer, index, {
    readingMessages: [...buffer[index]["readingMessages"], message]
    sourceChar: buffer[index]["sourceChar"]
    trailingMessages: buffer[index]["trailingMessages"]
}>
type insertTrailingMessage<buffer extends MessageBufferKind, index extends number, message extends string> = putCharInfo<buffer, index, {
    readingMessages: buffer[index]["readingMessages"]
    sourceChar: buffer[index]["sourceChar"]
    trailingMessages: [...buffer[index]["trailingMessages"], message]
}>

type asciiChars = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
type unicodeBolds = ["𝟬", "𝟭", "𝟮", "𝟯", "𝟰", "𝟱", "𝟲", "𝟳", "𝟴", "𝟵", "𝗮", "𝗯", "𝗰", "𝗱", "𝗲", "𝗳", "𝗴", "𝗵", "𝗶", "𝗷", "𝗸", "𝗹", "𝗺", "𝗻", "𝗼", "𝗽", "𝗾", "𝗿", "𝘀", "𝘁", "𝘂", "𝘃", "𝘄", "𝘅", "𝘆", "𝘇", "𝗔", "𝗕", "𝗖", "𝗗", "𝗘", "𝗙", "𝗚", "𝗛", "𝗜", "𝗝", "𝗞", "𝗟", "𝗠", "𝗡", "𝗢", "𝗣", "𝗤", "𝗥", "𝗦", "𝗧", "𝗨", "𝗩", "𝗪", "𝗫", "𝗬", "𝗭"]

type CharRow = [char: string, boldChar: string]
interface CharTableEntry { bold: string }
interface CharTable { [char: string]: CharTableEntry }
type charRowsToTable<rows extends CharRow[], result extends CharTable> =
    rows extends [kind<CharRow, infer row>, ...kind<CharRow[], infer rest>]
    ? { [recursiveKey]: charRowsToTable<rest, result & { [k in row[0]]: { bold: row[1] } }> }
    : result

type charTable = unwrapRecursiveObject<charRowsToTable<
    Array.zip<String.toChars<asciiChars>, unicodeBolds>,
    Record<never, never>
>>

type charToBold<char extends string> =
    char extends keyof charTable
    ? charTable[char]["bold"]
    : char

type toBold<source extends string> =
    String.toChars<source> extends kind<string[], infer chars>
    ? String.join<{ [i in keyof chars]: charToBold<cast<string, chars[i]>> }, "">
    : unreachable

type insertMessage<buffer extends MessageBufferKind, range extends RangeKind, message extends string> =
    equals<range["start"], range["end"]> extends true
    ? insertReadingMessage<buffer, range["end"], `🕳👈❮${toBold<message>}❯`>
    : insertTrailingMessage<buffer, range["end"], `👈❮${toBold<message>}❯`>

type pushMessages<remaining extends TokenStreamKind["diagnostics"], buffer extends MessageBufferKind> =
    remaining extends [kind<UnitsDiagnosticKind, infer diagnostic>, ...kind<TokenStreamKind["diagnostics"], infer remaining2>]
    ? pushMessages<
        remaining2,
        insertMessage<buffer, diagnostic["range"], diagnostic["message"]>
    >
    : buffer

type buildErrorMessage<source extends UnitsViewKind, diagnostics extends TokenStreamKind["diagnostics"]> =
    messageBufferToString<pushMessages<diagnostics, createMessageBuffer<source>>>

type tokenStream<source extends string> =
    streamFromItems<parseTokens<charStreamFromString<source>>>

export type unitOrFailure<view extends UnitsViewKind> =
    parseUnits<tokenStream<view>> extends [kind<TokenStreamKind, infer stream>, kind<UnitsRepresentationKind, infer units>]
    ? (
        stream["diagnostics"] extends []
        ? normalize<units>
        : Failure<buildErrorMessage<view, stream["diagnostics"]>, { source: view }>
    )
    : unreachable

export type unitOrNever<view extends UnitsViewKind> =
    cast<UnitsRepresentationKind, unitOrFailure<view>>

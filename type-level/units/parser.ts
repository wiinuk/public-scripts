import { cast, equals, kind, unreachable } from "../types"
import { charStreamFromString, isEos, pushDiagnostic, streamFromItems, StreamKind, takeOrUndefined } from "../parser"
import { Int, Integer, IntegerKind, minusSign, plusSign } from "../integer"
import { IdToken, NaturalToken, parseTokens, RangeKind, Range, TokenKind } from "./scanner"
import { Nat, NaturalKind } from "../natural"
import { DefaultDiagnosticMessageTable, DimensionlessUnits, UnitsViewKind } from "../../type-safe-units"
import { mul, neg, normalize, UnitsRepresentationKind } from "./representation"
import { Failure } from "../result"
import * as N from "../natural"
import { buildErrorMessage } from "./message-builder"

/** @internal */
export interface UnitsDiagnostic<message extends string, range extends RangeKind, data> {
    message: message
    range: range
    data: data
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type UnitsDiagnosticKind = UnitsDiagnostic<any, any, any>
type TokenStreamKind = StreamKind<TokenKind, UnitsDiagnosticKind, ParserContextKind>

export interface ParserContextKind {
    diagnosticMessageTable: { [k in keyof DefaultDiagnosticMessageTable]: string }
}

type MessageIdKind = keyof DefaultDiagnosticMessageTable

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
type report<stream extends TokenStreamKind, messageId extends MessageIdKind, range extends RangeKind, data = {}> =
    pushDiagnostic<stream, UnitsDiagnostic<stream["context"]["diagnosticMessageTable"][messageId], range, data>>

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
        : [report<stream, "Number_is_required", missingTokenRange<stream>>, Int<-1>]
    )
    : (
        // Natural
        takeTokenValueOrUndefined<"Natural", stream> extends [infer stream, kind<NaturalKind, infer natural>]
        ? [stream, Integer<plusSign, natural>]

        // !Natural => 1
        : [report<stream, "Number_is_required", missingTokenRange<stream>>, Int<1>]
    )

/** ascii-exponent = Circumflex integer)` */
type parseAsciiExponent<stream extends TokenStreamKind> =
    takeTokenValueOrUndefined<"^", stream> extends [kind<TokenStreamKind, infer stream>, infer _]

    // Circumflex
    ? parseInteger<stream>

    // !Circumflex => 1
    : [report<stream, "Circumflex_is_required", missingTokenRange<stream>>, Int<1>]

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
        : [report<stream, "Unit_name_or_1_is_required", missingTokenRange<stream>>, DimensionlessUnits]
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
        ? [report<stream, "Unexpected_token__Unit_name_or_1_is_required", token["range"]>, mul<terms, term>]

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
    : [report<stream, "Unit_name_or_1_is_required", missingTokenRange<stream>>, DimensionlessUnits]

/** single-fraction-tail = Slash terms1 */
type parseSingleFractionTail<stream extends TokenStreamKind> =
    takeTokenValueOrUndefined<"/", stream> extends [kind<TokenStreamKind, infer stream>, infer _]

    // Slash terms1
    ? parseTerms1<stream, never>

    // !Slash => {}
    : [report<stream, "Fraction_symbol_required", missingTokenRange<stream>>, DimensionlessUnits]

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
        ? [report<stream2, "End_of_source_is_required", missingTokenRange<stream2>>, units]

        // units-body $
        // units-body !$ ( 他の診断がある場合 )
        : [stream2, units]
    )
    : unreachable

type tokenStream<source extends string, context extends ParserContextKind> =
    streamFromItems<parseTokens<charStreamFromString<source>>, context>

/** @internal */
export type unitOrFailure<view extends UnitsViewKind, context extends ParserContextKind> =
    parseUnits<tokenStream<view, context>> extends [kind<TokenStreamKind, infer stream>, kind<UnitsRepresentationKind, infer units>]
    ? (
        stream["diagnostics"] extends []
        ? normalize<units>
        : Failure<buildErrorMessage<view, stream["diagnostics"]>, { source: view }>
    )
    : unreachable

/** @internal */
export type unitOrNever<view extends UnitsViewKind, context extends ParserContextKind> =
    cast<UnitsRepresentationKind, unitOrFailure<view, context>>

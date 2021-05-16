import { cast, kind, unreachable } from "../types"
import { charStreamFromString, isEos, pushDiagnostic, streamFromItems, StreamKind, takeOrUndefined } from "../parser"
import { Int, Integer, IntegerKind, minusSign, plusSign } from "../integer"
import { IdToken, NaturalToken, parseTokens, RangeKind, Range, TokenKind, IdTokenKind, SymbolToken } from "./scanner"
import { Nat } from "../natural"
import { DimensionlessUnits, UnitsViewKind } from "../../type-safe-units"
import { mul, neg, normalize, UnitsRepresentationKind } from "./representation"
import { Failure } from "../result"
import * as N from "../natural"
import * as Z from "../integer"
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

/** 式 `unitName^1` の省略形 */
export type UnitSimpleAliasKind = string
export type UnitDefinitionKind = null
export type UnitExponentTermKind = [id: string, exponent: IntegerKind]
export type UnitTermKind =
    | UnitSimpleAliasKind
    | UnitExponentTermKind

export type UnitExpressionKind = UnitTermKind[]
export type UnitSpecificationKind =
    | UnitDefinitionKind
    | UnitSimpleAliasKind
    | UnitExpressionKind

export type UnitSystemKind = {
    [name: string]: UnitSpecificationKind
}
export interface ParserContextKind {
    diagnosticMessageTable: { [messageId: string]: string }
    unitSystem: UnitSystemKind
}
type defaultDiagnosticMessageTable = {
    Number_is_required: "Number is required."
    Exponent_symbol_is_required: "Exponent symbol ( ^ ) is required."
    Unit_name_or_1_is_required: "Unit name or '1' ( for dimensionless ) is required."
    Unexpected_token__Unit_name_or_1_is_required: "Unexpected token. Unit name or '1' is required."
    Fraction_symbol_required: "Fraction symbol ( / ) required."
    End_of_source_is_required: "End of source is required."
    Units_include_circular_references: "Units include circular references."
    internal_error: "internal error"
}
type MessageIdKind = keyof defaultDiagnosticMessageTable

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

type getMessageOrDefault<table extends ParserContextKind["diagnosticMessageTable"], id extends MessageIdKind> =
    id extends keyof table
    ? table[id]
    : defaultDiagnosticMessageTable[id]

// eslint-disable-next-line @typescript-eslint/ban-types
type report<stream extends TokenStreamKind, messageId extends MessageIdKind, range extends RangeKind, data = {}> =
    pushDiagnostic<
        stream,
        UnitsDiagnostic<
            getMessageOrDefault<stream["context"]["diagnosticMessageTable"], messageId>,
            range,
            data
        >
    >

interface EvaluatorKind {
    stream: TokenStreamKind
    range: RangeKind
    idToKnownDescendants: { [id: string]: string }
}

type mergeMap<map1, map2> = {
    [k in keyof map1 | keyof map2]:
    k extends keyof map1
    ? (k extends keyof map2 ? map1[k] | map2[k] : map1[k])
    : map2[cast<keyof map2, k>]
}
type getOrUndefined<map, key> = key extends keyof map ? map[key] : undefined
type getOrNever<map, key> = key extends keyof map ? map[key] : never

type addDependency<evaluator extends EvaluatorKind, childId extends string, parentId extends string> = kind<EvaluatorKind, {
    stream: evaluator["stream"]
    range: evaluator["range"]
    idToKnownDescendants: mergeMap<evaluator["idToKnownDescendants"], {
        [k in parentId]: childId | getOrNever<evaluator["idToKnownDescendants"], childId>
    }>
}>

type mulDimensions<expression extends UnitExpressionKind, exponent extends IntegerKind> = cast<UnitExpressionKind, {
    [index in keyof expression]:
    expression[index] extends kind<UnitSimpleAliasKind, infer alias>
    ? kind<UnitTermKind, [alias, exponent]>
    : (
        expression[index] extends kind<UnitExponentTermKind, infer term>
        ? kind<UnitTermKind, [term[0], Z.mul<term[1], exponent>]>
        : unreachable
    )
}>

type takeTermOrUndefined<expression extends UnitExpressionKind> =
    expression extends [kind<UnitSimpleAliasKind, infer alias>, ...infer restExpression]
    ? [alias, Int<1>, restExpression]
    : (
        expression extends [kind<UnitExponentTermKind, infer term>, ...infer restExpression]
        ? [term[0], term[1], restExpression]
        : (
            expression extends []
            ? undefined
            : unreachable
        )
    )

type evaluate<evaluator extends EvaluatorKind, expression extends UnitExpressionKind, result extends UnitsRepresentationKind> =

    // 式の先頭の項 ( 単位名と指数 ) を取り出す
    takeTermOrUndefined<expression> extends [kind<string, infer id>, kind<IntegerKind, infer exponent>, kind<UnitExpressionKind, infer restExpression>]
    ? (
        // 循環参照エラー
        id extends getOrUndefined<evaluator["idToKnownDescendants"], id>
        ? [report<evaluator["stream"], "Units_include_circular_references", evaluator["range"], { id: id }>, result]

        : (
            // 単位名に束縛された式を取り出す
            getOrUndefined<evaluator["stream"]["context"]["unitSystem"], id> extends infer body
            ? (
                // 式は定義だったので戻り値に追加して続ける
                // ( 単位系に未登録の名前は定義とする )
                body extends UnitDefinitionKind | undefined
                ? evaluate<evaluator, restExpression, mul<{ [k in id]: exponent }, result>>

                : (
                    // 式は名前だったので式を書き換えて続ける
                    // 例: `m = metre`
                    body extends UnitSimpleAliasKind
                    ? evaluate<addDependency<evaluator, id, body>, [[body, exponent], ...restExpression], result>

                    : (
                        // 式は複雑な式だったので式を書き換えて続ける
                        // 例: `W = kg m^2 s^−3`
                        body extends UnitExpressionKind
                        ? evaluate<addDependency<evaluator, id, body[number][0]>, [...mulDimensions<body, exponent>, ...restExpression], result>

                        // 不明な単位式 ( 内部エラー )
                        : [report<evaluator["stream"], "internal_error", evaluator["range"], "unknown unit spec">, result]
                    )
                )
            )
            : unreachable
        )
    )

    // 全ての項を変換できたので終わり
    : [evaluator["stream"], result]

type resolveId<stream extends TokenStreamKind, id extends string, range extends RangeKind, exponent extends IntegerKind> =
    // eslint-disable-next-line @typescript-eslint/ban-types
    evaluate<{ stream: stream, range: range, idToKnownDescendants: {} }, [[id, exponent]], DimensionlessUnits>

type anyTokenAsId<token extends TokenKind> = {
    "Id": token extends IdToken<infer id, infer _range> ? id : unreachable
    "Natural": token extends NaturalToken<infer n, infer _range> ? `(${N.toNumber<n>})` : unreachable
    "^": "(^)"
    "/": "(/)"
    "*": "(*)"
    "-": "(-)"
}[token["tag"]]

type takeAnyTokenAsTermOrUndefined<stream extends TokenStreamKind, sentinelTag extends TokenKind["tag"]> =
    takeOrUndefined<stream> extends [kind<TokenStreamKind, infer stream2>, kind<TokenKind, infer token>]
    ? (
        token["tag"] extends sentinelTag

        // sentinel
        ? undefined

        // !sentinel . => { id: 1 }
        : (
            resolveId<stream2, anyTokenAsId<token>, token["range"], Int<1>> extends [infer stream3, infer term]
            ? [stream3, token, term]
            : unreachable
        )

    )
    // $
    : undefined

/** integer = Minus? Natural */
type parseInteger<stream extends TokenStreamKind> =
    // Minus
    takeOrUndefined<stream> extends [kind<TokenStreamKind, infer stream>, SymbolToken<"-", RangeKind>]
    ? (
        // Minus Natural
        takeOrUndefined<stream> extends [infer stream, NaturalToken<infer natural, RangeKind>]
        ? [stream, Integer<minusSign, natural>]

        // Minus !Natural => -1
        : [report<stream, "Number_is_required", missingTokenRange<stream>>, Int<-1>]
    )
    : (
        // Natural
        takeOrUndefined<stream> extends [infer stream, NaturalToken<infer natural, RangeKind>]
        ? [stream, Integer<plusSign, natural>]

        // !Natural => 1
        : [report<stream, "Number_is_required", missingTokenRange<stream>>, Int<1>]
    )

/** ascii-exponent = Circumflex integer)` */
type parseAsciiExponent<stream extends TokenStreamKind> =
    takeOrUndefined<stream> extends [kind<TokenStreamKind, infer stream>, SymbolToken<"^", RangeKind>]

    // Circumflex
    ? parseInteger<stream>

    // !Circumflex => 1
    : [report<stream, "Exponent_symbol_is_required", missingTokenRange<stream>>, Int<1>]

type isAsciiExponentStart<stream extends TokenStreamKind> =
    currentTokenKindIs<"^", stream>

/** exponent = ascii-exponent | Superscript-integer */
type parseExponent<stream extends TokenStreamKind> =
    parseAsciiExponent<stream>

type isExponentStart<stream extends TokenStreamKind> =
    isAsciiExponentStart<stream>

/** term = 1 | Id exponent? */
type parseTerm<stream extends TokenStreamKind> =
    takeOrUndefined<stream> extends [kind<TokenStreamKind, infer stream>, kind<IdTokenKind, infer idToken>]
    ? (
        isExponentStart<stream> extends true

        // id exponent
        ? (
            parseExponent<stream> extends [kind<TokenStreamKind, infer stream>, kind<IntegerKind, infer exponent>]
            ? resolveId<stream, idToken["value"], idToken["range"], exponent>
            : unreachable
        )

        // id !exponent
        : resolveId<stream, idToken["value"], idToken["range"], Int<1>>
    )

    : (
        takeOrUndefined<stream> extends [infer stream, NaturalToken<Nat<1>, RangeKind>]

        // 1 => {}
        ? [stream, DimensionlessUnits]

        // !(id | 1) => {}
        : [report<stream, "Unit_name_or_1_is_required", missingTokenRange<stream>>, DimensionlessUnits]
    )

type isTermStart<stream extends TokenStreamKind> =
    currentTokenKindIs<"Id", stream> extends true
    ? true
    : (
        takeOrUndefined<stream> extends [TokenStreamKind, NaturalToken<Nat<1>, RangeKind>]
        ? true
        : false
    )

/** tail-term = Asterisk? term */
type parseTailTerm<stream extends TokenStreamKind> =
    takeOrUndefined<stream> extends [kind<TokenStreamKind, infer stream>, SymbolToken<"*", RangeKind>]

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
    takeOrUndefined<stream> extends [kind<TokenStreamKind, infer stream>, SymbolToken<"/", RangeKind>]

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

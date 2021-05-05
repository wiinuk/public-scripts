import { cast, equals, kind, unreachable } from "../types"
import { anyOf, isEos, mergeError, noneOf, parseError, ParseErrorKind, skipSpaces, streamFromString, StreamKind } from "../parser"
import { Failure, Ok, ResultKind, Success } from "../result"
import * as N from "../natural"
import { NaturalKind, Nat } from "../natural"
import * as Z from "../integer"
import { Int } from "../integer"
import { DimensionlessUnits, UnitsViewKind } from "../../type-safe-units"
import { assert } from "../assert"
import { mul, neg, normalize, UnitsRepresentationKind } from "./representation"
import * as Syntax from "./syntax"


type asciiDigits = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9"
type minus = "-"
type exponentSymbol = "^"
type termJoiner = "*"
type fractionSymbol = "/"

type nonIdChars =

    // integer
    | asciiDigits
    | minus

    // unicode-superscript-integer
    | Syntax.superscript0To9[number]
    | Syntax.superscriptMinus

    // exponent
    | exponentSymbol

    // single-fraction-tail
    | fractionSymbol

    // terms
    | termJoiner

    // spaces
    | " "

/** `(?<id-char> (?! \k<integer> | \k<unicode-superscript-integer> | [\^/*] | \k<spaces> ) .)` */
type parseIdChar<stream extends StreamKind> =
    noneOf<stream, nonIdChars, "Numbers and symbols cannot be used as identifiers.">

/** `(?<id-chars0> \k<id-char>*)` */
type parseIdChars0<stream extends StreamKind, chars extends string> =
    parseIdChar<stream> extends Ok<[kind<StreamKind, infer stream>, kind<string, infer char>]>
    ? parseIdChars0<stream, `${chars}${char}`>
    : Ok<[stream: stream, id: chars]>

/** `(?<id> \k<spaces> \k<id-char> \k<id-chars0>)` */
type parseId<stream extends StreamKind> =
    parseIdChar<skipSpaces<stream>> extends infer result
    ? (
        result extends Ok<[kind<StreamKind, infer stream>, kind<string, infer char0>]>
        ? parseIdChars0<stream, char0>
        : result
    )
    : unreachable

// TODO
type digitCharToNat = {
    "0": Nat<0>
    "1": Nat<1>
    "2": Nat<2>
    "3": Nat<3>
    "4": Nat<4>
    "5": Nat<5>
    "6": Nat<6>
    "7": Nat<7>
    "8": Nat<8>
    "9": Nat<9>
}
/** `(?<digit> [0-9])` */
type parseDigit<stream extends StreamKind> =
    anyOf<stream, asciiDigits, "Numbers ( 0 to 9 ) are required."> extends infer result
    ? (
        result extends Ok<[infer stream, kind<asciiDigits, infer digitChar>]>
        ? Ok<[stream, digitCharToNat[digitChar]]>
        : result
    )
    : unreachable

type _10N = N.add<Nat<9>, Nat<1>>

/** `(?<digits0> \k<digit>*)` */
type parseDigits0<stream extends StreamKind, sign extends Z.SignKind, current extends NaturalKind> =
    parseDigit<stream> extends Ok<[kind<StreamKind, infer stream>, kind<NaturalKind, infer digit>]>
    ? parseDigits0<stream, sign, N.add<N.mul<current, _10N>, digit>>
    : Ok<[stream, Z.Integer<sign, current>]>

/** `(?<digits1> \k<digit> \k<digits0>)` */
type parseDigits1<stream extends StreamKind, sign extends Z.SignKind, current extends NaturalKind> =
    parseDigit<stream> extends infer result
    ? (
        result extends Ok<[kind<StreamKind, infer stream>, kind<NaturalKind, infer digit>]>
        ? parseDigits0<stream, sign, N.add<N.mul<current, _10N>, digit>>
        : result
    )
    : unreachable

/** `(?<integer> \k<spaces> \-? \k<digits1>)` */
type parseInteger<stream extends StreamKind> =
    skipSpaces<stream> extends kind<StreamKind, infer stream2>
    ? (
        anyOf<stream2, minus, "A minus sign ( - ) is required."> extends Ok<[kind<StreamKind, infer stream3>, infer _char]>
        ? parseDigits1<stream3, "-", Nat<0>>
        : parseDigits1<stream2, "+", Nat<0>>
    )
    : unreachable

/** `(?<ascii-exponent> \k<spaces> \^ \k<spaces> \k<integer>)` */
type parseAsciiExponent<stream extends StreamKind> =
    anyOf<skipSpaces<stream>, exponentSymbol, "The exponent symbol ( ^ ) is required."> extends infer result
    ? (
        result extends Success<[kind<StreamKind, infer stream2>, infer _char]>
        ? parseInteger<skipSpaces<stream2>>
        : result
    )
    : unreachable


/**
```regexp
(?<unicode-superscript-integer>
    \k<spaces>
    \u207b? (?# "⁻" SUPERSCRIPT MINUS )
    [
        \u2070  (?# "⁰" SUPERSCRIPT ZERO )
        \u00b9  (?# "¹" SUPERSCRIPT ONE )
        \u00b2  (?# "²" SUPERSCRIPT TWO )
        \u00b3  (?# "³" SUPERSCRIPT THREE )
        \u2074- (?# "⁴" SUPERSCRIPT FOUR )
        \u2079  (?# "⁹" SUPERSCRIPT NINE )
    ]+
)
```
*/
type parseUnicodeSuperscriptInteger<stream extends StreamKind> =
    parseError<"TODO", stream>

/** `(?<exponent> \k<ascii-exponent> | \k<unicode-superscript-integer>)` */
type parseExponent<stream extends StreamKind> =
    parseAsciiExponent<stream> extends infer asciiExponentResult
    ? (
        asciiExponentResult extends ParseErrorKind
        ? (
            parseUnicodeSuperscriptInteger<stream> extends infer unicodeSuperscriptResult
            ? (
                unicodeSuperscriptResult extends ParseErrorKind
                ? mergeError<stream, asciiExponentResult, unicodeSuperscriptResult>
                : unicodeSuperscriptResult
            )
            : unreachable
        )
        : asciiExponentResult
    )
    : unreachable

/** `(?<term> \k<id> \k<exponent>?)` */
type parseTerm<stream extends StreamKind> =
    parseId<stream> extends infer idResult
    ? (
        idResult extends Ok<[kind<StreamKind, infer stream>, kind<string, infer id>]>
        ? (
            parseExponent<stream> extends Ok<[infer stream, infer exponent]>
            ? Ok<[stream, { [k in id]: exponent }]>
            : Ok<[stream, { [k in id]: Int<1> }]>
        )
        : idResult
    )
    : unreachable

/** (?<tail-term> (\k<spaces> \*)? \k<term>) */
type parseTailTerm<stream extends StreamKind> =
    anyOf<skipSpaces<stream>, termJoiner, "A term joiner ( * ) is required."> extends Ok<[kind<StreamKind, infer stream>, infer _char]>
    ? parseTerm<stream>
    : parseTerm<stream>

/** `(?<tail-terms> ?<tail-term>*)` */
type parseTailTerms<stream extends StreamKind, terms extends UnitsRepresentationKind> =
    parseTailTerm<stream> extends Ok<[kind<StreamKind, infer stream2>, kind<UnitsRepresentationKind, infer term>]>
    ? parseTailTerms<stream2, mul<terms, term>>
    : Ok<[stream, terms]>

/** `(?<terms1> \k<term> \k<tail-terms>)` */
type parseTerms1<stream extends StreamKind> =
    parseTerm<stream> extends infer result
    ? (
        result extends Ok<[kind<StreamKind, infer stream>, kind<UnitsRepresentationKind, infer term0>]>
        ? parseTailTerms<stream, term0>
        : result
    )
    : unreachable

/** `(?<terms0> \k<terms1>?)` */
type parseTerms0<stream extends StreamKind> =
    parseTerms1<stream> extends Success<infer value>
    ? Ok<value>
    : Ok<[stream, DimensionlessUnits]>

/** `(?<single-fraction-tail> \k<spaces> / \k<terms0>)` */
type parseSingleFractionTail<stream extends StreamKind> =
    anyOf<skipSpaces<stream>, "/", "Fraction symbol required."> extends infer result
    ? (
        result extends Ok<[kind<StreamKind, infer stream>, infer _char]>
        ? parseTerms0<stream>
        : result
    )
    : unreachable

/** `(?<units-body> \k<terms0> \k<single-fraction-tail>?)` */
type parseUnitsBody<stream extends StreamKind> =
    parseTerms0<stream> extends infer termsResult
    ? (
        termsResult extends Ok<[kind<StreamKind, infer stream>, kind<UnitsRepresentationKind, infer numeratorTerms>]>
        ? (
            parseSingleFractionTail<stream> extends Ok<[infer stream, kind<UnitsRepresentationKind, infer denominatorTerms>]>
            ? Ok<[stream, mul<numeratorTerms, neg<denominatorTerms>>]>
            : Ok<[stream, numeratorTerms]>
        )
        : termsResult
    )
    : unreachable

/** `(?<units> \k<units-body> \k<spaces> $)` */
type parseUnits<stream extends StreamKind> =
    parseUnitsBody<stream> extends infer unitsResult
    ? (
        unitsResult extends Ok<[kind<StreamKind, infer stream2>, infer terms]>
        ? (
            skipSpaces<stream2> extends kind<StreamKind, infer stream3>
            ? (
                isEos<stream3> extends true
                ? Ok<[stream3, terms]>
                : parseError<"End of string is required.", stream3>
            )
            : unreachable
        )
        : unitsResult
    )
    : unreachable

() => {
    type parsed<s extends ResultKind> =
        s extends Success<[unknown, infer value]>
        ? value
        : s

    assert<equals<
        parsed<parseId<streamFromString<" a 123">>>,
        "a"
    >>()

    assert<equals<
        parsed<parseId<streamFromString<" 123">>>,
        Failure<"Numbers and symbols cannot be used as identifiers.", {
            source: " 123";
            position: 1;
        }>
    >>()

    assert<equals<
        parsed<parseDigit<streamFromString<"0">>>,
        Nat<0>
    >>()
    assert<equals<
        parsed<parseDigit<streamFromString<"9">>>,
        Nat<9>
    >>()
    assert<equals<
        parsed<parseDigit<streamFromString<"a">>>,
        Failure<"Numbers ( 0 to 9 ) are required.", {
            source: "a";
            position: 0;
        }>
    >>()


    assert<equals<
        parsed<parseInteger<streamFromString<"0">>>,
        Int<0>
    >>()
    assert<equals<
        parsed<parseInteger<streamFromString<"-0">>>,
        Int<0>
    >>()

    assert<equals<
        parsed<parseInteger<streamFromString<"001">>>,
        Int<1>
    >>()
    type _m12 = Z.sub<Int<0>, Z.add<Int<6>, Int<6>>>
    assert<equals<
        parsed<parseInteger<streamFromString<" -0012">>>,
        _m12
    >>()

    assert<equals<
        parsed<parseInteger<streamFromString<"">>>,
        Failure<"Numbers ( 0 to 9 ) are required.", {
            source: "";
            position: 0;
        }>
    >>()
    assert<equals<
        parsed<parseInteger<streamFromString<"-">>>,
        Failure<"Numbers ( 0 to 9 ) are required.", {
            source: "-";
            position: 1;
        }>
    >>()

    assert<equals<
        parsed<parseAsciiExponent<streamFromString<"^-1">>>,
        Int<-1>
    >>()

    assert<equals<
        parsed<parseTerm<streamFromString<"m">>>,
        { m: Int<1> }
    >>()
    assert<equals<
        parsed<parseTerm<streamFromString<" s ^ -6">>>,
        { s: Int<-6> }
    >>()

    assert<equals<
        parsed<parseTerms0<streamFromString<"">>>,
        DimensionlessUnits
    >>()

    assert<equals<
        parsed<parseTerms0<streamFromString<"m s^-2">>>,
        { m: Int<1>, s: Int<-2> }
    >>()
    assert<equals<
        parsed<parseTerms0<streamFromString<"m123">>>,
        { m: Int<1> }
    >>()

    assert<equals<
        parsed<parseUnits<streamFromString<"m s^-2">>>,
        { m: Int<1>, s: Int<-2> }
    >>()
    assert<equals<
        parsed<parseUnits<streamFromString<"s m^-2">>>,
        parsed<parseUnits<streamFromString<"s * m^-2">>>
    >>()
    assert<equals<
        parsed<parseUnits<streamFromString<"m m">>>,
        { m: Int<2> }
    >>()
    assert<equals<
        parsed<parseUnits<streamFromString<"m/s^2">>>,
        { m: Int<1>, s: Int<-2> }
    >>()
    assert<equals<
        parsed<parseUnits<streamFromString<"s^">>>,
        Failure<"End of string is required.", {
            source: "s^";
            position: 1;
        }>
    >>()
    assert<equals<
        parsed<parseUnits<streamFromString<"/s">>>,
        { s: Int<-1> }
    >>()
    assert<equals<
        parsed<parseUnits<streamFromString<"m/">>>,
        { m: Int<1> }
    >>()
    assert<equals<
        parsed<parseUnits<streamFromString<"m/s/s">>>,
        Failure<"End of string is required.", {
            source: "m/s/s";
            position: 3;
        }>
    >>()
}

export type unitOrFailure<view extends UnitsViewKind> =
    parseUnits<streamFromString<view>> extends infer parseResult
    ? (
        parseResult extends Ok<[infer _stream, kind<UnitsRepresentationKind, infer value>]>
        ? normalize<value>
        : parseResult
    )
    : unreachable

export type unitOrNever<view extends UnitsViewKind> =
    cast<UnitsRepresentationKind, unitOrFailure<view>>

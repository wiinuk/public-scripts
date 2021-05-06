import { cast, equals, kind, unreachable } from "../types"
import { anyOrUndefined, noneOrUndefined, skipSpaces, charStreamFromString, CharStreamKind, position, positionAsNat } from "../parser"
import * as N from "../natural"
import { NaturalKind, Nat } from "../natural"
import { assert } from "../assert"
import * as Syntax from "./syntax"

interface Range<start extends number, end extends number> {
    start: start
    end: end
}
type RangeKind = Range<number, number>

interface Token<tag extends string, value, range extends RangeKind> {
    tag: tag
    value: value
    range: range
}
type SymbolToken<op extends symbols, range extends RangeKind> = Token<op, undefined, range>
type SymbolTokenKind = SymbolToken<symbols, RangeKind>
export type NaturalToken<value extends NaturalKind, range extends RangeKind> = Token<"Natural", value, range>
export type NaturalTokenKind = NaturalToken<NaturalKind, RangeKind>
export type IdToken<value extends string, range extends RangeKind> = Token<"Id", value, range>
export type IdTokenKind = IdToken<string, RangeKind>

export type TokenKind =
    | SymbolTokenKind
    | NaturalTokenKind
    | IdTokenKind

type asciiDigits = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9"
type minus = "-"
type circumflex = "^"
type asterisk = "*"
type slash = "/"
type symbols =
    | minus
    | circumflex
    | asterisk
    | slash

type nonIdChars =

    // integer
    | asciiDigits
    | minus

    // unicode-superscript-integer
    | Syntax.superscript0To9[number]
    | Syntax.superscriptMinus

    // exponent
    | circumflex

    // single-fraction-tail
    | slash

    // terms
    | asterisk

    // spaces
    | " "

/** `(?<id-char> (?! \k<integer> | \k<unicode-superscript-integer> | [\^/*\-] | \k<spaces> ) .)` */
type parseIdChar<stream extends CharStreamKind> =
    noneOrUndefined<stream, nonIdChars>

/** `(?<id-chars0> \k<id-char>*)` */
type parseIdChars0<stream extends CharStreamKind, chars extends string> =
    parseIdChar<stream> extends [kind<CharStreamKind, infer stream>, kind<string, infer char>]
    ? parseIdChars0<stream, `${chars}${char}`>
    : [stream: stream, id: chars]

/** `(?<id> \k<id-char> \k<id-chars0>)` */
type parseId<stream extends CharStreamKind> =
    parseIdChar<stream> extends [kind<CharStreamKind, infer stream2>, kind<string, infer char0>]
    ? parseIdChars0<stream2, char0>
    : undefined

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
type parseDigit<stream extends CharStreamKind> =
    anyOrUndefined<stream, asciiDigits> extends [infer stream2, kind<asciiDigits, infer digitChar>]
    ? [stream2, digitCharToNat[digitChar]]
    : undefined

type _10N = N.add<Nat<9>, Nat<1>>

/** `(?<digits0> \k<digit>*)` */
type parseDigits0<stream extends CharStreamKind, current extends NaturalKind> =
    parseDigit<stream> extends [kind<CharStreamKind, infer stream>, kind<NaturalKind, infer digit>]
    ? parseDigits0<stream, N.add<N.mul<current, _10N>, digit>>
    : [stream, current]

/** `(?<digits1> \k<digit> \k<digits0>)` */
type parseNatural<stream extends CharStreamKind, current extends NaturalKind> =
    parseDigit<stream> extends [kind<CharStreamKind, infer stream2>, kind<NaturalKind, infer digit>]
    ? parseDigits0<stream2, N.add<N.mul<current, _10N>, digit>>
    : undefined

/* `(?<integer> \-? \k<digits1>)` */
// type parseInteger<stream extends CharStreamKind> =
//     anyOrUndefined<stream, minus> extends [kind<CharStreamKind, infer stream3>, infer _char]
//     ? parseDigits1<stream3, "-", Nat<0>>
//     : parseDigits1<stream, "+", Nat<0>>

/**
```regexp
(?<unicode-superscript-integer>
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
type parseUnicodeSuperscriptInteger<stream extends CharStreamKind> =
    undefined

type peekCharOrUndefined<stream extends CharStreamKind> =
    stream["remaining"] extends `${infer char}${infer _remaining}` ? char : undefined

type skipCharOrNop<stream extends CharStreamKind> =
    stream["remaining"] extends `${infer char}${infer remaining}`
    ? kind<CharStreamKind, { remaining: remaining, consumed: `${stream["consumed"]}${char}` }>
    : stream

type parseTokensWorker<stream extends CharStreamKind> =
    peekCharOrUndefined<stream> extends kind<string, infer char>
    ? (
        char extends symbols
        ? [
            cast<TokenKind,
                Token<
                    char,
                    undefined,
                    Range<
                        position<stream>,
                        N.toNumber<N.add<positionAsNat<stream>, Nat<1>>>
                    >
                >
            >,
            ...parseTokensWorker<skipSpaces<skipCharOrNop<stream>>>
        ]
        : (
            char extends asciiDigits
            ? (
                parseNatural<stream, Nat<0>> extends [kind<CharStreamKind, infer stream2>, kind<NaturalKind, infer natural>]
                ? [kind<NaturalTokenKind, NaturalToken<natural, Range<position<stream>, position<stream2>>>>, ...parseTokensWorker<skipSpaces<stream2>>]
                : unreachable
            )
            : (
                parseId<stream> extends [kind<CharStreamKind, infer stream2>, kind<string, infer id>]
                ? [kind<IdTokenKind, IdToken<id, Range<position<stream>, position<stream2>>>>, ...parseTokensWorker<skipSpaces<stream2>>]
                : unreachable
            )
        )
    )
    : []

export type parseTokens<stream extends CharStreamKind> = parseTokensWorker<skipSpaces<stream>>

() => {
    type parsed<s> =
        s extends [infer _, infer value]
        ? value
        : s

    assert<equals<
        parsed<parseId<charStreamFromString<"a 123">>>,
        "a"
    >>()

    assert<equals<
        parsed<parseId<skipSpaces<charStreamFromString<" 123">>>>,
        undefined
    >>()

    assert<equals<
        parsed<parseDigit<charStreamFromString<"0">>>,
        Nat<0>
    >>()
    assert<equals<
        parsed<parseDigit<charStreamFromString<"9">>>,
        Nat<9>
    >>()
    assert<equals<
        parsed<parseDigit<charStreamFromString<"a">>>,
        undefined
    >>()


    assert<equals<
        parsed<parseNatural<charStreamFromString<"0">, Nat<0>>>,
        Nat<0>
    >>()

    assert<equals<
        parseTokens<charStreamFromString<"-0">>,
        [SymbolToken<minus, Range<0, 1>>, NaturalToken<Nat<0>, Range<1, 2>>]
    >>()

    assert<equals<
        parsed<parseNatural<charStreamFromString<"001">, Nat<0>>>,
        Nat<1>
    >>()
    type _m12 = N.add<Nat<6>, Nat<6>>
    assert<equals<
        parseTokens<charStreamFromString<"-0012">>,
        [SymbolToken<minus, Range<0, 1>>, NaturalToken<_m12, Range<1, 5>>]
    >>()

    assert<equals<
        parseNatural<charStreamFromString<"">, Nat<0>>,
        undefined
    >>()
    assert<equals<
        parseTokens<charStreamFromString<"-">>,
        [SymbolToken<minus, Range<0, 1>>]
    >>()
}

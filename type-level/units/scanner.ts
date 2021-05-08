import { cast, kind, unreachable } from "../types"
import { anyOrUndefined, noneOrUndefined, skipSpaces, CharStreamKind, position, positionAsNat } from "../parser"
import * as N from "../natural"
import { NaturalKind, Nat } from "../natural"
import * as Syntax from "./syntax"
import { recursiveKey, unwrapRecursiveObject } from "../recursive-object"

export interface Range<start extends number, end extends number> {
    start: start
    end: end
}
export type RangeKind = Range<number, number>

interface Token<tag extends string, value, range extends RangeKind> {
    tag: tag
    value: value
    range: range
}
export type SymbolToken<op extends symbols, range extends RangeKind> = Token<op, undefined, range>
export type SymbolTokenKind = SymbolToken<symbols, RangeKind>
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
    stream["remaining"] extends `${infer char}${string}` ? char : undefined

type skipCharOrNop<stream extends CharStreamKind> =
    stream["remaining"] extends `${infer char}${infer remaining}`
    ? kind<CharStreamKind, { remaining: remaining, consumed: `${stream["consumed"]}${char}` }>
    : stream

type currentCharRange<stream extends CharStreamKind> = Range<position<stream>, N.toNumber<N.add<positionAsNat<stream>, Nat<1>>>>

type makeSymbolToken<stream extends CharStreamKind, char extends symbols> =
    cast<TokenKind, Token<char, undefined, currentCharRange<stream>>>

type parseTokenOrUndefined<stream extends CharStreamKind> =
    peekCharOrUndefined<stream> extends kind<string, infer char>

    // .
    ? (
        char extends symbols

        // \k<symbols>
        ? [stream: skipSpaces<skipCharOrNop<stream>>, token: makeSymbolToken<stream, char>]

        : (
            char extends asciiDigits

            // [0-9]
            ? (
                parseNatural<stream, Nat<0>> extends [kind<CharStreamKind, infer stream2>, kind<NaturalKind, infer natural>]
                ? [stream: skipSpaces<stream2>, token: NaturalToken<natural, Range<position<stream>, position<stream2>>>]
                : unreachable
            )

            // (?! \k<symbols>|[0-9]) .
            : (
                parseId<stream> extends [kind<CharStreamKind, infer stream2>, kind<string, infer id>]
                ? [stream: skipSpaces<stream2>, token: IdToken<id, Range<position<stream>, position<stream2>>>]
                : unreachable
            )
        )
    )

    // $
    : undefined

type parseTokensAsRecursiveObject<stream extends CharStreamKind, tokens extends TokenKind[]> =

    // なぜか stream を再帰オブジェクト内で使うと型エラーが発生するので
    // ここで分解してから再構築する
    stream extends { consumed: infer consumed, remaining: infer remaining }
    ? {
        [recursiveKey]:
        { remaining: remaining, consumed: consumed } extends kind<CharStreamKind, infer stream2>
        ? (
            parseTokenOrUndefined<stream2> extends [kind<CharStreamKind, infer stream3>, kind<TokenKind, infer token>]
            ? parseTokensAsRecursiveObject<stream3, [...tokens, token]>
            : tokens
        )
        : unreachable
    }
    : unreachable

export type parseTokens<stream extends CharStreamKind> =
    unwrapRecursiveObject<parseTokensAsRecursiveObject<skipSpaces<stream>, []>>

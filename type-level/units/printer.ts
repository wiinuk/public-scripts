import { Int, IntegerKind } from "../integer"
import { cast, kind, unionToTuple, unreachable } from "../types"
import * as String from "../string"
import { Nat, NaturalKind } from "../natural"
import * as N from "../natural"
import { UnitsRepresentationKind } from "./representation"
import * as Syntax from "./syntax"

type showSuperscriptDigit<d extends NaturalKind> = Syntax.superscript0To9[d["length"]]

type _10n = N.add<Nat<5>, Nat<5>>
type showSuperscriptDigitsNonZero<n extends NaturalKind> =
    n extends Nat<0>
    ? ""
    : (
        N.divMod<n, _10n> extends [kind<NaturalKind, infer quotient>, kind<NaturalKind, infer remainder>]
        ? `${showSuperscriptDigitsNonZero<quotient>}${showSuperscriptDigit<remainder>}`
        : unreachable
    )

type showSuperscriptDigits<n extends NaturalKind> =
    n extends Nat<0>
    ? Syntax.superscript0
    : showSuperscriptDigitsNonZero<n>

type showSuperscriptInteger<x extends IntegerKind> =
    `${x["sign"] extends "-" ? Syntax.superscriptMinus : ""}${showSuperscriptDigits<x["abs"]>}`

type showTerm<name extends string, dimension extends IntegerKind> =
    dimension extends Int<1>
    ? name
    : `${name}${showSuperscriptInteger<dimension>}`

export type showRepresentation<r extends UnitsRepresentationKind> =
    String.join<cast<string[], unionToTuple<{ [k in keyof r]: showTerm<cast<string, k>, r[k]> }[keyof r]>>, " ">

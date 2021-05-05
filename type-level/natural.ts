import { cast, kind, unreachable } from "./types"

export type NaturalKind = never[]
export type NonZeroNaturalKind = [never, ...never[]]

export type toNumber<N extends NaturalKind> = N["length"]
type naturalKind<T extends NaturalKind> = kind<NaturalKind, T>

type knownNaturals = {
    [0]: naturalKind<[]>,
    [1]: naturalKind<[never]>,
    [2]: naturalKind<[never, never]>,
    [3]: naturalKind<[never, never, never]>,
    [4]: naturalKind<[never, never, never, never]>,
    [5]: naturalKind<[never, never, never, never, never]>,
    [6]: naturalKind<[never, never, never, never, never, never]>,
    [7]: naturalKind<[never, never, never, never, never, never, never]>,
    [8]: naturalKind<[never, never, never, never, never, never, never, never]>,
    [9]: naturalKind<[never, never, never, never, never, never, never, never, never]>,
}

export type Nat<numberAsKnownNatural extends keyof knownNaturals> = knownNaturals[numberAsKnownNatural]

export type add<n1 extends NaturalKind, n2 extends NaturalKind> =
    naturalKind<[...n1, ...n2]>

export type sub<n1 extends NaturalKind, n2 extends NaturalKind> =
    n1 extends [...n2, ...infer n3]
    ? (n3 extends NaturalKind ? naturalKind<n3> : never)
    : never

export type mul<n1 extends NaturalKind, n2 extends NaturalKind> =
    n2 extends [never, ...naturalKind<infer n3>]
    ? add<mul<n1, n3>, n1>
    : Nat<0>

export type divMod<n1 extends NaturalKind, n2 extends NonZeroNaturalKind> =
    n1 extends [...n2, ...infer n1]
    ? (
        divMod<cast<NaturalKind, n1>, n2> extends [kind<NaturalKind, infer q>, infer r]
        ? [quotient: add<q, Nat<1>>, remainder: r]
        : unreachable
    )
    : [quotient: Nat<0>, remainder: n1];

export type div<N1 extends NaturalKind, N2 extends NonZeroNaturalKind> = divMod<N1, N2>[0]
export type mod<N1 extends NaturalKind, N2 extends NonZeroNaturalKind> = divMod<N1, N2>[1]

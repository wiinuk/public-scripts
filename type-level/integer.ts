import { Nat, NaturalKind } from "./natural"
import * as N from "./natural"
import { kind } from "./types"

export type IntegerKind = {
    sign: SignKind,
    abs: NaturalKind,
}
export type plusSign = "+"
export type minusSign = "-"
export type SignKind = plusSign | minusSign

type intKind<z extends IntegerKind> = kind<IntegerKind, z>

export type normalize<z extends IntegerKind> =
    z["abs"] extends Nat<0>
    ? intKind<{ sign: plusSign, abs: z["abs"] }>
    : z

export type Integer<sign extends SignKind, abs extends NaturalKind> = normalize<intKind<{
    sign: sign,
    abs: abs,
}>>

type knownIntegers = {
    [-9]: Integer<minusSign, Nat<9>>,
    [-8]: Integer<minusSign, Nat<8>>,
    [-7]: Integer<minusSign, Nat<7>>,
    [-6]: Integer<minusSign, Nat<6>>,
    [-5]: Integer<minusSign, Nat<5>>,
    [-4]: Integer<minusSign, Nat<4>>,
    [-3]: Integer<minusSign, Nat<3>>,
    [-2]: Integer<minusSign, Nat<2>>,
    [-1]: Integer<minusSign, Nat<1>>,
    [0]: Integer<plusSign, Nat<0>>,
    [1]: Integer<plusSign, Nat<1>>,
    [2]: Integer<plusSign, Nat<2>>,
    [3]: Integer<plusSign, Nat<3>>,
    [4]: Integer<plusSign, Nat<4>>,
    [5]: Integer<plusSign, Nat<5>>,
    [6]: Integer<plusSign, Nat<6>>,
    [7]: Integer<plusSign, Nat<7>>,
    [8]: Integer<plusSign, Nat<8>>,
    [9]: Integer<plusSign, Nat<9>>,
}
export type Int<numberAsKnownInteger extends keyof knownIntegers> = knownIntegers[numberAsKnownInteger]

type subNonZero<n1 extends NaturalKind, n2 extends NaturalKind> =
    N.sub<n1, n2> extends never
    ? Integer<minusSign, N.sub<n2, n1>>
    : Integer<plusSign, N.sub<n1, n2>>

export type add<z1 extends IntegerKind, z2 extends IntegerKind> =
    z1["sign"] extends plusSign
    ? (
        z2["sign"] extends plusSign
        ? Integer<plusSign, N.add<z1["abs"], z2["abs"]>>
        : subNonZero<z1["abs"], z2["abs"]>
    )
    : (
        z2["sign"] extends plusSign
        ? subNonZero<z2["abs"], z1["abs"]>
        : Integer<minusSign, N.add<z1["abs"], z2["abs"]>>
    )

export type sub<z1 extends IntegerKind, z2 extends IntegerKind> =
    z1["sign"] extends plusSign
    ? (
        z2["sign"] extends plusSign
        ? subNonZero<z1["abs"], z2["abs"]>
        : Integer<plusSign, N.add<z1["abs"], z2["abs"]>>
    )
    : (
        z2["sign"] extends plusSign
        ? Integer<"-", N.add<z1["abs"], z2["abs"]>>
        : subNonZero<z2["abs"], z1["abs"]>
    )

export type mul<z1 extends IntegerKind, z2 extends IntegerKind> =
    Integer<z1["sign"] extends z2["sign"] ? plusSign : minusSign, N.mul<z1["abs"], z2["abs"]>>

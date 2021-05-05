import { Int, IntegerKind } from "../integer"
import * as Z from "../integer"
import { cast, kind } from "../types"


export type UnitsRepresentationKind = { [unitName: string]: IntegerKind }

/** @template k `keyof r1 | keyof r2` */
type addDimension<k extends string, r1 extends UnitsRepresentationKind, r2 extends UnitsRepresentationKind> =
    r1[k] extends IntegerKind
    ? (
        r2[k] extends IntegerKind
        ? Z.add<r1[k], r2[k]>
        : r1[k]
    )
    : r2[k]

/** @template k `keyof r1 | keyof r2` */
type subDimension<k extends string, r1 extends UnitsRepresentationKind, r2 extends UnitsRepresentationKind> =
    r1[k] extends IntegerKind
    ? (
        r2[k] extends IntegerKind
        ? Z.sub<r1[k], r2[k]>
        : r1[k]
    )
    : r2[k]

type nonZeroDimensionKeys<r extends UnitsRepresentationKind> = {
    [k in keyof r]: r[k] extends Int<0> ? never : k
}[keyof r]

export type normalize<r extends UnitsRepresentationKind> = kind<UnitsRepresentationKind, {
    [k in nonZeroDimensionKeys<r>]: r[k]
}>
export type mul<r1 extends UnitsRepresentationKind, r2 extends UnitsRepresentationKind> = kind<UnitsRepresentationKind, normalize<{
    [k in cast<string, keyof r1 | keyof r2>]: addDimension<k, r1, r2>
}>>
export type div<r1 extends UnitsRepresentationKind, r2 extends UnitsRepresentationKind> = kind<UnitsRepresentationKind, normalize<{
    [k in cast<string, keyof r1 | keyof r2>]: subDimension<k, r1, r2>
}>>

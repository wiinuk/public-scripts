import { Failure } from "./result"
import { equals, unreachable } from "./types"
import { representationOrFailure } from "./units/parser"
import { showRepresentation } from "./units/printer"
import { UnitsRepresentationKind } from "./units/representation"
import * as R from "./units/representation"


export type UnitsKind = string

export abstract class NumberWith<U extends UnitsKind> {
    private constructor() { /* 派生クラスからもインスタンスを生成できないようにする */ }
    protected _numberWithUnitsBrand: U = null as unknown as U
}

type addOrFailure<u1 extends UnitsKind, u2 extends UnitsKind> =
    representationOrFailure<u1> extends infer r1
    ? (
        r1 extends UnitsRepresentationKind
        ? (
            representationOrFailure<u2> extends infer r2
            ? (
                r2 extends UnitsRepresentationKind
                ? (
                    equals<r1, r2> extends true
                    ? u1
                    : Failure<"Units mismatch.", {
                        units: [u1, u2],
                        normalizedUnits: [showRepresentation<r1>, showRepresentation<r2>]
                    }>
                )
                : r2
            )
            : unreachable
        )
        : r1
    )
    : unreachable

type mulOrFailure<u1 extends UnitsKind, u2 extends UnitsKind> =
    representationOrFailure<u1> extends infer r1
    ? (
        r1 extends UnitsRepresentationKind
        ? (
            representationOrFailure<u2> extends infer r2
            ? (
                r2 extends UnitsRepresentationKind
                ? (
                    showRepresentation<R.mul<r1, r2>>
                )
                : r2
            )
            : unreachable
        )
        : r1
    )
    : unreachable

type divOrFailure<u1 extends UnitsKind, u2 extends UnitsKind> =
    representationOrFailure<u1> extends infer r1
    ? (
        r1 extends UnitsRepresentationKind
        ? (
            representationOrFailure<u2> extends infer r2
            ? (
                r2 extends UnitsRepresentationKind
                ? (
                    showRepresentation<R.div<r1, r2>>
                )
                : r2
            )
            : unreachable
        )
        : r1
    )
    : unreachable

type toNumberIfUnits<maybeUnits> =
    maybeUnits extends UnitsKind ? NumberWith<maybeUnits> : maybeUnits

export const withUnits = <TUnits extends UnitsKind>(value: number, _units: TUnits) => value as unknown as NumberWith<TUnits>
export const withoutUnits = <TUnits extends UnitsKind>(value: NumberWith<TUnits>) => value as unknown as number

export const add = <U1 extends UnitsKind, U2 extends UnitsKind>(v1: NumberWith<U1>, v2: NumberWith<U2>) =>
    (v1 as unknown as number) + (v2 as unknown as number) as unknown as toNumberIfUnits<addOrFailure<U1, U2>>

export const sub = <U1 extends UnitsKind, U2 extends UnitsKind>(v1: NumberWith<U1>, v2: NumberWith<U2>) =>
    (v1 as unknown as number) - (v2 as unknown as number) as unknown as toNumberIfUnits<addOrFailure<U1, U2>>

export const mul = <U1 extends UnitsKind, U2 extends UnitsKind>(v1: NumberWith<U1>, v2: NumberWith<U2>) =>
    (v1 as unknown as number) * (v2 as unknown as number) as unknown as toNumberIfUnits<mulOrFailure<U1, U2>>

export const div = <U1 extends UnitsKind, U2 extends UnitsKind>(v1: NumberWith<U1>, v2: NumberWith<U2>) =>
    (v1 as unknown as number) / (v2 as unknown as number) as unknown as toNumberIfUnits<divOrFailure<U1, U2>>

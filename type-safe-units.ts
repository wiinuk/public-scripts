import { identity, Identity, kind } from "./type-level/types"
import { unitOrFailure as Unit, unitOrNever as UnitOrNever } from "./type-level/units/parser"
import { UnitsRepresentationKind } from "./type-level/units/representation"
import * as R from "./type-level/units/representation"
import { FailureKind } from "./type-level/result"
export { Unit, UnitOrNever }

// eslint-disable-next-line @typescript-eslint/ban-types
export type DimensionlessUnits = kind<UnitsKind, {}>
export type UnitsViewKind = string
export type UnitsKind = UnitsRepresentationKind

/**
 * 単位付き数値を表すクラス。
 * `typeof <このクラスのインスタンス> === "number"`。
 */
export abstract class NumberWith<U extends UnitsKind> {
    private constructor() { /* 派生クラスからもインスタンスを生成できないようにする */ }
    protected _phantomU = null as unknown as Identity<U>
}
export const unit = <TView extends UnitsViewKind>(_view: TView): Identity<Unit<TView>> => identity
export const unitOrNever = <TView extends UnitsViewKind>(_view: TView): Identity<UnitOrNever<TView>> => identity

type checkedViewOrFailure<view extends UnitsViewKind> = Unit<view> extends kind<FailureKind, infer failure> ? failure : view

export type Measure<TView extends UnitsViewKind> =
    Unit<TView> extends kind<FailureKind, infer failure>
    ? failure
    : NumberWith<UnitOrNever<TView>>

export const numberWith = <TUnit extends UnitsKind>(value: number, _units: Identity<TUnit>) => value as unknown as NumberWith<TUnit>
export const measure = <TView extends UnitsViewKind>(value: number, _unitsView: checkedViewOrFailure<TView>) => value as unknown as NumberWith<UnitOrNever<TView>>
export const withoutMeasure = <TUnits extends UnitsKind>(value: NumberWith<TUnits>) => value as unknown as number
export const measure1 = (value: number) => value as unknown as NumberWith<DimensionlessUnits>

export const add = <U extends UnitsKind>(v1: NumberWith<U>, v2: NumberWith<U>) =>
    (v1 as unknown as number) + (v2 as unknown as number) as unknown as NumberWith<U>

export const sub = <U extends UnitsKind>(v1: NumberWith<U>, v2: NumberWith<U>) =>
    (v1 as unknown as number) - (v2 as unknown as number) as unknown as NumberWith<U>

export const mul = <U1 extends UnitsKind, U2 extends UnitsKind>(v1: NumberWith<U1>, v2: NumberWith<U2>) =>
    (v1 as unknown as number) * (v2 as unknown as number) as unknown as NumberWith<R.mul<U1, U2>>

export const div = <U1 extends UnitsKind, U2 extends UnitsKind>(v1: NumberWith<U1>, v2: NumberWith<U2>) =>
    (v1 as unknown as number) / (v2 as unknown as number) as unknown as NumberWith<R.div<U1, U2>>

export const sqrt = <U extends UnitsKind>(x: NumberWith<R.mul<U, U>>) =>
    numberWith<U>(Math.sqrt(withoutMeasure(x)), identity)

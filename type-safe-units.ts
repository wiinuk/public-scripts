import { identity, Identity, kind } from "./type-level/types"
import { ParserContextKind, unitOrFailure as parseUnitOrFailure, unitOrNever as parseUnitOrNever } from "./type-level/units/parser"
import { UnitsRepresentationKind } from "./type-level/units/representation"
import * as R from "./type-level/units/representation"
import { FailureKind } from "./type-level/result"


// eslint-disable-next-line @typescript-eslint/ban-types
export type DimensionlessUnits = kind<UnitsKind, {}>
export type UnitsViewKind = string
export type UnitsKind = UnitsRepresentationKind

export interface DefaultDiagnosticMessageTable {
    Number_is_required: "Number is required."
    Circumflex_is_required: "Circumflex ( ^ ) is required."
    Unit_name_or_1_is_required: "Unit name or 1 ( for dimensionless ) is required."
    Unexpected_token__Unit_name_or_1_is_required: "Unexpected token. Unit name or 1 is required."
    Fraction_symbol_required: "Fraction symbol ( / ) required."
    End_of_source_is_required: "End of source is required."
}
export interface DefaultParserContext extends ParserContextKind {
    diagnosticMessageTable: DefaultDiagnosticMessageTable
}

export type Unit<TView extends UnitsViewKind, TContext extends ParserContextKind = DefaultParserContext> = parseUnitOrFailure<TView, TContext>
export type UnitOrNever<TView extends UnitsViewKind, TContext extends ParserContextKind = DefaultParserContext> = parseUnitOrNever<TView, TContext>

/**
 * 単位付き数値を表すクラス。
 * `typeof <このクラスのインスタンス> === "number"`。
 */
export abstract class NumberWith<U extends UnitsKind> {
    private constructor() { /* 派生クラスからもインスタンスを生成できないようにする */ }
    protected _phantomU = null as unknown as Identity<U>
}
export const unit = <TView extends UnitsViewKind, TContext extends ParserContextKind = DefaultParserContext>(_view: TView, _context: Identity<TContext> = identity): Identity<parseUnitOrFailure<TView, TContext>> => identity
export const unitOrNever = <TView extends UnitsViewKind, TContext extends ParserContextKind = DefaultParserContext>(_view: TView, _context: Identity<TContext> = identity): Identity<parseUnitOrNever<TView, TContext>> => identity

type checkedViewOrFailure<view extends UnitsViewKind, context extends ParserContextKind> = parseUnitOrFailure<view, context> extends kind<FailureKind, infer failure> ? failure : view

export type Measure<TView extends UnitsViewKind, TContext extends ParserContextKind = DefaultParserContext> =
    parseUnitOrFailure<TView, TContext> extends kind<FailureKind, infer failure>
    ? failure
    : NumberWith<parseUnitOrNever<TView, TContext>>

export const numberWith = <TUnit extends UnitsKind>(value: number, _units: Identity<TUnit>) => value as unknown as NumberWith<TUnit>
export const measure = <TView extends UnitsViewKind, TContext extends ParserContextKind = DefaultParserContext>(value: number, _unitsView: checkedViewOrFailure<TView, TContext>, _context: Identity<TContext> = identity) => value as unknown as NumberWith<parseUnitOrNever<TView, TContext>>
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

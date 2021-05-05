import * as N from "./natural"
import { kind } from "./types"

type lengthAsNat<T extends string> =
    T extends `${infer _}${infer rest}`
    ? N.add<N.Nat<1>, lengthAsNat<rest>>
    : N.Nat<0>

export type length<T extends string> = N.toNumber<lengthAsNat<T>>

export type interpolatable = string | number | bigint | boolean | null | undefined

type joinWorker<items extends interpolatable[], separator extends interpolatable, result extends string> =
    items extends [kind<interpolatable, infer term>, ...kind<interpolatable[], infer rest>]
    ? joinWorker<rest, separator, `${result}${separator}${term}`>
    : result

export type join<items extends interpolatable[], separator extends interpolatable = ", "> =
    items extends [kind<interpolatable, infer head>, ...kind<interpolatable[], infer rest>]
    ? joinWorker<rest, separator, `${head}`>
    : ""

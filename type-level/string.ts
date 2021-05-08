import * as N from "./natural"
import { Nat, NaturalKind } from "./natural"
import { recursiveKey, unwrapRecursiveObject } from "./recursive-object"
import { kind } from "./types"

type _16n = N.add<Nat<8>, Nat<8>>
type _32n = N.add<_16n, _16n>
type lengthAsNatWorker<T extends string, n extends NaturalKind> =
    T extends `${string}${string}${string}${string}${string}${string}${string}${string}${string}${string}${string}${string}${string}${string}${string}${string}${string}${string}${string}${string}${string}${string}${string}${string}${string}${string}${string}${string}${string}${string}${string}${string}${infer rest}` ? lengthAsNatWorker<rest, N.add<_32n, n>> :
    T extends `${string}${string}${string}${string}${string}${string}${string}${string}${string}${string}${string}${string}${string}${string}${string}${string}${infer rest}` ? lengthAsNatWorker<rest, N.add<_16n, n>> :
    T extends `${string}${string}${string}${string}${string}${string}${string}${string}${infer rest}` ? lengthAsNatWorker<rest, N.add<Nat<8>, n>> :
    T extends `${string}${string}${string}${string}${infer rest}` ? lengthAsNatWorker<rest, N.add<Nat<4>, n>> :
    T extends `${string}${string}${infer rest}` ? lengthAsNatWorker<rest, N.add<Nat<2>, n>> :
    T extends `${string}${infer rest}` ? lengthAsNatWorker<rest, N.add<Nat<1>, n>> :
    n

export type lengthAsNat<T extends string> = lengthAsNatWorker<T, Nat<0>>
export type length<T extends string> = N.toNumber<lengthAsNat<T>>

export type interpolatable = string | number | bigint | boolean | null | undefined

type joinWorker<items extends interpolatable[], separator extends interpolatable, result extends string> =
    items extends [kind<interpolatable, infer item>, ...kind<interpolatable[], infer rest>]
    ? { [recursiveKey]: joinWorker<rest, separator, `${result}${separator}${item}`> }
    : result

export type join<items extends interpolatable[], separator extends interpolatable = ", "> =
    items extends [kind<interpolatable, infer head>, ...kind<interpolatable[], infer rest>]
    ? unwrapRecursiveObject<joinWorker<rest, separator, `${head}`>>
    : ""

type toCharsAsRecursiveObject<chars extends string, result extends string[]> =
    chars extends `${infer char}${infer rest}`
    ? { [recursiveKey]: toCharsAsRecursiveObject<rest, [...result, char]> }
    : result

export type toChars<chars extends string> =
    unwrapRecursiveObject<toCharsAsRecursiveObject<chars, []>>

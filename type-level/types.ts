
export type unreachable = never

/**
 * 種注釈
 *
 * @example
 *
 * // 種チェックと変数への代入
 * type repeatString<xs> = xs extends kind<string, infer x0> ? [x0, x0] : "???"
 * assert<equals<repeatString<"hey">, ["hey", "hey"]>>()
 * assert<equals<repeatString<10>, "???">>()
 *
 * // 単純な種チェック
 * type _1 = kind<number, 10>
 * type _2 = kind<number, ""> // 型エラー
 */
export type kind<Kind, T extends Kind> = T

/** 型を指定された種に変換する。変換できない時は never を返す */
export type cast<ToKind, T> = T extends ToKind ? T : never

type unionToIntersection<U> =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (U extends any ? (arg: U) => any : never) extends (arg: infer I) => void
    ? I
    : never;

export type unionToTuple<T> =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    unionToIntersection<(T extends any ? (t: T) => T : never)> extends (_: any) => infer W
    ? [...unionToTuple<Exclude<T, W>>, W]
    : []

export type equals<T, S> = [T] extends [S] ? ([S] extends [T] ? true : false) : false

/** 不変な T を持ち運ぶオブジェクト */
export type Identity<T> = (x: T) => T
export const identity = <T>(x: T) => x

export type overwrite<Base, Super> = {
    [k in (keyof Base | keyof Super)]:
    k extends keyof Super ? Super[k]
    : k extends keyof Base ? Base[k]
    : never
}

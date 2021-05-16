import { recursiveKey, unwrapRecursiveObject } from "./recursive-object"

type zipWorker<xs1 extends unknown[], xs2 extends unknown[], result extends [unknown, unknown][]> =
    [xs1, xs2] extends [[infer x1, ...infer rest1], [infer x2, ...infer rest2]]
    ? { [recursiveKey]: zipWorker<rest1, rest2, [...result, [x1, x2]]> }
    : result

export type zip<xs1 extends unknown[], xs2 extends unknown[]> =
    unwrapRecursiveObject<zipWorker<xs1, xs2, []>>

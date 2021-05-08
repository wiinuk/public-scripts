export const recursiveKey = Symbol("recursive")

type reduceRecursiveObject<r> =
    r extends { [recursiveKey]: never }
    ? never
    : (
        r extends { [recursiveKey]: { [recursiveKey]: infer r } }
        ? { [recursiveKey]: reduceRecursiveObject<r> }
        : (
            r extends { [recursiveKey]: infer r }
            ? r
            : r
        )
    )

type unwrapRecursiveObjectWorker<r, h extends "h" = "h"> =
    r extends { [recursiveKey]: unknown }
    ? { [_ in h]: unwrapRecursiveObjectWorker<reduceRecursiveObject<r>> }[h]
    : r

export type unwrapRecursiveObject<r> = unwrapRecursiveObjectWorker<r>


export type makeFixedSizeArray<Length extends number, T, Tuple extends [...any[]]> =
Length extends Tuple["length"]
    ? Tuple
    : makeFixedSizeArray<Length, T, [T, ...Tuple]>

export type FixedSizeArray<Length extends number, T> = makeFixedSizeArray<Length, T, []>
export namespace FixedSizeArray {
    export const fromArrayOrError = <N extends number, T>(length: N, array: T[]) => {
        if (array.length === length) {
            return array as unknown as FixedSizeArray<N, T>
        }
        throw new Error(`length: ${length}, array.length: ${array.length}, array: ${JSON.stringify(array)}`)
    }
    export const last = <T>(tuple: [T, ...T[]]) => tuple[tuple.length - 1] as T
}

export default FixedSizeArray

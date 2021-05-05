const successSymbol = Symbol("Result.Success")
export type SuccessSymbol = typeof successSymbol
export interface SuccessKind {
    kind: SuccessSymbol
    value: unknown
}
const failureSymbol = Symbol("Result.Failure")
export type failureSymbol = typeof failureSymbol
export interface FailureKind {
    kind: failureSymbol
    message: unknown
    data: unknown
}
export type ResultKind =
    | SuccessKind
    | FailureKind

export interface Success<value> extends SuccessKind {
    kind: SuccessSymbol
    value: value
}
export interface Failure<message, data> extends FailureKind {
    kind: failureSymbol
    message: message
    data: data
}

/** alias of Success */
export type Ok<T> = Success<T>

/** alias of Failure */
export type Err<TMessage, TData> = Failure<TMessage, TData>

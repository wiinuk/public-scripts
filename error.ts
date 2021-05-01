
export const error = (message: TemplateStringsArray, ...substitutions: unknown[]) => {
    throw new Error(String.raw(message, ...substitutions))
}
export const exhaustiveCheck = (_: never) => error`unreachable`

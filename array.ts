
export const maxValue = <T, Item>(initialValue: T, items: readonly Item[], mapping: (item: Item) => T) =>
items.reduce((currentMax, x) => {
    const n = mapping(x)
    if (currentMax < n) { return n }
    return currentMax
}, initialValue)

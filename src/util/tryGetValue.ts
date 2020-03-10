function tryGetValue<T, R>(data: Map<T, R>, key: T): { value: R, found: true } | { found: false } {
    if (data.has(key)) return { found: true, value: data.get(key)! };
    return { found: false };
}
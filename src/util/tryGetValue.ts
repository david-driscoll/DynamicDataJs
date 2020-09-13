export function tryGetValue<K, V>(
    data: {
        get(key: K): V | undefined;
        has(key: K): boolean;
    },
    key: K,
): { value: V; found: true } | { found: false } {
    if (data.has(key)) return { found: true, value: data.get(key)! };
    return { found: false };
}

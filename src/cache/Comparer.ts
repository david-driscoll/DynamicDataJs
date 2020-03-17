export type Comparer<T> = (a: T, b: T) => -1 | 0 | 1;
export type KeyValueComparer<TObject, TKey> = Comparer<readonly [TKey, TObject]>;
export function keyValueComparer<TObject, TKey>(keyComparer: Comparer<TKey>, valueComparer?: Comparer<TObject>): KeyValueComparer<TObject, TKey> {
    return function innerKeyValueComparer([aKey, aValue]: readonly [TKey, TObject], [bKey, bValue]: readonly [TKey, TObject]) {
        if (valueComparer) {
            const result = valueComparer(aValue, bValue);
            if (result !== 0) {
                return result;
            }
        }
        return keyComparer(aKey, bKey);
    };
}
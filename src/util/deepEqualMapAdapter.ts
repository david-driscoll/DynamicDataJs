import { find } from 'ix/iterable';
import equal from 'fast-deep-equal';

export function deepEqualMapAdapter<TKey, TObject>(
    map: Map<TKey, TObject>,
): {
    get: typeof Map.prototype.get;
    set: typeof Map.prototype.set;
    has: typeof Map.prototype.has;
    delete: typeof Map.prototype.delete;
} {
    return {
        get(key) {
            return map.get(key) ?? find(map, { predicate: f => equal(f[0], key) });
        },
        set(key, value) {
            const foundKey = find(map, { predicate: ([k]) => equal(k, key) });
            if (foundKey !== undefined) {
                map.delete(foundKey[0]);
            }
            return map.set(key, value);
        },
        delete(key) {
            const foundKey = find(map, { predicate: ([k]) => equal(k, key) });
            if (foundKey !== undefined) {
                return map.delete(foundKey[0]);
            } else {
                return map.delete(key);
            }
        },
        has(key) {
            const foundKey = find(map, { predicate: ([k]) => equal(k, key) });
            if (foundKey !== undefined) return true;
            return map.has(key);
        },
    };
}

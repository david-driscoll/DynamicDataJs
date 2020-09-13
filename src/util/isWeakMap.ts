export function isWeakMap(value: any): value is WeakMap<any, any> {
    return value && value[Symbol.toStringTag] === 'WeakMap';
}

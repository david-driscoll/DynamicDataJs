export function isWeakSet(value: any): value is WeakSet<any> {
    return value && value[Symbol.toStringTag] === 'WeakSet';
}
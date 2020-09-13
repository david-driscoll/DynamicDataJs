export function isSet(value: any): value is Set<any> {
    return value && value[Symbol.toStringTag] === 'Set';
}

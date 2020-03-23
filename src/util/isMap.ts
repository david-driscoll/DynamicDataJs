export function isMap(value: any): value is Map<any, any> {
    return value && value[Symbol.toStringTag] === 'Map';
}
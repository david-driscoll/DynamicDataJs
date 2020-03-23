export function isIterable(value: any): value is Iterable<any> {
    return value && value[Symbol.iterator];
}


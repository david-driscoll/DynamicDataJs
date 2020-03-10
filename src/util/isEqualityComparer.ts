

export interface IEqualityComparer<T> {
    equals(a: T, b: T): boolean;
}
export function isEqualityComparer(value: any): value is IEqualityComparer<any> {
    return !!value?.equals;
}
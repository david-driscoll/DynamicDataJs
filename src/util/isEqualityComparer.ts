export type EqualityComparer<T> = (a: T, b: T) => boolean;

export function isEqualityComparer(value: any): value is Function {
    return !!value?.equals;
}

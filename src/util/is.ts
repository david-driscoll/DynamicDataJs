const hasOwnProperty = Object.prototype.hasOwnProperty;
export const hasOwn = (value: unknown, key: string | symbol): key is keyof typeof value => hasOwnProperty.call(value, key);
export const isArray = Array.isArray;
export const isFunction = (value: any): value is Function => typeof value === 'function';
export const isString = (value: any): value is string => typeof value === 'string';
export const isSymbol = (value: any): value is symbol => typeof value === 'symbol';
export const isObject = (value: any): value is Record<any, any> => value !== null && typeof value === 'object';
export const isPromise = <T = any>(value: any): value is Promise<T> => {
    return isObject(value) && isFunction(value.then) && isFunction(value.catch);
};

// compare whether a value has changed, accounting for NaN.
export const hasChanged = (value: any, oldValue: any): boolean => value !== oldValue && (value === value || oldValue === oldValue);

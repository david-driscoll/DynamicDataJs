const hasOwnProperty = Object.prototype.hasOwnProperty;
/** @ignore */
export const hasOwn = (value: unknown, key: string | symbol): key is keyof typeof value => hasOwnProperty.call(value, key);
/** @ignore */
export const isArray = Array.isArray;
/** @ignore */
export const isFunction = (value: any): value is Function => typeof value === 'function';
/** @ignore */
export const isString = (value: any): value is string => typeof value === 'string';
/** @ignore */
export const isSymbol = (value: any): value is symbol => typeof value === 'symbol';
/** @ignore */
export const isObject = (value: any): value is Record<any, any> => value !== null && typeof value === 'object';
/** @ignore */
export const isPromise = <T = any>(value: any): value is Promise<T> => {
    return isObject(value) && isFunction(value.then) && isFunction(value.catch);
};

// compare whether a value has changed, accounting for NaN.
/** @ignore */
export const hasChanged = (value: any, oldValue: any): boolean => value !== oldValue && (value === value || oldValue === oldValue);

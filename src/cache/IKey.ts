/**
 * Represents the key of an object
 * @typeparam T the key type
 */
export interface IKey<T> {
    /**
     * The key
     */
    readonly key: T;
}
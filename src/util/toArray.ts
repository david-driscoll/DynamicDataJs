function toArray<T>(iterable: Iterable<T>) {
    const values: T[] = [];
    for (const value of iterable) {
        values.push(value);
    }
    return values;
}
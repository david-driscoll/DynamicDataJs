export type SortedItems<TObject, TKey> = Iterable<[TObject, TKey]> & {
    size: number;
};

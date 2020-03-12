export type ExpirableItem<TObject, TKey> = {
    readonly value: TObject;
    readonly key: TKey;
    readonly expireAt: number | undefined;
}
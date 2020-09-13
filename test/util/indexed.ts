import { IKeyValueCollection } from '../../src/cache/IKeyValueCollection';
import { from, reduce, toMap } from 'ix/iterable';
import { map } from 'ix/iterable/operators';

export function indexed<TObject, TKey>(source: IKeyValueCollection<TObject, TKey>) {
    return toMap<{ key: TKey; value: TObject; index: number }, TKey, { key: TKey; value: TObject; index: number }>(
        from(source).pipe(map(([key, value], index) => ({ key, value, index }))),
        {
            keySelector: x => x.key as any, // typing issue
        },
    );
}

import { IKeyValueCollection } from '../../src/cache/IKeyValueCollection';
import { from, reduce, toMap } from 'ix/iterable';
import { map } from 'ix/iterable/operators';

export function indexed<TObject, TKey>(source: IKeyValueCollection<TObject, TKey>) {
    return toMap(from(source)
        .pipe(
            map(([key, value], index) => ({ key, value, index })),
        ), x => x.key,
    );
}
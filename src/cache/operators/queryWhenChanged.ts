import { merge, Observable, OperatorFunction } from 'rxjs';
import { IChangeSet } from '../IChangeSet';
import { IQuery } from '../IQuery';
import { map, publish, scan } from 'rxjs/operators';
import { Cache } from '../Cache';
import { AnonymousQuery } from '../AnonymousQuery';
import { mergeMany } from './mergeMany';

/**
 * The latest copy of the cache is exposed for querying i)  after each modification to the underlying data ii) on subscription
 * @category Operator
 * @typeparam TObject The type of the object.
 * @typeparam TKey The type of the key.
 * @typeparam TValue The type of the value.
 * @param itemChangedTrigger Should the query be triggered for observables on individual items
 */
export function queryWhenChanged<TObject, TKey>(itemChangedTrigger?: (value: TObject) => Observable<unknown>): OperatorFunction<IChangeSet<TObject, TKey>, IQuery<TObject, TKey>> {
    return function queryWhenChangedBaseOperator(source) {
        if (itemChangedTrigger == undefined) {
            return source.pipe(
                scan((cache, changes) => {
                    cache.clone(changes);
                    return cache;
                }, new Cache<TObject, TKey>()),
                map(list => new AnonymousQuery<TObject, TKey>(list)),
            );
        }

        return source.pipe(
            publish(shared => {
                const state = new Cache<TObject, TKey>();

                const inlineChange = shared.pipe(
                    mergeMany(itemChangedTrigger),
                    map(_ => new AnonymousQuery<TObject, TKey>(state)),
                );

                const sourceChanged = shared.pipe(
                    scan((list, changes) => {
                        list.clone(changes);
                        return list;
                    }, state),
                    map(list => new AnonymousQuery<TObject, TKey>(list)),
                );

                return merge(sourceChanged, inlineChange);
            }),
        );
    };
}

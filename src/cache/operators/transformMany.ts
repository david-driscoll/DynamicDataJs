import { Observable } from 'rxjs';
import { IChangeSet } from '../IChangeSet';
import { map } from 'rxjs/operators';
import { ArrayOrIterable } from '../../util/ArrayOrIterable';
import { transform } from './transform';
import { from as ixFrom, first, toArray } from 'ix/iterable';
import { map as ixMap, except, intersect } from 'ix/iterable/operators';
import { ChangeSet } from '../ChangeSet';
import { Change } from '../Change';
import { ChangeSetOperatorFunction } from '../ChangeSetOperatorFunction';

/**
 * Equivalent to a select many transform. To work, the key must individually identify each child.
 * @category Operator
 * @typeparam TDestination The type of the destination.
 * @typeparam TSource The type of the source.
 * @typeparam TSourceKey The type of the source key.
 * @typeparam TDestinationKey The type of the destination key.
 * @param manySelector The many selector.
 * @param keySelector The key selector which must be unique across all
 */
export function transformMany<TSource, TSourceKey, TDestination, TDestinationKey>(
    manySelector: (source: TSource) => ArrayOrIterable<TDestination>,
    keySelector: (destination: TDestination) => TDestinationKey,
    // Func<TSource, IObservable<IChangeSet<TDestination, TDestinationKey>>> childChanges = null
): ChangeSetOperatorFunction<TSource, TSourceKey, TDestination, TDestinationKey> {
    class ManyContainer {
        private readonly _initial: () => ArrayOrIterable<DestinationContainer>;
        public changes: Observable<IChangeSet<TDestination, TDestinationKey>> | undefined;

        public get destination() {
            return this._initial();
        }

        public constructor(initial: () => Array<DestinationContainer>, changes?: Observable<IChangeSet<TDestination, TDestinationKey>>) {
            this._initial = initial;
            this.changes = changes;
        }
    }

    return function transformManyOperator(source) {
        return source.pipe(
            transform(t => {
                const destination = toArray(ixFrom(manySelector(t)).pipe(ixMap(m => ({ item: m, key: keySelector(m) }))));
                return new ManyContainer(() => destination);
            }, true),
            map(changes => new ChangeSet<TDestination, TDestinationKey>(enumerateDestination(changes))),
        );
    };

    type DestinationContainer = { item: TDestination; key: TDestinationKey };

    function* enumerateDestination(changes: IChangeSet<ManyContainer, TSourceKey>) {
        for (const change of changes) {
            switch (change.reason) {
                case 'add':
                case 'remove':
                case 'refresh':
                    {
                        for (const destination of change.current.destination) {
                            yield new Change<TDestination, TDestinationKey>(change.reason, destination.key, destination.item);
                        }
                    }
                    break;
                case 'update':
                    {
                        const previousItems = ixFrom(change.previous?.destination ?? []);
                        const currentItems = ixFrom(change.current.destination);

                        const removes = previousItems.pipe(except(currentItems, (a, b) => a.key === b.key));
                        const adds = currentItems.pipe(except(previousItems, (a, b) => a.key === b.key));
                        const updates = currentItems.pipe(intersect(previousItems, (a, b) => a.key === b.key));

                        for (const destination of removes) {
                            yield new Change<TDestination, TDestinationKey>('remove', destination.key, destination.item);
                        }

                        for (const destination of adds) {
                            yield new Change<TDestination, TDestinationKey>('add', destination.key, destination.item);
                        }

                        for (const destination of updates) {
                            const current = first(currentItems, { predicate: d => d.key === destination.key })!;
                            const previous = first(previousItems, { predicate: d => d.key === destination.key })!;

                            //Do not update is items are the same reference
                            if (current.item !== previous.item) {
                                yield new Change<TDestination, TDestinationKey>('update', destination.key, current.item, previous.item);
                            }
                        }
                    }
                    break;
            }
        }
    }
}

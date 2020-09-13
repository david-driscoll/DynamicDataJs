import { Comparer, defaultComparer, keyValueComparer, KeyValueComparer } from '../Comparer';
import { SortOptimizations } from '../SortOptimizations';
import { merge, NEVER, Observable, OperatorFunction } from 'rxjs';
import { IChangeSet } from '../IChangeSet';
import { ISortedChangeSet, SortReason } from '../ISortedChangeSet';
import { ChangeAwareCache } from '../ChangeAwareCache';
import { KeyValueCollection } from '../KeyValueCollection';
import { IndexCalculator } from '../IndexCalculator';
import { filter, map } from 'rxjs/operators';
import { SortedChangeSet } from '../SortedChangeSet';

/**
 * Sorts using the specified comparer.
 * Returns the underlying ChangeSet as as per the system conventions.
 * The resulting changeset also exposes a sorted key value collection of of the underlying cached data
 * @typeparam TObject The type of the object.
 * @typeparam TKey The type of the key.
 * @param keyComparer The key comparer.
 * @param comparer The comparer.
 * @param sortOptimisations Sort optimization flags. Specify one or more sort optimizations
 * @param resort OnNext of this observable causes data to resort. This is required when the value which is sorted on mutable
 * @param comparerChangedObservable An observable comparer used to change the comparer on which the sorted list
 * @param resetThreshold The number of updates before the entire list is resorted (rather than inline sort)
 */
export function sort<TObject, TKey>(
    comparer?: Comparer<TObject>,
    comparerChangedObservable: Observable<Comparer<TObject>> = NEVER,
    resort: Observable<unknown> = NEVER,
    resetThreshold = -1,
    keyComparer: Comparer<TKey> = defaultComparer,
    sortOptimisations: SortOptimizations = 'none',
): OperatorFunction<IChangeSet<TObject, TKey>, ISortedChangeSet<TObject, TKey>> {
    return function sortOperator(source) {
        const _cache = new ChangeAwareCache<TObject, TKey>();

        let _comparer: KeyValueComparer<TObject, TKey> | undefined = keyValueComparer(keyComparer, comparer);
        let _sorted = new KeyValueCollection<TObject, TKey>();
        let _haveReceivedData = false;
        let _initialised = false;
        let _calculator: IndexCalculator<TObject, TKey>;

        return new Observable<ISortedChangeSet<TObject, TKey>>(observer => {
            const comparerChanged$ = comparerChangedObservable.pipe(map(sortComparer));
            const sortAgain = resort.pipe(map(_resort));
            const dataChanged = source.pipe(map(sortChanges));

            return merge(comparerChanged$, dataChanged, sortAgain)
                .pipe(filter(z => z !== undefined))
                .subscribe(observer);
        });

        function _resort() {
            return doSort('reorder');
        }

        function sortChanges(changes: IChangeSet<TObject, TKey>) {
            return doSort('dataChanged', changes);
        }

        function sortComparer(comparer: Comparer<TObject>) {
            _comparer = keyValueComparer(keyComparer, comparer);
            return doSort('comparerChanged');
        }

        function doSort(sortReason: SortReason, changes?: IChangeSet<TObject, TKey>): ISortedChangeSet<TObject, TKey> | undefined {
            if (changes !== undefined) {
                _cache.clone(changes);
                changes = _cache.captureChanges();
                _haveReceivedData = true;
                if (_comparer === undefined) {
                    return;
                }
            }

            //if the comparer is not set, return nothing
            if (_comparer === undefined || !_haveReceivedData) {
                return;
            }

            if (!_initialised) {
                sortReason = 'initialLoad';
                _initialised = true;
            } else if (changes !== undefined && resetThreshold > 0 && changes.size >= resetThreshold) {
                sortReason = 'reset';
            }

            let changeSet: IChangeSet<TObject, TKey>;
            switch (sortReason) {
                case 'initialLoad':
                    {
                        //For the first batch, changes may have arrived before the comparer was set.
                        //therefore infer the first batch of changes from the cache
                        _calculator = new IndexCalculator<TObject, TKey>(_comparer, sortOptimisations);
                        changeSet = _calculator.load(_cache);
                    }

                    break;
                case 'reset':
                    {
                        _calculator.reset(_cache);
                        changeSet = changes!;
                    }

                    break;
                case 'dataChanged':
                    {
                        changeSet = _calculator.calculate(changes!);
                    }
                    break;

                case 'comparerChanged':
                    {
                        changeSet = _calculator.changeComparer(_comparer);
                        if (resetThreshold > 0 && _cache.size >= resetThreshold) {
                            sortReason = 'reset';
                            _calculator.reset(_cache);
                        } else {
                            sortReason = 'reorder';
                            changeSet = _calculator.reorder();
                        }
                    }

                    break;

                case 'reorder':
                    {
                        changeSet = _calculator.reorder();
                    }

                    break;
                default:
                    throw new Error('sortReason');
            }

            if ((sortReason === 'initialLoad' || sortReason === 'dataChanged') && changeSet.size == 0) {
                return;
            }

            if (sortReason == 'reorder' && changeSet.size === 0) {
                return;
            }

            _sorted = new KeyValueCollection<TObject, TKey>(_calculator.list.slice(0), _comparer, sortReason, sortOptimisations);
            return new SortedChangeSet<TObject, TKey>(_sorted, changeSet);
        }
    };
}

type SortExpression<T> = Comparer<T> & {
    thenByAscending<Key extends keyof T>(key: Key): SortExpression<T>;
    thenByDescending<Key extends keyof T>(key: Key): SortExpression<T>;
};

function defaultAscending<T, Key extends keyof T = keyof T>(key: Key) {
    return function defaultAscendingComparer(a: T, b: T): number /* (-1 | 0 | 1) */ {
        return defaultComparer(a[key], b[key]);
    };
}

function defaultDescending<T, Key extends keyof T = keyof T>(key: Key) {
    return function defaultDescendingComparer(a: T, b: T): number /* (-1 | 0 | 1) */ {
        return (0 - defaultComparer(a[key], b[key])) as any;
    };
}

function descending<T, Key extends keyof T = keyof T>(key: Key, previous?: SortExpression<T>): SortExpression<T> {
    const comparer = defaultDescending<T, Key>(key);
    function result(a: T, b: T) {
        if (previous !== undefined) {
            const previousResult = previous(a, b);
            return previousResult === 0 ? comparer(a, b) : previousResult;
        }
        return comparer(a, b);
    }
    result.thenByAscending = function <K extends keyof T>(k: K): SortExpression<T> {
        return ascending(k, result);
    };
    result.thenByDescending = function <K extends keyof T>(k: K): SortExpression<T> {
        return descending(k, result);
    };
    return result as any;
}

function ascending<T, Key extends keyof T = keyof T>(key: Key, previous?: SortExpression<T>): SortExpression<T> {
    const comparer = defaultAscending<T, Key>(key);
    function result(a: T, b: T) {
        if (previous !== undefined) {
            const previousResult = previous(a, b);
            return previousResult === 0 ? comparer(a, b) : previousResult;
        }
        return comparer(a, b);
    }
    result.thenByAscending = function <K extends keyof T>(k: K): SortExpression<T> {
        return ascending(k, result);
    };
    result.thenByDescending = function <K extends keyof T>(k: K): SortExpression<T> {
        return descending(k, result);
    };
    return result as any;
}

export class SortComparer {
    public static ascending<T, Key extends keyof T = keyof T>(key: Key): SortExpression<T> {
        return ascending(key);
    }

    public static descending<T, Key extends keyof T = keyof T>(key: Key): SortExpression<T> {
        return descending(key);
    }
}

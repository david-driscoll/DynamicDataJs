import { OperatorFunction, Observable } from 'rxjs';
import { ChangeSummary } from '../ChangeSummary';
import { IChangeSet } from '../../cache/IChangeSet';
import { scan } from 'rxjs/operators';
import { ChangeStatistics } from '../ChangeStatistics';

/// <summary>
/// Accumulates update statistics
/// </summary>
/// <typeparam name="TSource">The type of the source.</typeparam>
/// <typeparam name="TKey">The type of the key.</typeparam>
/// <param name="source">The source.</param>
/// <returns></returns>
/// <exception cref="System.ArgumentNullException">source</exception>
export function collectUpdateStats<TSource, TKey>(): OperatorFunction<IChangeSet<TSource, TKey>, ChangeSummary> {
    return function collectUpdateStatsOperator(source: Observable<IChangeSet<TSource, TKey>>) {
        return source.pipe(scan((seed, next) => {
            const index = seed.overall.index + 1;
            const adds = seed.overall.adds + next.adds;
            const updates = seed.overall.updates + next.updates;
            const removes = seed.overall.removes + next.removes;
            const evaluates = seed.overall.refreshes + next.refreshes;
            const moves = seed.overall.moves + next.moves;
            const total = seed.overall.count + next.size;

            const latest = new ChangeStatistics(index, next.adds, next.updates, next.removes, next.refreshes, next.moves, next.size);
            const overall = new ChangeStatistics(index, adds, updates, removes, evaluates, moves, total);
            return new ChangeSummary(index, latest, overall);
        }, ChangeSummary.empty));
    };
}
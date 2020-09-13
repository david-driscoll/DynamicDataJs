import { IChangeSet } from './IChangeSet';
import { MonoTypeOperatorFunction, Observable, OperatorFunction } from 'rxjs';
import { Group } from './IGroupChangeSet';
import { ISortedChangeSet } from './ISortedChangeSet';
import { IPagedChangeSet } from './IPagedChangeSet';
import { DistinctChangeSet } from './DistinctChangeSet';

export type MonoTypeChangeSetOperatorFunction<TObject, TKey> = MonoTypeOperatorFunction<IChangeSet<TObject, TKey>>;
export type ChangeSetOperatorFunction<TSourceObject, TSourceKey, TDestinationObject, TDestinationKey = TSourceKey> = OperatorFunction<
    IChangeSet<TSourceObject, TSourceKey>,
    IChangeSet<TDestinationObject, TDestinationKey>
>;

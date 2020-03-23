import { IChangeSet } from './IChangeSet';
import { MonoTypeOperatorFunction, Observable } from 'rxjs';
import { ISortedChangeSet } from './ISortedChangeSet';
import { IPagedChangeSet } from './IPagedChangeSet';
import { DistinctChangeSet } from './DistinctChangeSet';

/**
 * Represents the key of an object
 * @typeparam T the key type
 */
export interface IKey<T> {
    /**
     * The key
     */
    readonly key: T;
}

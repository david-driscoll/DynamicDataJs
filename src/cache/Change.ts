/**
 *    Container to describe a single change to a cache
 */
import { ChangeReason } from './ChangeReason';

function assert(condition: any, message?: string): asserts condition {
    if (!condition) {
        throw new Error(message);
    }
}

function toString<TObject, TKey>(this: Change<TObject, TKey>) {
    const { reason, key, current, previous } = this;
    return `"${reason}, Key: ${key}, Current: ${current}, Previous: ${previous}`;
}

export const Change = {
    create<TObject, TKey>(data: Exclude<Change<TObject, TKey>, Function>) {
        return {
            ...data,
            toString,
        };
    },
    add<TObject, TKey>(key: TKey, current: TObject, currentIndex?: number): Change<TObject, TKey> {
        return {
            reason: 'add',
            key,
            current,
            currentIndex: currentIndex ?? -1,
            toString: toString as any,
        };
    },
    update<TObject, TKey>(key: TKey, current: TObject, previous: TObject, currentIndex?: number, previousIndex?: number): Change<TObject, TKey> {
        return {
            reason: 'update',
            key,
            current,
            previousIndex,
            currentIndex: currentIndex ?? -1,
            previous,
            toString: toString as any,
        };
    },
    remove<TObject, TKey>(key: TKey, current: TObject, currentIndex?: number): Change<TObject, TKey> {
        return {
            reason: 'remove',
            key,
            current,
            currentIndex: currentIndex ?? -1,
            toString: toString as any,
        };
    },
    refresh<TObject, TKey>(key: TKey, current: TObject): Change<TObject, TKey> {
        return {
            reason: 'refresh',
            key,
            current,
            currentIndex: -1,
            toString: toString as any,
        };
    },
    moved<TObject, TKey>(key: TKey, current: TObject, currentIndex: number, previousIndex: number): Change<TObject, TKey> {
        return {
            reason: 'moved',
            key,
            current,
            currentIndex,
            previousIndex,
            toString: toString as any,
        };
    },
};

export interface Change<TObject, TKey> {
    // : IEquatable<Change<TObject, TKey>>
    /**
     *  The unique key of the item which has changed
     */
    readonly key: TKey;

    /**
     *  The  reason for the change
     */
    readonly reason: ChangeReason;

    /**
     *  The item which has changed
     */
    readonly current: TObject;

    /**
     *  The current index
     */
    readonly currentIndex: number;

    /**
     *  The previous change.
     *
     *  This is only when Reason==ChangeReason.Replace.
     */
    readonly previous?: TObject;

    /**
     *  The previous change.
     *
     *  This is only when Reason==ChangeReason.Update or ChangeReason.Move.
     */
    readonly previousIndex?: number;

    toString(): string;
}

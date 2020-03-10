import { Change } from './Change';
import { IChangeSet } from './IChangeSet';
import { ArrayOrIterable } from '../util/ArrayOrIterable';
import { ChangeReason } from './ChangeReason';

/**
 *  A collection of changes
 */
export class ChangeSet<TObject, TKey> extends Set<Change<TObject, TKey>> implements IChangeSet<TObject, TKey> {
    /**
     *  An empty change set
     */
    public static empty<TObject, TKey>() {
        return new ChangeSet<TObject, TKey>();
    }

    public constructor(collection?: ArrayOrIterable<Change<TObject, TKey>>) {
        super(collection);
    }

    public forReason(reason: ChangeReason) {
        let count = 0;
        for (const item of this.values()) {
            if (item.reason == reason) count++;
        }
        return count;
    }

    public get adds() {
        return this.forReason('add');
    }

    public get updates() {
        return this.forReason('update');
    }

    public get removes() {
        return this.forReason('remove');
    }

    public get refreshes() {
        return this.forReason('refresh');
    }

    public get moves() {
        return this.forReason('moved');
    }

    public toString() {
        return `ChangeSet. Count=${this.size}`;
    }
}
/**
 *    Container to describe a single change to a cache
 */
import { ChangeReason } from './ChangeReason';

function assert(condition: any, msg?: string): asserts condition {
    if (!condition) {
        throw new Error(msg);
    }
}

export class Change<TObject, TKey> {
    // : IEquatable<Change<TObject, TKey>>
    /**
     *  The unique key of the item which has changed
     */
    public readonly key: TKey;

    /**
     *  The  reason for the change
     */
    public readonly reason: ChangeReason;

    /**
     *  The item which has changed
     */
    public readonly current: TObject;

    /**
     *  The current index
     */
    public readonly currentIndex: number;

    /**
     *  The previous change.
     *
     *  This is only when Reason==ChangeReason.Replace.
     */
    public readonly previous?: TObject;

    /**
     *  The previous change.
     *
     *  This is only when Reason==ChangeReason.Update or ChangeReason.Move.
     */
    public readonly previousIndex?: number;

    /**
     *  Initializes a new instance of the <see cref="Change{TObject, TKey}"/> object.
     *  @param reason The reason
     *  @param key The key
     *  @param current The current
     */
    constructor(reason: ChangeReason, key: TKey, current: TObject);

    /**
     *  Initializes a new instance of the <see cref="Change{TObject, TKey}"/> object.
     *  @param reason The reason
     *  @param key The key
     *  @param current The current
     *  @param index The index
     */
    constructor(reason: ChangeReason, key: TKey, current: TObject, index?: number);

    /**
     *  Constructor for ChangeReason.Move
     *  @param reason The reason
     *  @param key The key
     *  @param current The current
     *  @param currentIndex The CurrentIndex
     *  @param previousIndex CurrentIndex of the previous
     */
    constructor(reason: 'moved', key: TKey, current: TObject, currentIndex: number, previousIndex: number);

    /**
     *  Initializes a new instance of the <see cref="Change{TObject, TKey}"/> object.
     *  @param reason The reason
     *  @param key The key
     *  @param current The current
     *  @param previous The previous
     *  @param currentIndex Value of the current
     *  @param previousIndex Value of the previous
     */
    constructor(reason: ChangeReason, key: TKey, current: TObject, previous?: TObject, currentIndex?: number, previousIndex?: number);
    // : this()

    // constructor(reason: 'moved', key: TKey, current: TObject, currentIndex: number, previousIndex: number);
    // constructor(reason: ChangeReason, key: TKey, current: TObject, index?: number);
    // constructor(reason: ChangeReason, key: TKey, current: TObject, previous?: TObject, currentIndex?: number, previousIndex?: number);
    constructor(reason: ChangeReason, key: TKey, current: TObject, previous?: TObject | number, currentIndex = -1, previousIndex = -1) {
        this.reason = reason;
        this.key = key;
        if (reason === 'moved') {
            assert(typeof previous === 'number');
            assert(previous >= 0, 'currentIndex must be greater than or equal to zero');
            assert(currentIndex >= 0, 'previousIndex must be greater than or equal to zero');
            this.current = current;
            this.currentIndex = previous;
            this.previousIndex = currentIndex;
            return;
        }

        this.current = current;
        this.previous = previous as any; // TObject could be number...
        this.currentIndex = currentIndex;
        this.previousIndex = previousIndex;

        if (reason == 'add' && previous) {
            throw new Error('For ChangeReason add, a previous value cannot be specified');
        }

        if (reason == 'update' && !previous) {
            throw new Error('For ChangeReason change, must supply previous value');
        }
    }

    public toString() {
        const { reason, key, current, previous } = this;
        return `"${reason}, Key: ${key}, Current: ${current}, Previous: ${previous}`;
    }
}
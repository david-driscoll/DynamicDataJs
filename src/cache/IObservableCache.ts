import { Observable, Subject, ObservableLike  } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { IDisposable, Disposable } from '../disposables/Disposable';

export type ArrayOrIterable<T> = Array<T> | Iterable<T>;

type ChangeReason = 'add' | 'update' | 'remove' | 'refresh' | 'moved';
export function isChangeReason(value: any) {
    return typeof value === 'string' && (value == 'add' || value == 'update' || value == 'remove' || value == 'refresh' || value == 'moved');
}

function isArray(value: any): value is ArrayLike<any> {
    return value && value.length !== undefined;
}

function isIterable(value: any): value is Iterable<any> {
    return value && value[Symbol.iterator];
}

function assert(condition: any, msg?: string): asserts condition {
    if (!condition) {
        throw new Error(msg);
    }
}

export interface IEqualityComparer<T>
{
    equals(a: T, b: T): boolean;
}

/**
 *    Container to describe a single change to a cache
 */
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
     *  @param index The index
     */
    constructor(reason: ChangeReason, key: TKey, current: TObject, index?: number);

    /**
     *  Constructor for ChangeReason.Move
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
            assert(typeof currentIndex === 'number');
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

/**
 * A cache for observing and querying in memory data
 * @typeparam TObject The type of the object
 * @typeparam TKey The type of the key
 */
export interface IConnectableCache<TObject, TKey> {
    /**
     *  Returns an observable of any changes which match the specified key.  The sequence starts with the initial item in the cache (if there is one).
     * @param key The key
     */
    watch(key: TKey): Observable<Change<TObject, TKey>>;

    /**
     *  Returns a filtered stream of cache changes preceded with the initial filtered state
     * @param predicate The result will be filtered using the specified predicate
     */
    connect(predicate?: (obj: TObject) => boolean): Observable<IChangeSet<TObject, TKey>>;

    /**
     * Returns a filtered stream of cache changes.
     * Unlike Connect(), the returned observable is not prepended with the caches initial items.
     *
     * @param predicate The result will be filtered using the specified predicate
     */
    preview(predicate?: (obj: TObject) => boolean): Observable<IChangeSet<TObject, TKey>>;

    /**
     * A count changed observable starting with the current count
     */
    readonly countChanged: Observable<number>;
}

/**
 * A cache for observing and querying in memory data. With additional data access operators
 * @typeparam TObject The type of the object
 * @typeparam TKey The type of the key
 */
export interface IObservableCache<TObject, TKey> extends IConnectableCache<TObject, TKey>, IQuery<TObject, TKey>, IDisposable {
}

/**
 * A collection of changes.
 *
 * Changes are always published in the order.
 * @typeparam TObject The type of the object
 * @typeparam TKey The type of the key
 */
export interface IChangeSet<TObject, TKey> {
    /**
     *     Gets the number of additions
     */
    readonly adds: number;

    /**
     *     Gets the number of removes
     */
    readonly removes: number;

    /**
     * The number of refreshes
     */
    readonly refreshes: number;

    /**
     *     Gets the number of moves
     */
    readonly moves: number;

    /**
     *     The total update count
     */
    readonly count: number;

    /**
     * Gets or sets the capacity of the change set
     */
    capacity: number;
    /**
     * The number of updates
     */
    readonly Updates: number;

    /** Iterator of values in the changeset. */
    [Symbol.iterator](): IterableIterator<Change<TObject, TKey>>;

    /**
     * Returns an iterable of key, value pairs for every entry in the changeset
     */
    entries(): IterableIterator<Change<TObject, TKey>>;
}

    /// <summary>
    /// Exposes internal cache state to enable querying
    /// </summary>
    /// <typeparam name="TObject">The type of the object.</typeparam>
    /// <typeparam name="TKey">The type of the key.</typeparam>
    export interface IQuery<TObject, TKey>
    {
        /**
         *  Gets the keys
         */
        keys(): IterableIterator<TKey>;

        /**
         *  Gets the Items
         */
        values(): IterableIterator<TObject>;

        /**
         *  Gets the key value pairs
         */
        entries(): IterableIterator<[TKey, TObject]>;

        /**
         * Lookup a single item using the specified key.
         * @summary Fast indexed lookup
         * @param key The key
         */
        lookup(key: TKey): TObject | undefined;

        /**
         *  The total count of cached items
         */
        readonly count: number;

        [Symbol.iterator](): IterableIterator<[TKey, TObject]>;
    }
    /// <summary>
    /// A cache which captures all changes which are made to it. These changes are recorded until CaptureChanges() at which point thw changes are cleared.
    ///
    /// Used for creating custom operators
    /// </summary>
    /// <typeparam name="TObject">The type of the object.</typeparam>
    /// <typeparam name="TKey">The type of the key.</typeparam>
    /// <seealso cref="DynamicData.IQuery{TObject, TKey}" />
    export interface ICache<TObject, TKey> extends IQuery<TObject, TKey>
    {
        /// <summary>
        /// Clones the cache from the specified changes
        /// </summary>
        /// <param name="changes">The changes.</param>
        clone( changes: IChangeSet<TObject, TKey>): void;

        /// <summary>
        /// Adds or updates the item using the specified key
        /// </summary>
        /// <param name="item">The item.</param>
        /// <param name="key">The key.</param>
        addOrUpdate( item: TObject,  key:TKey): void;

        /// <summary>
        /// Removes the item matching the specified key.
        /// </summary>
        /// <param name="key">The key.</param>
         remove( key:TKey):void;

        /// <summary>
        /// Removes all items matching the specified keys
        /// </summary>
        remove( keys: ArrayOrIterable<TKey>): void;

        /// <summary>
        /// Clears all items
        /// </summary>
        clear(): void;

        /// <summary>
        /// Sends a signal for operators to recalculate it's state
        /// </summary>
        refresh(): void;

        /// <summary>
        /// Refreshes the items matching the specified keys
        /// </summary>
        /// <param name="keys">The keys.</param>
        refresh(keys: ArrayOrIterable<TKey> ): void;

        /// <summary>
        /// Refreshes the item matching the specified key
        /// </summary>
        refresh(key: TKey ): void;

        /**
         * The tag of this class, should return `Cache`
         */
        readonly [Symbol.toStringTag]: string;
    }

 /// <summary>
    /// Api for updating  an intermediate cache
    ///
    /// Use edit to produce singular changeset.
    ///
    /// NB:The evaluate method is used to signal to any observing operators
    /// to  reevaluate whether the the object still matches downstream operators.
    /// This is primarily targeted to inline object changes such as datetime and calculated fields.
    ///
    /// </summary>
    /// <typeparam name="TObject">The type of the object.</typeparam>
    /// <typeparam name="TKey">The type of the key.</typeparam>
export interface ICacheUpdater<TObject, TKey> extends IQuery<TObject, TKey>
    {
        /// <summary>
        /// Adds or updates the specified  key value pairs
        /// </summary>
        addOrUpdate(entries: ArrayOrIterable<[TKey, TObject]>): void;

        /// <summary>
        /// Adds or updates the specified item / key pair
        /// </summary>
        addOrUpdate(item: TObject, key: TKey): void;

        /// <summary>
        /// Sends a signal for operators to recalculate it's state
        /// </summary>
        refresh(): void;

        /// <summary>
        /// Refreshes the items matching the specified keys
        /// </summary>
        /// <param name="keys">The keys.</param>
        refresh(keys: ArrayOrIterable<TKey>): void;

        /// <summary>
        /// Refreshes the item matching the specified key
        /// </summary>
        refresh(key: TKey): void;

        /// <summary>
        ///Removes the specified keys
        /// </summary>
         remove( keys: ArrayOrIterable<TKey>): void;

        /// <summary>
        /// Overload of remove due to ambiguous method when TObject and TKey are of the same type
        /// </summary>
        /// <param name="key">The key.</param>
         removeKeys( key: ArrayOrIterable<TKey>): void;

        /// <summary>
        ///Remove the specified keys
        /// </summary>
         remove(key: TKey): void;

        /// <summary>
        /// Overload of remove due to ambiguous method when TObject and TKey are of the same type
        /// </summary>
        /// <param name="key">The key.</param>
         removeKey(key: TKey): void;

        /// <summary>
        /// Removes the specified  key value pairs
        /// </summary>
         remove(entries: ArrayOrIterable<[TKey, TObject]>): void;

        /// <summary>
        /// Clones the change set to the cache
        /// </summary>
 clone(changes: IChangeSet<TObject, TKey>): void;

        /// <summary>
        /// Clears all items from the underlying cache.
        /// </summary>
         clear(): void;

        /// <summary>
        /// Gets the key associated with the object
        /// </summary>
        /// <param name="item">The item.</param>
        /// <returns></returns>
         getKey( item: TObject): TKey;

        /// <summary>
        /// Gets the key values for the specified items
        /// </summary>
        /// <param name="entries">The items.</param>
        /// <returns></returns>
         getKeyValues(entries: ArrayOrIterable<TObject>): IterableIterator<[TKey, TObject]>;
    }

/// <summary>
    /// Api for updating  a source cache
    ///
    /// Use edit to produce singular changeset.
    ///
    /// NB:The evaluate method is used to signal to any observing operators
    /// to  reevaluate whether the the object still matches downstream operators.
    /// This is primarily targeted to inline object changes such as datetime and calculated fields.
    ///
    /// </summary>
    /// <typeparam name="TObject">The type of the object.</typeparam>
    /// <typeparam name="TKey">The type of the key.</typeparam>
    export interface ISourceUpdater<TObject, TKey> // extends ICacheUpdater<TObject, TKey>
    {
        /// <summary>
        /// Clears existing values and loads the specified items
        /// </summary>
        /// <param name="items">The items.</param>
        load( entries: ArrayOrIterable<TObject>): void ;

        /// <summary>
        /// Adds or changes the specified items.
        /// </summary>
        /// <param name="items">The items.</param>
         addOrUpdate( entries: ArrayOrIterable<TObject>): void;

        /// <summary>
        /// Adds or update the item,
        /// </summary>
        /// <param name="item">The item.</param>
        addOrUpdate(item: TObject ):void;

        /// <summary>
        /// Adds or update the item using a comparer
        /// </summary>
        /// <param name="item">The item.</param>
        /// <param name="comparer">The comparer</param>
        addOrUpdate(item: TObject , comparer: IEqualityComparer<TObject>):void;

        /// <summary>
        /// Refreshes the specified items.
        /// </summary>
        /// <param name="items">The items.</param>
         refresh(entries: ArrayOrIterable<TObject> ): void;

        /// <summary>
        ///Refreshes the specified item
        /// </summary>
        /// <param name="item">The item.</param>
        refresh(item: TObject ):void ;

        /// <summary>
        ///Removes the specified items
        /// </summary>
        /// <param name="items">The items.</param>
         remove( entries: ArrayOrIterable<TObject>): void;

        /// <summary>
        /// Removes the specified item.
        /// </summary>
        /// <param name="item">The item.</param>
         remove(item: TObject): void;
    }


    /// <summary>
    /// A cache which captures all changes which are made to it. These changes are recorded until CaptureChanges() at which point thw changes are cleared.
    ///
    /// Used for creating custom operators
    /// </summary>
    /// <typeparam name="TObject">The type of the object.</typeparam>
    /// <typeparam name="TKey">The type of the key.</typeparam>
    /// <seealso cref="DynamicData.IQuery{TObject, TKey}" />
    export interface ICache<TObject, TKey> extends IQuery<TObject, TKey>
    {
        /// <summary>
        /// Clones the cache from the specified changes
        /// </summary>
        /// <param name="changes">The changes.</param>
         clone( changes: IChangeSet<TObject, TKey>): void;

        /// <summary>
        /// Adds or updates the item using the specified key
        /// </summary>
        /// <param name="item">The item.</param>
        /// <param name="key">The key.</param>
        addOrUpdate( item: TObject,  key: TKey): void;

        /// <summary>
        /// Removes the item matching the specified key.
        /// </summary>
        /// <param name="key">The key.</param>
        remove(key: TKey): void;

        /// <summary>
        /// Removes all items matching the specified keys
        /// </summary>
        remove(keys: ArrayOrIterable<TKey>): void;

        /// <summary>
        /// Clears all items
        /// </summary>
        clear(): void;

        /// <summary>
        /// Sends a signal for operators to recalculate it's state
        /// </summary>
        refresh(): void;

        /// <summary>
        /// Refreshes the items matching the specified keys
        /// </summary>
        /// <param name="keys">The keys.</param>
        refresh(keys: ArrayOrIterable<TKey>): void;

        /// <summary>
        /// Refreshes the item matching the specified key
        /// </summary>
        refresh(key: TKey ): void;
    }

    class Cache<TObject, TKey> implements ICache<TObject, TKey>
    {
        private readonly _data: Map<TKey, TObject>;

        public get count() { return this._data.size }
        public entries() { return this._data.entries(); }
        public values() { return this._data.values(); }
        public keys() { return this._data.keys(); }

        public static empty<TObject, TKey>() { return new Cache<TObject, TKey>(); }

        public constructor(data?: Map<TKey, TObject> )
        {
            this._data = data ?? new Map<TKey, TObject>();
        }

        public clone(): void;
        public clone( changes: IChangeSet<TObject, TKey>): void;
        public clone( changes?: IChangeSet<TObject, TKey>)
        {
            if (changes === undefined) {
                return new Cache<TObject, TKey>(new Map<TKey, TObject>(this._data));
            }

            for (var item of changes)
            {
                switch (item.reason)
                {
                    case 'update':
                    case 'add':
                        {
                            this._data.set(item.key, item.current);
                        }

                        break;
                    case 'remove':
                        this._data.delete(item.key);
                        break;
                }
            }
        }

        public  lookup(key: TKey): TObject | undefined
        {
            return this._data.get(key);
        }

        public addOrUpdate(item: TObject , key: TKey )
        {
            this._data.set(key, item);
        }

        public remove(keys: ArrayOrIterable<TKey> ): void;
        public remove(key: TKey ): void;
        public remove(keys: ArrayOrIterable<TKey> | TKey )
        {
            if (Array.isArray(keys))
            {
                for (let i = 0; i < keys.length; i++) {
                    const key = keys[i];
                    if (this._data.has(key))
                    {
                        this._data.delete(key);
                    }
                }
                return;
            }
            if (isIterable(keys)) {
                for (const key of keys) {
                    if (this._data.has(key)) {
                        this._data.delete(key);
                    }
                }
                return;
            }

                if (this._data.has(keys))
                {
                    this._data.delete(keys);
                }
        }

        public clear()
        {
            this._data.clear();
        }

        public refresh(): void
        public refresh(keys: ArrayOrIterable<TKey>): void
        public refresh(key :TKey): void
        public refresh(keys?: ArrayOrIterable<TKey> | TKey )
        {

        }

        [Symbol.toStringTag]: 'Cache';
    }

 class CacheUpdater<TObject, TKey> implements ISourceUpdater<TObject, TKey>, ICacheUpdater<TObject, TKey>
{
    private readonly _cache: ICache<TObject, TKey>;
    private readonly _keySelector: (obj: TObject) => TKey;

     public constructor(cache: ICache<TObject, TKey>, keySelector: (obj: TObject) => TKey);
    //  public constructor(data: { [key: TKey]: TObject }, keySelector?: (obj: TObject) => TKey);
    public constructor( data: Map<TKey, TObject>, keySelector: (obj: TObject) => TKey);
    // public constructor(cache: ICache<TObject, TKey>,  keySelector?: (obj: TObject) => TKey)
    // {
    //     _cache = cache ?? throw new ArgumentNullException(nameof(cache));
    //     _keySelector = keySelector;
    // }


    public constructor( data: ICache<TObject, TKey> |  Map<TKey, TObject> | any, keySelector: (obj: TObject) => TKey)
    {

        if (data[Symbol.toStringTag] === 'Map') {
            // map
        } else if (data[Symbol.toStringTag] === 'Cache')
        {
            // existing cache
            }
            else {
                // object to map data
        }

        this._cache = new Cache<TObject, TKey>(data);
        this._keySelector = keySelector;
    }

    public get count() { return this._cache.count }
    public entries(): IterableIterator<[TKey, TObject]>;
    public entries( items: ArrayOrIterable<TObject>): IterableIterator<[TKey, TObject]>;
     public *entries(items?: ArrayOrIterable<TObject>): IterableIterator<[TKey, TObject]>
    {
        if (items) {
            for (const item of items ?? this._cache) {
                yield [this._keySelector(item), item];
            }
        } else {
            for (const o of this._cache.entries())
                yield o;
        }
    }
    public values() { return this._cache.values(); }
    public keys() { return this._cache.keys(); }

    public lookup(key: TKey )
    {
        return this._cache.lookup(key);
    }

    public load(items: ArrayOrIterable<TObject>)
    {
        // if (items == null)
        // {
        //     throw new ArgumentNullException(nameof(items));
        // }

        this.clear();
        this.addOrUpdate(items);
    }


    public addOrUpdate(item: TObject ,  key: TKey): void;
    public addOrUpdate(entries: ArrayOrIterable<[TKey, TObject]>): void;
     public addOrUpdate(items: ArrayOrIterable<TObject>, comparer?: IEqualityComparer<TObject>): void;
     public addOrUpdate(items: TObject): void;
     public addOrUpdate(items: TObject, comparer: IEqualityComparer<TObject>): void;
    public addOrUpdate(items: ArrayOrIterable<TObject> | ArrayOrIterable<[TKey, TObject]> | TObject, comparer?: IEqualityComparer<TObject> | TKey )
    {
        // if (items == null)
        // {
        //     throw new ArgumentNullException(nameof(items));
        // }

        // if (_keySelector == null)
        // {
        //     throw new KeySelectorException("A key selector must be specified");
        // }

        if (Array.isArray(items))
        {
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                this._cache.addOrUpdate(item, this._keySelector(item));
            }
            return;
        }
        if (isIterable(items)) {
            for (const item of items) {
                this._cache.addOrUpdate(item, this._keySelector(item));
            }
            return;
        }
        if (comparer) {

            var key = this._keySelector(items);
            var oldItem = this._cache.lookup(key);
            if (oldItem)
            {
                if (comparer.equals(oldItem, items))
                {
                    return;
                }

                this._cache.addOrUpdate(items, key);
                return;
            }

            this._cache.addOrUpdate(items, key);
            return;
        }


        this._cache.addOrUpdate(items, this._keySelector(items));
    }

    public getKey(item: TObject)
    {
        return this._keySelector(item);
    }

     public addOrUpdate(item: TObject ,  key: TKey): void;
     public addOrUpdate(entries: ArrayOrIterable<[TKey, TObject]>): void;
    public addOrUpdate(entries: ArrayOrIterable<[TKey, TObject]> | TObject,  key?: TKey )
    {
        if (Array.isArray(entries)) {
            for (let i = 0; i < entries.length; i++) {
                const item = entries[i];
                this._cache.addOrUpdate(item[1], item[0]);
            }
            return;
        }
        if (isIterable(entries)) {
            for (const item of entries) {
                this._cache.addOrUpdate(item[1], item[0]);
            }
            return;
        }

        if (key !== undefined) {
            this._cache.addOrUpdate(entries, key);
        }
    }


    public refresh(): void;
    public  refresh(items: ArrayOrIterable<TObject>): void;
    public  refresh(items: ArrayOrIterable<TKey>): void;
    public  refresh(item: TKey): void;
    public  refresh(item: TObject): void;
    public refresh( items?: ArrayOrIterable<TObject> | ArrayOrIterable<TKey> | TObject | TKey)
    {
        if (!items) {
            this._cache.refresh();
        }

        if (Array.isArray(items))
        {
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                this._cache.refresh(item);
            }
            return;
        }
        if (isIterable(items)) {
            for (const item of items) {
                this._cache.refresh(item);
            }
            return;
        }
        this._cache.Refresh();
    }

    public void Remove(IEnumerable<TObject> items)
    {
        if (items == null)
        {
            throw new ArgumentNullException(nameof(items));
        }

        if (items is IList<TObject> list)
        {
            //zero allocation enumerator
            var enumerable = EnumerableIList.Create(list);
            foreach (var item in enumerable)
            {
                Remove(item);
            }
        }
        else
        {
            foreach (var item in items)
            {
                Remove(item);
            }
        }
    }

    public void Remove(IEnumerable<TKey> keys)
    {
        if (keys == null)
        {
            throw new ArgumentNullException(nameof(keys));
        }

        if (keys is IList<TKey> list)
        {
            //zero allocation enumerator
            var enumerable = EnumerableIList.Create(list);
            foreach (var key in enumerable)
            {
                Remove(key);
            }
        }
        else
        {
            foreach (var key in keys)
            {
                Remove(key);
            }
        }
    }

    public void RemoveKeys(IEnumerable<TKey> keys)
    {
        if (keys == null)
        {
            throw new ArgumentNullException(nameof(keys));
        }

        _cache.Remove(keys);
    }

    public void Remove(TObject item)
    {
        if (_keySelector == null)
        {
            throw new KeySelectorException("A key selector must be specified");
        }

        var key = _keySelector(item);
        _cache.Remove(key);
    }

    public Optional<TObject> Lookup(TObject item)
    {
        if (_keySelector == null)
        {
            throw new KeySelectorException("A key selector must be specified");
        }

        TKey key = _keySelector(item);
        return Lookup(key);
    }

    public void Remove(TKey key)
    {
        _cache.Remove(key);
    }

    public void RemoveKey(TKey key)
    {
        Remove(key);
    }

    public void Remove(IEnumerable<[TKey, TObject]> items)
    {
        if (items == null)
        {
            throw new ArgumentNullException(nameof(items));
        }

        if (items is IList<TObject> list)
        {
            //zero allocation enumerator
            var enumerable = EnumerableIList.Create(list);
            foreach (var key in enumerable)
            {
                Remove(key);
            }
        }
        else
        {
            foreach (var key in items)
            {
                Remove(key);
            }
        }
    }

    public void Remove([TKey, TObject] item)
    {
        Remove(item.Key);
    }

    public void Clear()
    {
        _cache.Clear();
    }

    public int Count => _cache.Count;

    public void Update(IChangeSet<TObject, TKey> changes)
    {
        _cache.Clone(changes);
    }

    public void Clone(IChangeSet<TObject, TKey> changes)
    {
        _cache.Clone(changes);
    }
}


class ReaderWriter<TObject, TKey>
{
    private readonly _keySelector: (obj: TObject) => TKey;
    private _data = new Map<TKey, TObject>(); //could do with priming this on first time load
    private CacheUpdater<TObject, TKey> _activeUpdater;

    private readonly object _locker = new object();

    public ReaderWriter(Func<TObject, TKey> keySelector = null) => _keySelector = keySelector;

    #region Writers

    public ChangeSet<TObject, TKey> Write(IChangeSet<TObject, TKey> changes, Action<ChangeSet<TObject, TKey>> previewHandler, bool collectChanges)
    {
        if (changes == null)
        {
            throw new ArgumentNullException(nameof(changes));
        }

        return DoUpdate(updater => updater.Clone(changes), previewHandler, collectChanges);
    }

    public ChangeSet<TObject, TKey> Write(Action<ICacheUpdater<TObject, TKey>> updateAction, Action<ChangeSet<TObject, TKey>> previewHandler, bool collectChanges)
    {
        if (updateAction == null)
        {
            throw new ArgumentNullException(nameof(updateAction));
        }

        return DoUpdate(updateAction, previewHandler, collectChanges);
    }

    public ChangeSet<TObject, TKey> Write(Action<ISourceUpdater<TObject, TKey>> updateAction, Action<ChangeSet<TObject, TKey>> previewHandler, bool collectChanges)
    {
        if (updateAction == null)
        {
            throw new ArgumentNullException(nameof(updateAction));
        }

        return DoUpdate(updateAction, previewHandler, collectChanges);
    }

    private ChangeSet<TObject, TKey> DoUpdate(Action<CacheUpdater<TObject, TKey>> updateAction, Action<ChangeSet<TObject, TKey>> previewHandler, bool collectChanges)
    {
        lock (_locker)
        {
            if (previewHandler != null)
            {
                var copy = new Dictionary<TKey, TObject>(_data);
                var changeAwareCache = new ChangeAwareCache<TObject, TKey>(_data);

                _activeUpdater = new CacheUpdater<TObject, TKey>(changeAwareCache, _keySelector);
                updateAction(_activeUpdater);
                _activeUpdater = null;

                var changes = changeAwareCache.CaptureChanges();

                InternalEx.Swap(ref copy, ref _data);
                previewHandler(changes);
                InternalEx.Swap(ref copy, ref _data);

                return changes;
            }

            if (collectChanges)
            {
                var changeAwareCache = new ChangeAwareCache<TObject, TKey>(_data);

                _activeUpdater = new CacheUpdater<TObject, TKey>(changeAwareCache, _keySelector);
                updateAction(_activeUpdater);
                _activeUpdater = null;

                return changeAwareCache.CaptureChanges();
            }

            _activeUpdater = new CacheUpdater<TObject, TKey>(_data, _keySelector);
            updateAction(_activeUpdater);
            _activeUpdater = null;

            return ChangeSet<TObject, TKey>.Empty;
        }
    }

    internal void WriteNested(Action<ISourceUpdater<TObject, TKey>> updateAction)
    {
        lock (_locker)
        {
            if (_activeUpdater == null)
            {
                throw new InvalidOperationException("WriteNested can only be used if another write is already in progress.");
            }

            updateAction(_activeUpdater);
        }
    }

    #endregion

    #region Accessors

    public ChangeSet<TObject, TKey> GetInitialUpdates( Func<TObject, bool> filter = null)
    {
        lock (_locker)
        {
            var dictionary = _data;

            if (dictionary.Count == 0)
            {
                return ChangeSet<TObject, TKey>.Empty;
            }

            var changes = filter == null
                ? new ChangeSet<TObject, TKey>(dictionary.Count)
                : new ChangeSet<TObject, TKey>();

            foreach (var kvp in dictionary)
            {
                if (filter == null || filter(kvp.Value))
                {
                    changes.Add(new Change<TObject, TKey>(ChangeReason.Add, kvp.Key, kvp.Value));
                }
            }

            return changes;
        }
    }

    public TKey[] Keys
    {
        get
        {
            lock (_locker)
            {
                TKey[] result = new TKey[_data.Count];
                _data.Keys.CopyTo(result, 0);
                return result;
            }
        }
    }

    public [TKey, TObject][] KeyValues
    {
        get
        {
            lock (_locker)
            {
                [TKey, TObject][] result = new [TKey, TObject][_data.Count];
                int i = 0;
                foreach (var kvp in _data)
                {
                    result[i] = kvp;
                    i++;
                }

                return result;
            }
        }
    }

    public TObject[] Items
    {
        get
        {
            lock (_locker)
            {
                TObject[] result = new TObject[_data.Count];
                _data.Values.CopyTo(result, 0);
                return result;
            }
        }
    }

    public Optional<TObject> Lookup(TKey key)
    {
        lock (_locker)
        {
            return _data.Lookup(key);
        }
    }

    public int Count
    {
        get
        {
            lock (_locker)
            {
                return _data.Count;
            }
        }
    }

    #endregion
}


class ObservableCache<TObject, TKey> implements IObservableCache<TObject, TKey> {
    private readonly _changes = new Subject<IChangeSet<TObject, TKey>>();
    private readonly _changesPreview = new Subject<IChangeSet<TObject, TKey>>();
    private readonly _countChanged = new Lazy<Subject<number>>(() => new Subject<number>());
    // private readonly  _readerWriter: ReaderWriter<TObject, TKey>;
    private readonly _cleanUp: IDisposable;

    /**
     *
     */
    constructor(source: Observable<IChangeSet<TObject, TKey>>) {
        // _readerWriter = new ReaderWriter<TObject, TKey>();

        var loader = source
            .pipe(
                finalize(() => {
                    this._changes.complete();
                    this._changesPreview.complete();
                })
            )
            .subscribe(
                changeset => {
                    var previewHandler = this._changesPreview.observers.length ? InvokePreview : undefined;
                    var changes = _readerWriter.Write(changeset, previewHandler, this._changesPreview.observers.length);
                    InvokeNext(changes);
                },
                ex => {
                    this._changesPreview.error(ex);
                    this._changes.error(ex);
                }
            );

        this._cleanUp = Disposable.create(() => {
            loader.dispose();
            this._changes.complete();
            this._changesPreview.complete();
            if (this._countChanged.isValueCreated) {
                this._countChanged.value!.complete();
            }
        });
    }
    /*
    private readonly Subject<ChangeSet<TObject, TKey>> _changes = new Subject<ChangeSet<TObject, TKey>>();
    private readonly Subject<ChangeSet<TObject, TKey>> _changesPreview = new Subject<ChangeSet<TObject, TKey>>();
    private readonly Lazy<ISubject<int>> _countChanged = new Lazy<ISubject<int>>(() => new Subject<int>());
    private readonly ReaderWriter<TObject, TKey> _readerWriter;
    private readonly IDisposable _cleanUp;
    private readonly object _locker = new object();
    private readonly object _writeLock = new object();

    private int _editLevel; // The level of recursion in editing.

    public ObservableCache(IObservable<IChangeSet<TObject, TKey>> source)
    {
        _readerWriter = new ReaderWriter<TObject, TKey>();

        var loader = source.Synchronize(_locker)
            .Finally(()=>
            {
                _changes.OnCompleted();
                _changesPreview.OnCompleted();
            })
            .Subscribe(changeset =>
            {
                var previewHandler = _changesPreview.HasObservers ? (Action<ChangeSet<TObject, TKey>>)InvokePreview : null;
                var changes = _readerWriter.Write(changeset, previewHandler, _changes.HasObservers);
                InvokeNext(changes);
            }, ex =>
            {
                _changesPreview.OnError(ex);
                _changes.OnError(ex);
            });

        _cleanUp = Disposable.Create(() =>
        {
            loader.Dispose();
            _changes.OnCompleted();
            _changesPreview.OnCompleted();
            if (_countChanged.IsValueCreated)
            {
                _countChanged.Value.OnCompleted();
            }
        });
    }

    public ObservableCache(Func<TObject, TKey> keySelector = null)
    {
        _readerWriter = new ReaderWriter<TObject, TKey>(keySelector);

        _cleanUp = Disposable.Create(() =>
        {
            _changes.OnCompleted();
            _changesPreview.OnCompleted();
            if (_countChanged.IsValueCreated)
            {
                _countChanged.Value.OnCompleted();
            }
        });
    }

    internal void UpdateFromIntermediate(Action<ICacheUpdater<TObject, TKey>> updateAction)
    {
        if (updateAction == null)
        {
            throw new ArgumentNullException(nameof(updateAction));
        }

        lock (_writeLock)
        {
            ChangeSet<TObject, TKey> changes = null;

            _editLevel++;
            if (_editLevel == 1)
            {
                var previewHandler = _changesPreview.HasObservers ? (Action<ChangeSet<TObject, TKey>>)InvokePreview : null;
                changes = _readerWriter.Write(updateAction, previewHandler, _changes.HasObservers);
            }
            else
            {
                _readerWriter.WriteNested(updateAction);
            }

            _editLevel--;

            if (_editLevel == 0)
            {
                InvokeNext(changes);
            }
        }
    }

    internal void UpdateFromSource(Action<ISourceUpdater<TObject, TKey>> updateAction)
    {
        if (updateAction == null)
        {
            throw new ArgumentNullException(nameof(updateAction));
        }

        lock (_writeLock)
        {
            ChangeSet<TObject, TKey> changes = null;

            _editLevel++;
            if (_editLevel == 1)
            {
                var previewHandler = _changesPreview.HasObservers ? (Action<ChangeSet<TObject, TKey>>)InvokePreview : null;
                changes = _readerWriter.Write(updateAction, previewHandler, _changes.HasObservers);
            }
            else
            {
                _readerWriter.WriteNested(updateAction);
            }

            _editLevel--;

            if (_editLevel == 0)
            {
                InvokeNext(changes);
            }
        }
    }

    private void InvokePreview(ChangeSet<TObject, TKey> changes)
    {
        lock (_locker)
        {
            if (changes.Count != 0)
            {
                _changesPreview.OnNext(changes);
            }
        }
    }

    private void InvokeNext(ChangeSet<TObject, TKey> changes)
    {
        lock (_locker)
        {
            if (changes.Count != 0)
            {
                _changes.OnNext(changes);
            }

            if (_countChanged.IsValueCreated)
            {
                _countChanged.Value.OnNext(_readerWriter.Count);
            }
        }
    }

    public IObservable<int> CountChanged => _countChanged.Value.StartWith(_readerWriter.Count).DistinctUntilChanged();

    public IObservable<Change<TObject, TKey>> Watch(TKey key)
    {
        return Observable.Create<Change<TObject, TKey>>
        (
            observer =>
            {
                lock (_locker)
                {
                    var initial = _readerWriter.Lookup(key);
                    if (initial.HasValue)
                    {
                        observer.OnNext(new Change<TObject, TKey>(ChangeReason.Add, key, initial.Value));
                    }

                    return _changes.Finally(observer.OnCompleted).Subscribe(changes =>
                    {
                        foreach (var change in changes)
                        {
                            var match = EqualityComparer<TKey>.Default.Equals(change.Key, key);
                            if (match)
                            {
                                observer.OnNext(change);
                            }
                        }
                    });
                }
            });
    }

    public IObservable<IChangeSet<TObject, TKey>> Connect(Func<TObject, bool> predicate = null)
    {
        return Observable.Defer(() =>
        {
            lock (_locker)
            {
                var initial = GetInitialUpdates(predicate);
                var changes = Observable.Return(initial).Concat(_changes);

                return (predicate == null ? changes : changes.Filter(predicate)).NotEmpty();
            }
        });
    }

    public IObservable<IChangeSet<TObject, TKey>> Preview(Func<TObject, bool> predicate = null)
    {
        return predicate == null ? _changesPreview : _changesPreview.Filter(predicate);
    }

    internal ChangeSet<TObject, TKey> GetInitialUpdates(Func<TObject, bool> filter = null) => _readerWriter.GetInitialUpdates(filter);

    public Optional<TObject> Lookup(TKey key) => _readerWriter.Lookup(key);

    public IEnumerable<TKey> Keys => _readerWriter.Keys;

    public IEnumerable<[TKey, TObject]> KeyValues => _readerWriter.KeyValues;

    public IEnumerable<TObject> Items => _readerWriter.Items;

    public int Count => _readerWriter.Count;

    public void Dispose() => _cleanUp.Dispose();
    */
    keys: IterableIterator<TKey>;
    values: IterableIterator<TObject>;
    entries: IterableIterator<[TKey, TObject]>;
    lookup(key: TKey): TObject | undefined {
        throw new Error('Method not implemented.');
    }
    count: number;
    watch(key: TKey): Observable<Change<TObject, TKey>> {
        throw new Error('Method not implemented.');
    }
    connect(predicate?: ((obj: TObject) => boolean) | undefined): Observable<IChangeSet<TObject, TKey>> {
        throw new Error('Method not implemented.');
    }
    preview(predicate?: ((obj: TObject) => boolean) | undefined): Observable<IChangeSet<TObject, TKey>> {
        throw new Error('Method not implemented.');
    }
    countChanged: Observable<number>;
}

import { CompositeDisposable, IDisposable } from '../util';
import { SourceCache } from './SourceCache';
import { asObservableCache } from './operators/asObservableCache';
import { IObservableCache } from './IObservableCache';
import { ISourceUpdater } from './ISourceUpdater';

/**
 * Node describing the relationship between and item and it's ancestors and descendent
 * @typeparam TObject The type of the object
 * @typeparam TKey The type of the key
 */
export class Node<TObject, TKey> implements IDisposable {
    private readonly _children = new SourceCache<Node<TObject, TKey>, TKey>(n => n.key);
    private readonly _cleanUp: IDisposable;
    private _parent?: Node<TObject, TKey>;

    /**
     * Initializes a new instance of the <see cref="Node{TObject, TKey}"/> class.
     * @param item The item
     * @param key The key
     * @param parent The parent
     */
    public constructor(item: TObject, key: TKey, parent?: Node<TObject, TKey>) {
        this.item = item;
        this.key = key;
        this._parent = parent;
        this.children = asObservableCache(this._children);
        this._cleanUp = new CompositeDisposable(this.children, this._children);
    }

    /**
     * The item
     */
    public readonly item: TObject;

    /**
     * The key
     */
    public readonly key: TKey;

    /**
     * Gets the parent if it has one
     */
    public get parent() {
        return this._parent;
    }

    /**
     * The child nodes
     */
    public readonly children: IObservableCache<Node<TObject, TKey>, TKey>;

    /**
     * Gets or sets a value indicating whether this instance is root.
     */
    public get isRoot() {
        return this.parent === undefined;
    }

    /**
     * Gets the depth i.e. how many degrees of separation from the parent
     */
    public get depth() {
        let i = 0;
        let parent = this.parent;
        do {
            if (parent === undefined) {
                break;
            }

            i++;
            parent = parent.parent;
            // eslint-disable-next-line no-constant-condition
        } while (true);
        return i;
    }

    /**
     * @internal
     */
    public update(updateAction: (updater: ISourceUpdater<Node<TObject, TKey>, TKey>) => void) {
        this._children.edit(updateAction);
    }

    /**
     * @internal
     */
    public setParent(parent: Node<TObject, TKey> | undefined) {
        this._parent = parent;
    }

    public toString() {
        const count = this.children.size === 0 ? '' : ` (${this.children.size} children)`;
        return `${this.item}${count}`;
    }

    public dispose() {
        this._cleanUp.dispose();
    }
}

/**
///     Object used to capture accumulated changes
 */
export class ChangeStatistics {
    /**
///     Initializes a new instance of the <see cref="T:System.Object" /> class.
 */
    public constructor(index?: number, adds?: number, updates?: number, removes?: number, refreshes?: number, moves?: number, count?: number) {
        this.index = index ?? -1;
        this.adds = adds ?? 0;
        this.updates = updates ?? 0;
        this.removes = removes ?? 0;
        this.refreshes = refreshes ?? 0;
        this.moves = moves ?? 0;
        this.count = count ?? 0;
        this.lastUpdated = new Date();
    }

    /**
///     Gets the adds.
 */
    /// <value>
    ///     The adds.
    /// </value>
    public readonly adds: number;

    /**
///     Gets the updates.
 */
    /// <value>
    ///     The updates.
    /// </value>
    public readonly updates: number;

    /**
///     Gets the removes.
 */
    /// <value>
    ///     The removes.
    /// </value>
    public readonly removes: number;

    /**
///     Gets the refreshes.
 */
    /// <value>
    ///     The refreshes.
    /// </value>
    public readonly refreshes: number;

    /**
///     Gets the count.
 */
    /// <value>
    ///     The count.
    /// </value>
    public readonly count: number;

    /**
///     Gets the index.
 */
    /// <value>
    ///     The index.
    /// </value>
    public readonly index: number;

    /**
///     Gets the moves.
 */
    /// <value>
    ///     The moves.
    /// </value>
    public readonly moves: number;

    /**
///     Gets the last updated.
 */
    /// <value>
    ///     The last updated.
    /// </value>
    public readonly lastUpdated: Date;

    /// <inheritdoc />
    public toString() {
        return `CurrentIndex: ${this.index}, Adds: ${this.adds}, Updates: ${this.updates}, Removes: ${this.removes}, Refreshes: ${this.refreshes}, Size: ${this.count}, Timestamp: ${this.lastUpdated}`;
    }
}

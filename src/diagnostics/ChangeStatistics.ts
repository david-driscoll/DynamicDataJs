/// <summary>
///     Object used to capture accumulated changes
/// </summary>
export class ChangeStatistics {
    /// <summary>
///     Initializes a new instance of the <see cref="T:System.Object" /> class.
/// </summary>
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

/// <summary>
///     Gets the adds.
/// </summary>
/// <value>
///     The adds.
/// </value>
    public readonly adds: number;

/// <summary>
///     Gets the updates.
/// </summary>
/// <value>
///     The updates.
/// </value>
    public readonly updates: number;

/// <summary>
///     Gets the removes.
/// </summary>
/// <value>
///     The removes.
/// </value>
    public readonly removes: number;

/// <summary>
///     Gets the refreshes.
/// </summary>
/// <value>
///     The refreshes.
/// </value>
    public readonly refreshes: number;

/// <summary>
///     Gets the count.
/// </summary>
/// <value>
///     The count.
/// </value>
    public readonly count: number;

/// <summary>
///     Gets the index.
/// </summary>
/// <value>
///     The index.
/// </value>
    public readonly index: number;

/// <summary>
///     Gets the moves.
/// </summary>
/// <value>
///     The moves.
/// </value>
    public readonly moves: number;

/// <summary>
///     Gets the last updated.
/// </summary>
/// <value>
///     The last updated.
/// </value>
    public readonly lastUpdated: Date;

    /// <inheritdoc />
    public toString() {
        return `CurrentIndex: ${this.index}, Adds: ${this.adds}, Updates: ${this.updates}, Removes: ${this.removes}, Refreshes: ${this.refreshes}, Size: ${this.count}, Timestamp: ${this.lastUpdated}`;
    }

}
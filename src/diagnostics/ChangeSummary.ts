/**
/// Accumulates change statics
 */
import { ChangeStatistics } from './ChangeStatistics';

export class ChangeSummary
{
    private readonly  _index: number;

    /**
    /// An empty instance of change summary
     */
    public static readonly empty = new ChangeSummary();

    /**
    ///     Initializes a new instance of the <see cref="T:System.Object" /> class.
     */
    public constructor( index?: number,  latest?: ChangeStatistics,  overall?: ChangeStatistics)
{
    this.latest = latest ?? new ChangeStatistics();
    this.overall = overall ?? new ChangeStatistics();
    this._index = index ?? -1;
}

/**
/// Gets the latest change
 */
/// <value>
/// The latest.
/// </value>
public readonly latest: ChangeStatistics;

/**
/// Gets the overall change count
 */
/// <value>
/// The overall.
/// </value>
public readonly overall: ChangeStatistics;

/// <inheritdoc />
public toString() { return `CurrentIndex: ${this._index}, Latest Size: ${this.latest.count}, Overall Size: ${this.overall.count}`; }
}
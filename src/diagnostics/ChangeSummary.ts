/// <summary>
/// Accumulates change statics
/// </summary>
import { ChangeStatistics } from './ChangeStatistics';

export class ChangeSummary
{
    private readonly  _index: number;

    /// <summary>
    /// An empty instance of change summary
    /// </summary>
    public static readonly empty = new ChangeSummary();

    /// <summary>
    ///     Initializes a new instance of the <see cref="T:System.Object" /> class.
    /// </summary>
    public constructor( index?: number,  latest?: ChangeStatistics,  overall?: ChangeStatistics)
{
    this.latest = latest ?? new ChangeStatistics();
    this.overall = overall ?? new ChangeStatistics();
    this._index = index ?? -1;
}

/// <summary>
/// Gets the latest change
/// </summary>
/// <value>
/// The latest.
/// </value>
public readonly latest: ChangeStatistics;

/// <summary>
/// Gets the overall change count
/// </summary>
/// <value>
/// The overall.
/// </value>
public readonly overall: ChangeStatistics;

/// <inheritdoc />
public toString() { return `CurrentIndex: ${this._index}, Latest Size: ${this.latest.count}, Overall Size: ${this.overall.count}`; }
}
/**
 * Response from the pagination operator
 */
export type PageResponse = {
    /**
     * The size of the page.
     */
    readonly pageSize: number;
    /**
     * The current page
     */
    readonly page: number;
    /**
     * Total number of pages.
     */
    readonly pages: number;
    /**
     * The total number of records in the underlying cache
     */
    readonly totalSize: number;
};

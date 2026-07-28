export interface ISearchProvider {
    readonly name: string;
    search(query: string, maxResults: number): Promise<{
        title: string;
        url: string;
        snippet?: string;
    }[]>;
}

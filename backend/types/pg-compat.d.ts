declare module 'pg' {
    export type QueryResultRow = Record<string, unknown>;

    export interface QueryResult<R extends QueryResultRow = QueryResultRow> {
        command: string;
        rowCount: number | null;
        oid: number;
        rows: R[];
        fields: unknown[];
    }

    export interface PoolClient {
        query<R extends QueryResultRow = QueryResultRow>(text: string, values?: unknown[]): Promise<QueryResult<R>>;
        release(err?: boolean | Error): void;
    }

    export class Pool {
        constructor(config?: Record<string, unknown>);
        connect(): Promise<PoolClient>;
        query<R extends QueryResultRow = QueryResultRow>(text: string, values?: unknown[]): Promise<QueryResult<R>>;
        end(): Promise<void>;
    }
}

// 최소 pg 타입 선언 (@types/pg 미설치 — NAS pnpm 제약). 오거나이저 생성 라우트 전용.
declare module 'pg' {
  export interface QueryResult<R = Record<string, unknown>> {
    rows: R[];
    rowCount: number | null;
  }
  export class Client {
    constructor(config?: { connectionString?: string });
    connect(): Promise<void>;
    query<R = Record<string, unknown>>(text: string, values?: unknown[]): Promise<QueryResult<R>>;
    end(): Promise<void>;
  }
  const pg: { Client: typeof Client };
  export default pg;
}

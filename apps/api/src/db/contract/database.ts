export type DbParams = Record<string, any> | any[];

export interface ExecuteResult {
  changes: number;
  lastInsertRowid?: number | bigint;
}

export interface HealthStatus {
  status: 'ok' | 'error';
  engine: string;
  latencyMs: number;
  timestamp: string;
}

export interface TransactionContext {
  query<T>(sql: string, params?: DbParams): Promise<T[]>;
  execute(sql: string, params?: DbParams): Promise<ExecuteResult>;
}

export interface IDatabase {
  query<T>(sql: string, params?: DbParams): Promise<T[]>;
  execute(sql: string, params?: DbParams): Promise<ExecuteResult>;
  transaction<T>(work: (tx: TransactionContext) => Promise<T>): Promise<T>;
  healthCheck(): Promise<HealthStatus>;
  close(): Promise<void>;
}

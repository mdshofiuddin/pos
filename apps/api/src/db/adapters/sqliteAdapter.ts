import { DatabaseSync } from 'node:sqlite';
import { IDatabase, DbParams, ExecuteResult, HealthStatus, TransactionContext } from '../contract/database.js';

export class SqliteAdapter implements IDatabase {
  private db: DatabaseSync;
  private inTransaction = false;

  constructor(filePath: string) {
    this.db = new DatabaseSync(filePath);
    // Optimize performance and durability
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec('PRAGMA foreign_keys = ON;');
    this.db.exec('PRAGMA busy_timeout = 5000;');
  }

  private normalizeParams(params?: DbParams): any[] {
    if (!params) return [];
    if (Array.isArray(params)) return params;
    // If it's a named object, convert to positional or pass as object if supported
    return [params];
  }

  async query<T>(sql: string, params?: DbParams): Promise<T[]> {
    try {
      const stmt = this.db.prepare(sql);
      const normalized = this.normalizeParams(params);
      const rows = stmt.all(...normalized);
      return rows as T[];
    } catch (err: any) {
      throw new Error(`[Database Query Error]: ${err.message}`);
    }
  }

  async execute(sql: string, params?: DbParams): Promise<ExecuteResult> {
    try {
      const stmt = this.db.prepare(sql);
      const normalized = this.normalizeParams(params);
      const result = stmt.run(...normalized);
      return {
        changes: Number(result.changes),
        lastInsertRowid: result.lastInsertRowid,
      };
    } catch (err: any) {
      throw new Error(`[Database Execute Error]: ${err.message}`);
    }
  }

  async transaction<T>(work: (tx: TransactionContext) => Promise<T>): Promise<T> {
    this.db.exec('BEGIN IMMEDIATE');
    this.inTransaction = true;
    const txContext: TransactionContext = {
      query: async <K>(sql: string, params?: DbParams) => this.query<K>(sql, params),
      execute: async (sql: string, params?: DbParams) => this.execute(sql, params),
    };

    try {
      const result = await work(txContext);
      this.db.exec('COMMIT');
      this.inTransaction = false;
      return result;
    } catch (error) {
      try {
        this.db.exec('ROLLBACK');
      } catch {
        // ignore rollback error if already rolled back
      }
      this.inTransaction = false;
      throw error;
    }
  }

  async healthCheck(): Promise<HealthStatus> {
    const start = Date.now();
    try {
      this.db.prepare('SELECT 1 as ping').get();
      return {
        status: 'ok',
        engine: 'sqlite (node:sqlite)',
        latencyMs: Date.now() - start,
        timestamp: new Date().toISOString(),
      };
    } catch (err: any) {
      return {
        status: 'error',
        engine: 'sqlite (node:sqlite)',
        latencyMs: Date.now() - start,
        timestamp: new Date().toISOString(),
      };
    }
  }

  async close(): Promise<void> {
    this.db.close();
  }

  // Raw exec for migration DDL scripts
  exec(sql: string): void {
    this.db.exec(sql);
  }
}

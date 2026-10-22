import path from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config/index.js';
import { IDatabase } from './contract/database.js';
import { SqliteAdapter } from './adapters/sqliteAdapter.js';

let dbInstance: SqliteAdapter | null = null;

export function getDb(): IDatabase {
  if (!dbInstance) {
    const dbFilePath = path.isAbsolute(config.dbPath)
      ? config.dbPath
      : path.resolve(process.cwd(), config.dbPath);
    dbInstance = new SqliteAdapter(dbFilePath);
  }
  return dbInstance;
}

export function getSqliteAdapter(): SqliteAdapter {
  return getDb() as SqliteAdapter;
}

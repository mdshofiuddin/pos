import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getSqliteAdapter } from '../index.js';
import { SCHEMA_SQL } from './schemaSql.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMigrations() {
  console.log('[Migration] Starting database schema migration...');
  let sql = SCHEMA_SQL;

  try {
    const candidatePaths = [
      path.resolve(__dirname, 'schema.sql'),
      path.resolve(__dirname, '../../src/db/migrations/schema.sql'),
      path.resolve(process.cwd(), 'apps/api/src/db/migrations/schema.sql'),
      path.resolve(process.cwd(), 'src/db/migrations/schema.sql'),
    ];
    const foundPath = candidatePaths.find((p) => fs.existsSync(p));
    if (foundPath) {
      sql = fs.readFileSync(foundPath, 'utf8');
    }
  } catch {
    // Uses pre-bundled SCHEMA_SQL
  }

  const adapter = getSqliteAdapter();
  adapter.exec(sql);
  console.log('[Migration] Schema migration completed successfully.');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[Migration Error]:', err);
      process.exit(1);
    });
}


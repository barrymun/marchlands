import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from '#/schema.ts';

// bigint columns hold epoch-ms timestamps and ids that fit in a double; parse as numbers.
pg.types.setTypeParser(pg.types.builtins.INT8, (v) => Number(v));
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (v) => Number(v));

type Schema = typeof schema;
export type Db = NodePgDatabase<Schema>;
/** A transaction handle (same query API as Db). */
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

export interface Database {
  pool: pg.Pool;
  db: Db;
  close: () => Promise<void>;
}

export function connect(url = process.env.DATABASE_URL, max = Number(process.env.DB_POOL_SIZE ?? 20)): Database {
  if (!url) throw new Error('DATABASE_URL is not set');
  const pool = new pg.Pool({ connectionString: url, max });
  const db = drizzle(pool, { schema });
  return { pool, db, close: () => pool.end() };
}

/**
 * Postgres array literal for a single bound parameter (drizzle expands JS arrays inside sql``
 * into one parameter per element). Use as sql`... = any(${pgArray(ids)}::int[])`.
 */
export function pgArray(values: readonly (number | string)[]): string {
  return `{${values.map((v) => (typeof v === 'number' ? String(v) : `"${v.replace(/["\\]/g, (c) => `\\${c}`)}"`)).join(',')}}`;
}

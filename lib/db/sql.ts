import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";
import type { Pool, PoolClient } from "pg";
import { getPool, type SqlValue } from "@/lib/db/connection";

export type SqlResult = { changes: number };

/**
 * Translates `?` placeholders to Postgres `$1..$n`. Question marks inside single-quoted string
 * literals are left alone. Keeping the `?` convention lets ported service SQL stay unchanged.
 */
export function toPositionalParameters(sql: string): string {
  let out = "";
  let index = 0;
  let inString = false;
  for (let i = 0; i < sql.length; i += 1) {
    const char = sql[i];
    if (char === "'") {
      inString = !inString;
      out += char;
      continue;
    }
    if (char === "?" && !inString) {
      index += 1;
      out += `$${index}`;
      continue;
    }
    out += char;
  }
  return out;
}

function normalizeParameters(parameters: SqlValue[]): unknown[] {
  return parameters.map((value) => (value instanceof Uint8Array ? Buffer.from(value) : value));
}

// Transactions bind their client to the async context, so every query/queryOne/run call made
// anywhere inside a tx callback automatically joins that transaction — services do not need to
// thread a handle, and concurrent requests can never share each other's transactions.
type TxContext = { client: PoolClient; depth: number };
const txStorage = new AsyncLocalStorage<TxContext>();

async function executor(): Promise<Pool | PoolClient> {
  const context = txStorage.getStore();
  if (context) return context.client;
  return getPool();
}

async function execute<T>(sql: string, parameters: SqlValue[]) {
  const client = await executor();
  const result = await client.query(toPositionalParameters(sql), normalizeParameters(parameters));
  return { rows: result.rows as T[], rowCount: result.rowCount ?? 0 };
}

export async function query<T>(sql: string, parameters: SqlValue[] = []): Promise<T[]> {
  return (await execute<T>(sql, parameters)).rows;
}

export async function queryOne<T>(sql: string, parameters: SqlValue[] = []): Promise<T | null> {
  const rows = await query<T>(sql, parameters);
  return rows[0] ?? null;
}

export async function run(sql: string, parameters: SqlValue[] = []): Promise<SqlResult> {
  return { changes: (await execute(sql, parameters)).rowCount };
}

/**
 * Runs `work` inside a transaction on a single pooled client. Nested calls reuse the ambient
 * transaction via savepoints, so services compose without tracking transactional context.
 */
export async function tx<T>(work: () => Promise<T>): Promise<T> {
  const existing = txStorage.getStore();

  if (existing) {
    const savepoint = `careersrx_sp_${existing.depth}`;
    await existing.client.query(`SAVEPOINT ${savepoint}`);
    const nested: TxContext = { client: existing.client, depth: existing.depth + 1 };
    try {
      const result = await txStorage.run(nested, work);
      await existing.client.query(`RELEASE SAVEPOINT ${savepoint}`);
      return result;
    } catch (error) {
      await existing.client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
      throw error;
    }
  }

  const pool = await getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await txStorage.run({ client, depth: 1 }, work);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

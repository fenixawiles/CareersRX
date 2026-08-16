import "server-only";

import { Pool, types } from "pg";
import { ensureMigrated } from "@/lib/db/migrate";

export type SqlValue = string | number | boolean | bigint | null | Uint8Array;

const POOL_KEY = Symbol.for("careersrx.pg.pool");
const BUILD_PHASE = "phase-production-build";

// Services were written against string timestamps, JSON.parse-on-read blobs, and Number() counts.
// These parsers keep those contracts stable so the Postgres port stays mechanical:
//  - timestamptz/timestamp come back as ISO strings, not Date objects
//  - json/jsonb come back as raw JSON text for the existing JSON.parse call sites
//  - int8 (COUNT/SUM) comes back as a JS number instead of a string
types.setTypeParser(types.builtins.TIMESTAMPTZ, (value) => new Date(value).toISOString());
types.setTypeParser(types.builtins.TIMESTAMP, (value) => new Date(`${value}Z`).toISOString());
types.setTypeParser(types.builtins.JSONB, (value) => value);
types.setTypeParser(types.builtins.JSON, (value) => value);
types.setTypeParser(types.builtins.INT8, (value) => Number(value));

export class DatabaseUnavailableDuringBuildError extends Error {
  constructor() {
    super(
      "CareersRX Postgres was opened while Next.js was building. Database connections and migrations are runtime-only.",
    );
    this.name = "DatabaseUnavailableDuringBuildError";
  }
}

export class DatabaseNotConfiguredError extends Error {
  constructor() {
    super("DATABASE_URL is not configured. Point it at the CareersRX Postgres database.");
    this.name = "DatabaseNotConfiguredError";
  }
}

function assertRuntimeDatabaseAccess() {
  if (process.env.NEXT_PHASE === BUILD_PHASE || process.env.npm_lifecycle_event === "build") {
    throw new DatabaseUnavailableDuringBuildError();
  }
}

type PoolRegistry = { pool: Pool; connectionString: string; migrated: Promise<void> | null };

function registry(): { current?: PoolRegistry } {
  const globalRegistry = globalThis as typeof globalThis & { [POOL_KEY]?: { current?: PoolRegistry } };
  if (!globalRegistry[POOL_KEY]) globalRegistry[POOL_KEY] = {};
  return globalRegistry[POOL_KEY];
}

function connectionString() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) throw new DatabaseNotConfiguredError();
  return url;
}

/**
 * Returns the process-lived pool, creating it (and running migrations exactly once per process,
 * under an advisory lock) on first use. Cached on globalThis so Next development hot reloads do
 * not reopen the database for every query.
 */
export async function getPool(): Promise<Pool> {
  assertRuntimeDatabaseAccess();
  const holder = registry();
  const url = connectionString();

  if (holder.current && holder.current.connectionString !== url) {
    // Tests repoint DATABASE_URL between cases; drop the stale pool rather than reusing it.
    const stale = holder.current;
    holder.current = undefined;
    await stale.pool.end().catch(() => {});
  }

  if (!holder.current) {
    const pool = new Pool({
      connectionString: url,
      max: Number(process.env.PGPOOL_MAX ?? 10),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
    pool.on("error", (error) => {
      console.error("[careersrx/db] idle client error", { message: error.message });
    });
    holder.current = { pool, connectionString: url, migrated: null };
  }

  const entry = holder.current;
  if (!entry.migrated) {
    entry.migrated = ensureMigrated(entry.pool).catch((error) => {
      // A failed migration must not be latched as success; the next call retries.
      entry.migrated = null;
      throw error;
    });
  }
  await entry.migrated;
  return entry.pool;
}

/** Test-only lifecycle hook for a process that changes DATABASE_URL between cases. */
export async function closePoolForTests() {
  const holder = registry();
  const current = holder.current;
  holder.current = undefined;
  if (current) await current.pool.end().catch(() => {});
}

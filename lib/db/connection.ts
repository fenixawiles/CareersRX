import "server-only";

import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { createRequire } from "node:module";
import { ensureMigrated } from "@/lib/db/migrate";

export type SqlValue = string | number | bigint | null | Uint8Array;

export type SqlStatement = {
  all(...parameters: SqlValue[]): Record<string, unknown>[];
  get(...parameters: SqlValue[]): Record<string, unknown> | undefined;
  run(...parameters: SqlValue[]): { changes?: number | bigint; lastInsertRowid?: number | bigint };
};

export type SqliteConnection = {
  exec(sql: string): void;
  prepare(sql: string): SqlStatement;
  close(): void;
};

type DatabaseConstructor = new (path: string) => SqliteConnection;

const require = createRequire(import.meta.url);
const CONNECTIONS_KEY = Symbol.for("careersrx.sqlite.connections");
const BUILD_PHASE = "phase-production-build";

type ConnectionRegistry = Map<string, SqliteConnection>;

export class DatabaseUnavailableDuringBuildError extends Error {
  constructor() {
    super(
      "CareersRX SQLite was opened while Next.js was building. Database connections and migrations are runtime-only.",
    );
    this.name = "DatabaseUnavailableDuringBuildError";
  }
}

function assertRuntimeDatabaseAccess() {
  if (process.env.NEXT_PHASE === BUILD_PHASE || process.env.npm_lifecycle_event === "build") {
    throw new DatabaseUnavailableDuringBuildError();
  }
}

function databaseConstructor(): DatabaseConstructor {
  try {
    const nodeSqlite = require("node:sqlite") as { DatabaseSync?: DatabaseConstructor };
    if (nodeSqlite.DatabaseSync) return nodeSqlite.DatabaseSync;
  } catch {
    // Node 20 does not expose node:sqlite. The supported fallback is below.
  }

  try {
    const betterSqlite = require("better-sqlite3") as DatabaseConstructor | { default?: DatabaseConstructor };
    const Database = typeof betterSqlite === "function" ? betterSqlite : betterSqlite.default;
    if (Database) return Database;
  } catch {
    // Raise the actionable error below rather than leaking a module-resolution error.
  }

  throw new Error("No SQLite runtime is available. Install better-sqlite3 or use a supported Node.js runtime.");
}

function registry(): ConnectionRegistry {
  const globalRegistry = globalThis as typeof globalThis & {
    [CONNECTIONS_KEY]?: ConnectionRegistry;
  };
  if (!globalRegistry[CONNECTIONS_KEY]) globalRegistry[CONNECTIONS_KEY] = new Map();
  return globalRegistry[CONNECTIONS_KEY];
}

function configure(connection: SqliteConnection) {
  connection.exec("PRAGMA journal_mode = WAL");
  connection.exec("PRAGMA foreign_keys = ON");
  connection.exec("PRAGMA busy_timeout = 5000");
  connection.exec("PRAGMA synchronous = NORMAL");
}

/**
 * Returns the process-lived connection for a SQLite file. Connections are cached on globalThis so
 * Next development hot reloads do not reopen the database for every query.
 */
export function getSqliteConnection(dbPath: string): SqliteConnection {
  assertRuntimeDatabaseAccess();
  const connections = registry();
  const existing = connections.get(dbPath);
  if (existing) return existing;

  mkdirSync(dirname(dbPath), { recursive: true });
  const connection = new (databaseConstructor())(dbPath);
  configure(connection);
  ensureMigrated(connection);
  connections.set(dbPath, connection);
  return connection;
}

/** Test-only lifecycle hook for a process that changes CAREERSRX_SQLITE_PATH between cases. */
export function closeSqliteConnectionsForTests() {
  for (const connection of registry().values()) connection.close();
  registry().clear();
}

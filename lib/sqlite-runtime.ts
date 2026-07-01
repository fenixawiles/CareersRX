import "server-only";

import { dirname } from "node:path";
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";

type DatabaseConstructor = new (path: string) => {
  exec(sql: string): void;
  prepare(sql: string): {
    all(): Record<string, unknown>[];
  };
  close(): void;
};

const require = createRequire(import.meta.url);
let databaseConstructor: DatabaseConstructor | null | undefined;

function getDatabaseConstructor() {
  if (databaseConstructor !== undefined) return databaseConstructor;
  try {
    databaseConstructor = (require("node:sqlite") as { DatabaseSync?: DatabaseConstructor }).DatabaseSync ?? null;
  } catch {
    databaseConstructor = null;
  }

  if (databaseConstructor) return databaseConstructor;

  try {
    const betterSqlite = require("better-sqlite3") as DatabaseConstructor | { default?: DatabaseConstructor };
    databaseConstructor = typeof betterSqlite === "function" ? betterSqlite : betterSqlite.default ?? null;
  } catch {
    databaseConstructor = null;
  }

  return databaseConstructor;
}

function ensureParentDirectory(dbPath: string) {
  mkdirSync(dirname(dbPath), { recursive: true });
}

export function runSqlFile(dbPath: string, sql: string) {
  ensureParentDirectory(dbPath);
  const Database = getDatabaseConstructor();
  if (!Database) throw new Error("No SQLite runtime is available. Install better-sqlite3.");
  const database = new Database(dbPath);
  try {
    database.exec(sql);
  } finally {
    database.close();
  }
}

export function querySqlFile<T>(dbPath: string, sql: string): T[] {
  ensureParentDirectory(dbPath);
  const Database = getDatabaseConstructor();
  if (!Database) throw new Error("No SQLite runtime is available. Install better-sqlite3.");
  const database = new Database(dbPath);
  try {
    return database.prepare(sql).all() as T[];
  } finally {
    database.close();
  }
}

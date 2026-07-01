import "server-only";

import { execFileSync } from "node:child_process";
import { dirname } from "node:path";
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";

type DatabaseSyncConstructor = new (path: string) => {
  exec(sql: string): void;
  prepare(sql: string): {
    all(): Record<string, unknown>[];
  };
  close(): void;
};

const require = createRequire(import.meta.url);
let databaseSync: DatabaseSyncConstructor | null | undefined;

function getDatabaseSync() {
  if (databaseSync !== undefined) return databaseSync;
  try {
    databaseSync = (require("node:sqlite") as { DatabaseSync?: DatabaseSyncConstructor }).DatabaseSync ?? null;
  } catch {
    databaseSync = null;
  }
  return databaseSync;
}

function ensureParentDirectory(dbPath: string) {
  mkdirSync(dirname(dbPath), { recursive: true });
}

export function runSqlFile(dbPath: string, sql: string) {
  ensureParentDirectory(dbPath);
  const DatabaseSync = getDatabaseSync();
  if (DatabaseSync) {
    const database = new DatabaseSync(dbPath);
    try {
      database.exec(sql);
    } finally {
      database.close();
    }
    return;
  }

  execFileSync("sqlite3", [dbPath, sql], {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
}

export function querySqlFile<T>(dbPath: string, sql: string): T[] {
  ensureParentDirectory(dbPath);
  const DatabaseSync = getDatabaseSync();
  if (DatabaseSync) {
    const database = new DatabaseSync(dbPath);
    try {
      return database.prepare(sql).all() as T[];
    } finally {
      database.close();
    }
  }

  const output = execFileSync("sqlite3", ["-json", dbPath, sql], {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  }).trim();
  return output ? (JSON.parse(output) as T[]) : [];
}

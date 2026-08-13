import "server-only";

import { getSqliteConnection, type SqlValue } from "@/lib/db/connection";

export type SqlResult = { changes: number; lastInsertRowid: number | null };

function resultFrom(runResult: { changes?: number | bigint; lastInsertRowid?: number | bigint }): SqlResult {
  return {
    changes: Number(runResult.changes ?? 0),
    lastInsertRowid: runResult.lastInsertRowid === undefined ? null : Number(runResult.lastInsertRowid),
  };
}

export function queryFile<T>(dbPath: string, sql: string, parameters: SqlValue[] = []): T[] {
  return getSqliteConnection(dbPath).prepare(sql).all(...parameters) as T[];
}

export function queryOneFile<T>(dbPath: string, sql: string, parameters: SqlValue[] = []): T | null {
  return (getSqliteConnection(dbPath).prepare(sql).get(...parameters) as T | undefined) ?? null;
}

export function runFile(dbPath: string, sql: string, parameters: SqlValue[] = []): SqlResult {
  return resultFrom(getSqliteConnection(dbPath).prepare(sql).run(...parameters));
}

function isPromise(value: unknown): value is Promise<unknown> {
  return (
    value !== null &&
    (typeof value === "object" || typeof value === "function") &&
    "then" in value &&
    typeof value.then === "function"
  );
}

export function transactionFile<T>(dbPath: string, work: () => T): T {
  const connection = getSqliteConnection(dbPath);
  connection.exec("BEGIN IMMEDIATE");
  try {
    const result = work();
    if (isPromise(result)) {
      throw new Error("SQLite transaction callbacks must be synchronous.");
    }
    connection.exec("COMMIT");
    return result;
  } catch (error) {
    connection.exec("ROLLBACK");
    throw error;
  }
}

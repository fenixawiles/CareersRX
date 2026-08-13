import "server-only";

import { getSqliteConnection } from "@/lib/db/connection";

export function runSqlFile(dbPath: string, sql: string) {
  getSqliteConnection(dbPath).exec(sql);
}

export function querySqlFile<T>(dbPath: string, sql: string): T[] {
  return getSqliteConnection(dbPath).prepare(sql).all() as T[];
}

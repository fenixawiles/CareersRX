import "server-only";

import type { SqliteConnection } from "@/lib/db/connection";
import { baselineMigration } from "@/lib/db/migrations/001_baseline";
import { integrityMigration } from "@/lib/db/migrations/002_integrity";
import { criteriaMigration } from "@/lib/db/migrations/003_criteria";
import { applicationLockMigration } from "@/lib/db/migrations/004_application_lock";
import { evaluationMigration } from "@/lib/db/migrations/005_evaluation";

type Migration = {
  version: number;
  name: string;
  checksum: string;
  up(connection: SqliteConnection): void;
};

type AppliedMigration = {
  version: number;
  name: string;
  checksum: string;
};

const migrations: Migration[] = [
  baselineMigration,
  integrityMigration,
  criteriaMigration,
  applicationLockMigration,
  evaluationMigration,
];

function ensureMigrationTable(connection: SqliteConnection) {
  connection.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      checksum TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);
}

export function ensureMigrated(connection: SqliteConnection) {
  ensureMigrationTable(connection);
  const applied = new Map(
    connection
      .prepare("SELECT version, name, checksum FROM schema_migrations ORDER BY version ASC")
      .all()
      .map((row) => [Number(row.version), row as AppliedMigration]),
  );

  for (const migration of migrations) {
    const previous = applied.get(migration.version);
    if (previous) {
      if (previous.name !== migration.name || previous.checksum !== migration.checksum) {
        throw new Error(`Migration ${migration.version} history does not match the checked-in definition.`);
      }
      continue;
    }
    connection.exec("BEGIN IMMEDIATE");
    try {
      migration.up(connection);
      connection
        .prepare("INSERT INTO schema_migrations (version, name, checksum, applied_at) VALUES (?, ?, ?, ?)")
        .run(migration.version, migration.name, migration.checksum, new Date().toISOString());
      connection.exec("COMMIT");
    } catch (error) {
      connection.exec("ROLLBACK");
      throw error;
    }
  }
}

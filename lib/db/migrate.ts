import "server-only";

import type { Pool, PoolClient } from "pg";
import { platformMigration } from "@/lib/db/migrations/001_platform";
import { resumeMigration } from "@/lib/db/migrations/002_resume";
import { criteriaMigration } from "@/lib/db/migrations/003_criteria";
import { applicationsMigration } from "@/lib/db/migrations/004_applications";
import { evaluationMigration } from "@/lib/db/migrations/005_evaluation";
import { notificationsMigration } from "@/lib/db/migrations/006_notifications";
import { retentionMigration } from "@/lib/db/migrations/007_retention";

export type MigrationClient = {
  exec(sql: string): Promise<void>;
  query<T = Record<string, unknown>>(sql: string, parameters?: unknown[]): Promise<T[]>;
};

export type Migration = {
  version: number;
  name: string;
  checksum: string;
  up(client: MigrationClient): Promise<void>;
};

type AppliedMigration = {
  version: number;
  name: string;
  checksum: string;
};

const migrations: Migration[] = [
  platformMigration,
  resumeMigration,
  criteriaMigration,
  applicationsMigration,
  evaluationMigration,
  notificationsMigration,
  retentionMigration,
];

// One fixed key: every CareersRX process contends on the same lock, so concurrent boots
// (Railway deploys, dev + test side by side on one database) serialize their migration runs.
const ADVISORY_LOCK_KEY = 727_454_733;

function migrationClient(client: PoolClient): MigrationClient {
  return {
    async exec(sql) {
      await client.query(sql);
    },
    async query<T = Record<string, unknown>>(sql: string, parameters: unknown[] = []) {
      return (await client.query(sql, parameters)).rows as T[];
    },
  };
}

export async function ensureMigrated(pool: Pool) {
  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock($1)", [ADVISORY_LOCK_KEY]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        checksum TEXT NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL
      )
    `);

    const applied = new Map<number, AppliedMigration>(
      (await client.query("SELECT version, name, checksum FROM schema_migrations ORDER BY version ASC")).rows.map(
        (row: AppliedMigration) => [Number(row.version), row],
      ),
    );

    for (const migration of migrations) {
      const previous = applied.get(migration.version);
      if (previous) {
        if (previous.name !== migration.name || previous.checksum !== migration.checksum) {
          throw new Error(`Migration ${migration.version} history does not match the checked-in definition.`);
        }
        continue;
      }
      await client.query("BEGIN");
      try {
        await migration.up(migrationClient(client));
        await client.query(
          "INSERT INTO schema_migrations (version, name, checksum, applied_at) VALUES ($1, $2, $3, $4)",
          [migration.version, migration.name, migration.checksum, new Date().toISOString()],
        );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        throw error;
      }
    }
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [ADVISORY_LOCK_KEY]).catch(() => {});
    client.release();
  }
}

/** The highest applied migration, for /api/health. */
export function migrationHead(): { version: number; name: string } {
  const last = migrations[migrations.length - 1];
  return { version: last.version, name: last.name };
}

import type { SqliteConnection } from "@/lib/db/connection";

function hasColumn(connection: SqliteConnection, table: string, column: string) {
  return connection
    .prepare(`SELECT COUNT(*) AS count FROM pragma_table_info(?) WHERE name = ?`)
    .get(table, column)?.count === 1;
}

export const integrityMigration = {
  version: 2,
  name: "integrity",
  checksum: "sha256:8b1d21929cb9d48cf7c024a42eb008064a5de7c6a3198fc0ae9c8b2d53d607ac",
  up(connection: SqliteConnection) {
    // Existing installations predate the is_admin field that is present in the baseline for fresh DBs.
    if (!hasColumn(connection, "local_users", "is_admin")) {
      connection.exec("ALTER TABLE local_users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0");
    }

    // SQLite cannot remove the old UNIQUE(user_id) constraint in place. This transactionally rebuilds
    // the membership table with the intended multi-organization UNIQUE(company_id, user_id) rule.
    connection.exec(`
      CREATE TABLE local_company_users_next (
        id TEXT PRIMARY KEY,
        company_id TEXT NOT NULL REFERENCES local_companies(id),
        user_id TEXT NOT NULL REFERENCES local_users(id),
        role TEXT NOT NULL CHECK (role IN ('OWNER', 'ADMIN', 'MEMBER', 'RECRUITER')),
        revoked_at TEXT,
        revoked_by_user_id TEXT REFERENCES local_users(id),
        created_at TEXT NOT NULL,
        UNIQUE(company_id, user_id)
      );

      INSERT INTO local_company_users_next (id, company_id, user_id, role, revoked_at, revoked_by_user_id, created_at)
      SELECT id, company_id, user_id,
        CASE WHEN role IN ('OWNER', 'ADMIN', 'MEMBER', 'RECRUITER') THEN role ELSE 'MEMBER' END,
        NULL, NULL, created_at
      FROM local_company_users;

      DROP TABLE local_company_users;
      ALTER TABLE local_company_users_next RENAME TO local_company_users;
      CREATE INDEX local_company_users_user_id_idx ON local_company_users(user_id);
      CREATE INDEX local_company_users_company_id_idx ON local_company_users(company_id);
    `);
  },
};

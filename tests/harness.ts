import { randomBytes } from "node:crypto";
import { Client } from "pg";
import { closePoolForTests } from "@/lib/db/connection";

const BASE_URL = process.env.DATABASE_URL_TEST ?? "postgres://fenixwiles@localhost:5432/careersrx_test";

/**
 * Points the app's pool at a brand-new schema on the test database — the Postgres analog of the
 * old per-test temporary SQLite file. Migrations run automatically on first query. Each call
 * yields full isolation; schemas are wiped by tests/global-setup.ts at the start of the next run.
 */
export async function freshDatabase(): Promise<void> {
  const schema = `test_${randomBytes(6).toString("hex")}`;
  const admin = new Client({ connectionString: BASE_URL });
  await admin.connect();
  try {
    await admin.query(`CREATE SCHEMA "${schema}"`);
  } finally {
    await admin.end();
  }
  await closePoolForTests();
  const url = new URL(BASE_URL);
  url.searchParams.set("options", `-c search_path=${schema}`);
  process.env.DATABASE_URL = url.toString();
}

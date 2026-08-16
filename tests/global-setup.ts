import { Client } from "pg";

const BASE_URL = process.env.DATABASE_URL_TEST ?? "postgres://fenixwiles@localhost:5432/careersrx_test";

/** Drops schemas left behind by previous runs so the test database does not accumulate them. */
export default async function globalSetup() {
  const client = new Client({ connectionString: BASE_URL });
  await client.connect();
  try {
    const schemas = await client.query<{ schema_name: string }>(
      "SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'test\\_%'",
    );
    for (const row of schemas.rows) {
      await client.query(`DROP SCHEMA "${row.schema_name}" CASCADE`);
    }
  } finally {
    await client.end();
  }
}

import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db/sql";
import { migrationHead } from "@/lib/db/migrate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Deployment health: proves the database answers and reports the applied migration head. */
export async function GET() {
  try {
    const applied = await queryOne<{ version: number; name: string }>(
      "SELECT version, name FROM schema_migrations ORDER BY version DESC LIMIT 1",
    );
    const expected = migrationHead();
    const healthy = applied?.version === expected.version;
    return NextResponse.json(
      {
        status: healthy ? "ok" : "migrating",
        migration: { applied: applied ?? null, expected },
      },
      { status: healthy ? 200 : 503 },
    );
  } catch (error) {
    return NextResponse.json(
      { status: "error", message: error instanceof Error ? error.name : "unknown" },
      { status: 503 },
    );
  }
}

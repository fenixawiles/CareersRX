import { NextResponse } from "next/server";
import { z } from "zod";
import { runRetentionSweep } from "@/lib/retention/sweep";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({ companyId: z.string().min(1).max(120), limit: z.number().int().min(1).max(500).optional() }).strict();

export async function POST(request: Request) {
  const expected = process.env.CAREERSRX_INTERNAL_JOB_TOKEN;
  const received = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!expected || !received || received !== expected) return NextResponse.json({ error: "Internal authorization required" }, { status: 401 });
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid retention sweep request" }, { status: 400 });
  try {
    return NextResponse.json({ sweep: await runRetentionSweep(parsed.data.companyId, parsed.data.limit) });
  } catch (error) {
    console.error("[careersrx/retention] sweep failed", error);
    return NextResponse.json({ error: "Retention sweep failed" }, { status: 500 });
  }
}

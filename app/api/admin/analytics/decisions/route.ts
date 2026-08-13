import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/policy";
import { deidentifiedDecisionExport } from "@/lib/analytics/decisions";
import { evaluationDbPath } from "@/lib/evaluation/route-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const querySchema = z.object({ companyId: z.string().min(1).max(120) });

export async function GET(request: Request) {
  await requireAdmin();
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return NextResponse.json({ error: "companyId is required" }, { status: 400 });
  return NextResponse.json({ records: deidentifiedDecisionExport(evaluationDbPath(), parsed.data.companyId) });
}

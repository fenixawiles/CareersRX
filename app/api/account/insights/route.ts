import { NextResponse } from "next/server";
import { aggregateApplicantInsights } from "@/lib/insights/aggregate";
import { getCurrentLocalUser } from "@/lib/local-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentLocalUser();
  if (!user) return NextResponse.json({ error: "Log in required" }, { status: 401 });
  if (user.role !== "SEEKER") return NextResponse.json({ error: "Job seeker account required" }, { status: 403 });
  return NextResponse.json({ insights: await aggregateApplicantInsights(user.id) });
}

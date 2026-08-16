import { NextResponse } from "next/server";
import { getReleasedApplicantExplanation } from "@/lib/evaluation/applicant-read";
import { getCurrentLocalUser } from "@/lib/local-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const user = await getCurrentLocalUser();
  if (!user) return NextResponse.json({ error: "Log in required" }, { status: 401 });
  if (user.role !== "SEEKER") return NextResponse.json({ error: "Job seeker account required" }, { status: 403 });
  const { id } = await context.params;
  const explanation = await getReleasedApplicantExplanation(user.id, id);
  if (!explanation) return NextResponse.json({ error: "Released explanation not found" }, { status: 404 });
  return NextResponse.json({ explanation });
}

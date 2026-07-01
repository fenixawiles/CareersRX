import { NextResponse } from "next/server";
import { getCurrentLocalUser } from "@/lib/local-auth";
import { createJobForCompany, getCompanyForUser, listJobsForCompany } from "@/lib/local-platform";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireCompany() {
  const user = await getCurrentLocalUser();
  if (!user) return { error: "Log in required", status: 401 as const };
  if (user.role !== "EMPLOYER") return { error: "Employer account required", status: 403 as const };
  const company = getCompanyForUser(user.id);
  if (!company) return { error: "Company not found", status: 404 as const };
  return { user, company };
}

export async function GET() {
  const auth = await requireCompany();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  return NextResponse.json({ jobs: listJobsForCompany(auth.company.id) });
}

export async function POST(request: Request) {
  const auth = await requireCompany();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Invalid job posting" }, { status: 400 });
  const result = createJobForCompany(auth.company.id, body);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ job: result.job }, { status: 201 });
}

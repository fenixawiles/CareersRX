import { NextResponse } from "next/server";
import { getCurrentLocalUser } from "@/lib/local-auth";
import { getCompanyForUser, getJobForCompany, updateJobForCompany } from "@/lib/local-platform";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

async function requireCompany() {
  const user = await getCurrentLocalUser();
  if (!user) return { error: "Log in required", status: 401 as const };
  if (user.role !== "EMPLOYER") return { error: "Employer account required", status: 403 as const };
  const company = getCompanyForUser(user.id);
  if (!company) return { error: "Company not found", status: 404 as const };
  return { company };
}

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireCompany();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await context.params;
  const job = getJobForCompany(id, auth.company.id);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  return NextResponse.json({ job });
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireCompany();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Invalid job update" }, { status: 400 });
  const result = updateJobForCompany(id, auth.company.id, body);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ job: result.job });
}

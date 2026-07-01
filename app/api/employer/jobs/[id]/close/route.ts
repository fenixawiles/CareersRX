import { NextResponse } from "next/server";
import { getCurrentLocalUser } from "@/lib/local-auth";
import { getCompanyForUser, setJobStatusForCompany } from "@/lib/local-platform";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const user = await getCurrentLocalUser();
  if (!user) return NextResponse.json({ error: "Log in required" }, { status: 401 });
  if (user.role !== "EMPLOYER") return NextResponse.json({ error: "Employer account required" }, { status: 403 });
  const company = getCompanyForUser(user.id);
  if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });
  const { id } = await context.params;
  const job = setJobStatusForCompany(id, company.id, "CLOSED");
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  return NextResponse.json({ job });
}

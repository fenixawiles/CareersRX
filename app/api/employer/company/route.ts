import { NextResponse } from "next/server";
import { getCurrentLocalUser } from "@/lib/local-auth";
import { getCompanyForUser, updateCompanyForUser } from "@/lib/local-platform";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireEmployer() {
  const user = await getCurrentLocalUser();
  if (!user) return { error: "Log in required", status: 401 as const };
  if (user.role !== "EMPLOYER") return { error: "Employer account required", status: 403 as const };
  return { user };
}

export async function GET() {
  const auth = await requireEmployer();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const company = getCompanyForUser(auth.user.id);
  if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });
  return NextResponse.json({ company });
}

export async function PATCH(request: Request) {
  const auth = await requireEmployer();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Invalid company update" }, { status: 400 });
  const company = updateCompanyForUser(auth.user.id, {
    name: typeof body.name === "string" ? body.name : undefined,
    website: typeof body.website === "string" ? body.website : undefined,
    phone: typeof body.phone === "string" ? body.phone : undefined,
    description: typeof body.description === "string" ? body.description : undefined,
    contactName: typeof body.contactName === "string" ? body.contactName : undefined,
    contactEmail: typeof body.contactEmail === "string" ? body.contactEmail : undefined,
  });
  if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });
  return NextResponse.json({ company });
}

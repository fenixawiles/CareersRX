import { NextResponse } from "next/server";
import { getCurrentLocalUser, sandboxIdForUser } from "@/lib/local-auth";
import { createApplication, listApplicationsForSeeker } from "@/lib/local-platform";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentLocalUser();
  if (!user) return NextResponse.json({ error: "Log in required" }, { status: 401 });
  if (user.role !== "SEEKER") return NextResponse.json({ error: "Job seeker account required" }, { status: 403 });
  return NextResponse.json({ applications: listApplicationsForSeeker(user.id) });
}

export async function POST(request: Request) {
  const user = await getCurrentLocalUser();
  if (!user) return NextResponse.json({ error: "Log in required" }, { status: 401 });
  if (user.role !== "SEEKER") return NextResponse.json({ error: "Job seeker account required" }, { status: 403 });
  const body = (await request.json().catch(() => null)) as {
    jobId?: unknown;
    coverLetter?: unknown;
    licenseConfirmed?: unknown;
  } | null;
  if (!body || typeof body.jobId !== "string") {
    return NextResponse.json({ error: "Job is required" }, { status: 400 });
  }
  const result = createApplication({
    jobId: body.jobId,
    seekerUserId: user.id,
    seekerEmail: user.email,
    sandboxId: sandboxIdForUser(user.id),
    coverLetter: typeof body.coverLetter === "string" ? body.coverLetter : "",
    licenseConfirmed: body.licenseConfirmed === true,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ application: result.application }, { status: 201 });
}

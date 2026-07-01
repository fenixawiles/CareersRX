import { NextResponse } from "next/server";
import { getCurrentLocalUser } from "@/lib/local-auth";
import {
  listSavedJobsForSeeker,
  removeSavedJobForSeeker,
  saveJobForSeeker,
} from "@/lib/local-platform";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentLocalUser();
  if (!user) return NextResponse.json({ error: "Log in required" }, { status: 401 });
  if (user.role !== "SEEKER") return NextResponse.json({ error: "Job seeker account required" }, { status: 403 });
  return NextResponse.json({ jobs: listSavedJobsForSeeker(user.id) });
}

export async function POST(request: Request) {
  const user = await getCurrentLocalUser();
  if (!user) return NextResponse.json({ error: "Log in required" }, { status: 401 });
  if (user.role !== "SEEKER") return NextResponse.json({ error: "Job seeker account required" }, { status: 403 });
  const body = (await request.json().catch(() => null)) as { jobId?: unknown } | null;
  if (!body || typeof body.jobId !== "string") {
    return NextResponse.json({ error: "Job is required" }, { status: 400 });
  }
  return NextResponse.json(saveJobForSeeker(user.id, body.jobId));
}

export async function DELETE(request: Request) {
  const user = await getCurrentLocalUser();
  if (!user) return NextResponse.json({ error: "Log in required" }, { status: 401 });
  if (user.role !== "SEEKER") return NextResponse.json({ error: "Job seeker account required" }, { status: 403 });
  const body = (await request.json().catch(() => null)) as { jobId?: unknown } | null;
  if (!body || typeof body.jobId !== "string") {
    return NextResponse.json({ error: "Job is required" }, { status: 400 });
  }
  return NextResponse.json(removeSavedJobForSeeker(user.id, body.jobId));
}

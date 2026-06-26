import { NextResponse } from "next/server";
import { getDemoSeeker } from "@/lib/demo";
import { prisma } from "@/lib/prisma";
import { createApplicationPacketForJob, getApplicationPackets } from "@/lib/resumes";

export async function GET() {
  const seeker = await getDemoSeeker();
  if (!seeker) return NextResponse.json({ error: "Demo seeker not found" }, { status: 404 });

  const packets = await getApplicationPackets(seeker.id);
  return NextResponse.json({ packets });
}

export async function POST(request: Request) {
  const seeker = await getDemoSeeker();
  if (!seeker) return NextResponse.json({ error: "Demo seeker not found" }, { status: 404 });

  const body = (await request.json().catch(() => null)) as {
    jobId?: unknown;
    resumeDocumentId?: unknown;
  } | null;
  const fallbackJob = await prisma.job.findFirst({
    where: { status: "ACTIVE" },
    orderBy: { publishedAt: "desc" },
    select: { id: true },
  });
  const jobId = typeof body?.jobId === "string" ? body.jobId : fallbackJob?.id;
  if (!jobId) return NextResponse.json({ error: "No active job found" }, { status: 400 });

  const packet = await createApplicationPacketForJob({
    seekerId: seeker.id,
    jobId,
    resumeDocumentId: typeof body?.resumeDocumentId === "string" ? body.resumeDocumentId : undefined,
  });

  return NextResponse.json({ packet }, { status: 201 });
}

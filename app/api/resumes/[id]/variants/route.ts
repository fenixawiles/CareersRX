import { NextResponse } from "next/server";
import { getDemoSeeker } from "@/lib/demo";
import { createResumeVariant } from "@/lib/resumes";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const seeker = await getDemoSeeker();
  if (!seeker) return NextResponse.json({ error: "Demo seeker not found" }, { status: 404 });

  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as {
    targetRole?: unknown;
    title?: unknown;
  } | null;
  const targetRole = typeof body?.targetRole === "string" && body.targetRole.trim()
    ? body.targetRole.trim()
    : "Targeted Role";

  const variant = await createResumeVariant({
    seekerId: seeker.id,
    documentId: id,
    targetRole,
    title: typeof body?.title === "string" ? body.title : undefined,
    actorId: seeker.userId,
  });

  return NextResponse.json({ variant }, { status: 201 });
}

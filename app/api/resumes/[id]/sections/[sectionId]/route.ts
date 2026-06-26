import { NextResponse } from "next/server";
import { getDemoSeeker } from "@/lib/demo";
import { saveResumeSectionEdit } from "@/lib/resumes";

type RouteContext = {
  params: Promise<{ id: string; sectionId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const seeker = await getDemoSeeker();
  if (!seeker) return NextResponse.json({ error: "Demo seeker not found" }, { status: 404 });

  const { sectionId } = await context.params;
  const body = (await request.json().catch(() => null)) as { content?: unknown } | null;
  if (typeof body?.content !== "string") {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }

  const version = await saveResumeSectionEdit({
    seekerId: seeker.id,
    sectionId,
    content: body.content,
    actorId: seeker.userId,
  });

  return NextResponse.json({ version });
}

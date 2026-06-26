import { NextResponse } from "next/server";
import { getDemoSeeker } from "@/lib/demo";
import { getResumeWorkspace } from "@/lib/resumes";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const seeker = await getDemoSeeker();
  if (!seeker) return NextResponse.json({ error: "Demo seeker not found" }, { status: 404 });

  const { id } = await context.params;
  const workspace = await getResumeWorkspace(seeker.id, id);
  if (!workspace) return NextResponse.json({ error: "Resume not found" }, { status: 404 });

  return NextResponse.json({ workspace });
}

import { NextResponse } from "next/server";
import { getDemoSeeker } from "@/lib/demo";
import { createResumeFromProfile, getResumeLibrary } from "@/lib/resumes";

export async function GET() {
  const seeker = await getDemoSeeker();
  if (!seeker) return NextResponse.json({ error: "Demo seeker not found" }, { status: 404 });

  const resumes = await getResumeLibrary(seeker.id);
  return NextResponse.json({ resumes });
}

export async function POST() {
  const seeker = await getDemoSeeker();
  if (!seeker) return NextResponse.json({ error: "Demo seeker not found" }, { status: 404 });

  const resume = await createResumeFromProfile(seeker.id, seeker.userId);
  return NextResponse.json({ resume }, { status: 201 });
}

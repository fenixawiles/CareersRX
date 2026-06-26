import { NextResponse } from "next/server";
import { runResumeImport, signupPrefillFromImport } from "@/lib/resume-import/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Upload a PDF or DOCX résumé." }, { status: 400 });
  }

  try {
    const result = await runResumeImport({
      file,
      intent: "signup_onboarding",
      mode: "signup",
    });
    return NextResponse.json({
      ...result,
      signupPrefill: signupPrefillFromImport(result.review),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not import that résumé." },
      { status: 400 },
    );
  }
}

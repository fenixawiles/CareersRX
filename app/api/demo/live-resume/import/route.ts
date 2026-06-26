import { NextResponse } from "next/server";
import { resumeImportIntentSchema } from "@/lib/ai/schemas";
import { runResumeImport } from "@/lib/resume-import/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  const parsedIntent = resumeImportIntentSchema.safeParse(formData?.get("intent"));
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Upload a PDF or DOCX résumé." }, { status: 400 });
  }
  if (!parsedIntent.success) {
    return NextResponse.json({ error: "Unsupported résumé import intent." }, { status: 400 });
  }

  try {
    const result = await runResumeImport({
      file,
      intent: parsedIntent.data,
      mode: "demo",
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not import that résumé." },
      { status: 400 },
    );
  }
}

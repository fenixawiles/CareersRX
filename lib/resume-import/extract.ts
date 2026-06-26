import "server-only";

const maxResumeUploadBytes = 5 * 1024 * 1024;
const minExtractedTextChars = 80;

export type ResumeExtractionResult = {
  fileName: string;
  contentType: string;
  sizeBytes: number;
  extractedText: string;
  extractor: "pdf-parse" | "mammoth";
};

function normalizedFileName(file: File) {
  return file.name || "uploaded-resume";
}

function normalizeExtractedText(value: string) {
  return value
    .replace(/\r/g, "\n")
    .replace(/\u0000/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function isPdf(file: File) {
  return file.type === "application/pdf" || normalizedFileName(file).toLowerCase().endsWith(".pdf");
}

function isDocx(file: File) {
  const name = normalizedFileName(file).toLowerCase();
  return (
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    name.endsWith(".docx")
  );
}

function assertReadableText(text: string) {
  if (text.length < minExtractedTextChars) {
    throw new Error(
      "That file did not contain enough selectable text. Please upload a DOCX or a text-based PDF instead of a scanned/image-only PDF.",
    );
  }
}

async function extractPdfText(buffer: Buffer) {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return normalizeExtractedText(result.text ?? "");
  } finally {
    await parser.destroy();
  }
}

async function extractDocxText(buffer: Buffer) {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return normalizeExtractedText(result.value ?? "");
}

export async function extractResumeTextFromFile(file: File): Promise<ResumeExtractionResult> {
  if (file.size <= 0) {
    throw new Error("Upload a PDF or DOCX résumé before asking Rex to import it.");
  }
  if (file.size > maxResumeUploadBytes) {
    throw new Error("Résumé uploads are limited to 5 MB for this local build.");
  }
  if (!isPdf(file) && !isDocx(file)) {
    throw new Error("CareersRX can import PDF and DOCX résumés only.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const extractedText = isPdf(file) ? await extractPdfText(buffer) : await extractDocxText(buffer);
  assertReadableText(extractedText);

  return {
    fileName: normalizedFileName(file),
    contentType: file.type || (isPdf(file) ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
    sizeBytes: file.size,
    extractedText,
    extractor: isPdf(file) ? "pdf-parse" : "mammoth",
  };
}

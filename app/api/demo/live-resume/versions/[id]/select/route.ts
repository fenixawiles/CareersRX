import { NextResponse } from "next/server";
import { selectSandboxNamedVersion } from "@/lib/sqlite-sandbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  return NextResponse.json(selectSandboxNamedVersion(id));
}

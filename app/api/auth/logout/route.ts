import { NextResponse } from "next/server";
import {
  deleteCurrentLocalSession,
  LOCAL_SESSION_COOKIE,
} from "@/lib/local-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  await deleteCurrentLocalSession();
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: LOCAL_SESSION_COOKIE,
    value: "",
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: new Date(0),
  });
  return response;
}

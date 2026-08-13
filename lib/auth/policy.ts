import "server-only";

import { redirect } from "next/navigation";
import { getCurrentLocalUser, type LocalUser } from "@/lib/local-auth";

export async function requireUser(): Promise<LocalUser> {
  const user = await getCurrentLocalUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin(): Promise<LocalUser> {
  const user = await requireUser();
  if (!user.isAdmin) redirect("/");
  return user;
}

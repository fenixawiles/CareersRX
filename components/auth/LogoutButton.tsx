"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { LogOut, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function LogoutButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    startTransition(() => router.push("/login"));
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={logout} disabled={isPending}>
      {isPending ? <Loader2 size={15} className="animate-spin" /> : <LogOut size={15} />}
      Log out
    </Button>
  );
}

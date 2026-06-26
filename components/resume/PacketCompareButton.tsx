"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function PacketCompareButton({ packetId }: { packetId: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  async function compare() {
    setMessage("Comparing job fit…");
    const response = await fetch(`/api/application-packets/${packetId}/compare-job`, {
      method: "POST",
    });
    if (!response.ok) {
      setMessage("Comparison failed");
      return;
    }
    setMessage("Comparison updated");
    startTransition(() => router.refresh());
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button type="button" size="sm" onClick={compare} disabled={isPending}>
        {isPending ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
        Compare Job Fit
      </Button>
      {message ? <span className="text-sm text-muted">{message}</span> : null}
    </div>
  );
}

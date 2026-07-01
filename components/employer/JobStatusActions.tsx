"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function JobStatusActions({ jobId, status }: { jobId: string; status: string }) {
  const router = useRouter();
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  async function run(action: "publish" | "pause" | "close") {
    setLoadingAction(action);
    await fetch(`/api/employer/jobs/${jobId}/${action}`, { method: "POST" });
    setLoadingAction(null);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap justify-end gap-2">
      {status !== "ACTIVE" ? (
        <Button size="sm" onClick={() => run("publish")} disabled={loadingAction !== null}>
          {loadingAction === "publish" ? <Loader2 size={14} className="animate-spin" /> : null}
          Publish
        </Button>
      ) : (
        <Button size="sm" variant="outline" onClick={() => run("pause")} disabled={loadingAction !== null}>
          {loadingAction === "pause" ? <Loader2 size={14} className="animate-spin" /> : null}
          Pause
        </Button>
      )}
      {status !== "CLOSED" ? (
        <Button size="sm" variant="ghost" onClick={() => run("close")} disabled={loadingAction !== null}>
          {loadingAction === "close" ? <Loader2 size={14} className="animate-spin" /> : null}
          Close
        </Button>
      ) : null}
    </div>
  );
}

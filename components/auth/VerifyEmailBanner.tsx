"use client";

import { useState } from "react";
import { MailWarning } from "lucide-react";

export function VerifyEmailBanner({ role }: { role: "SEEKER" | "EMPLOYER" }) {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function resend() {
    setStatus("sending");
    const response = await fetch("/api/auth/verify/resend", { method: "POST" });
    setStatus(response.ok ? "sent" : "error");
  }

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <span className="inline-flex items-center gap-2">
        <MailWarning size={16} />
        Verify your email to {role === "SEEKER" ? "apply to jobs" : "publish job postings"}. Check your
        inbox for the confirmation link.
      </span>
      <button
        type="button"
        onClick={resend}
        disabled={status === "sending" || status === "sent"}
        className="font-medium underline underline-offset-2 disabled:opacity-60"
      >
        {status === "sent" ? "Sent — check your inbox" : status === "sending" ? "Sending…" : status === "error" ? "Could not send — retry" : "Resend email"}
      </button>
    </div>
  );
}

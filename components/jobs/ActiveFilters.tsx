"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { JOB_TYPE_LABELS } from "@/lib/constants";

const LABELS: Record<string, (v: string) => string> = {
  q: (v) => `“${v}”`,
  category: (v) => v,
  state: (v) => v,
  jobType: (v) => JOB_TYPE_LABELS[v] ?? v,
};

export function ActiveFilters() {
  const router = useRouter();
  const params = useSearchParams();

  const active = Array.from(params.entries()).filter(
    ([key, value]) => key in LABELS && value,
  );

  if (active.length === 0) return null;

  function remove(key: string) {
    const next = new URLSearchParams(params.toString());
    next.delete(key);
    next.delete("page");
    router.push(`/jobs?${next.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {active.map(([key, value]) => (
        <button
          key={key}
          type="button"
          onClick={() => remove(key)}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary-light px-3 py-1.5 text-sm text-primary-dark hover:bg-primary hover:text-white"
        >
          {LABELS[key](value)}
          <X size={14} />
        </button>
      ))}
      <button
        type="button"
        onClick={() => router.push("/jobs")}
        className="text-sm font-medium text-muted underline hover:text-foreground"
      >
        Clear all
      </button>
    </div>
  );
}

"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { JOB_CATEGORIES, FOCUS_STATES, JOB_TYPE_LABELS } from "@/lib/constants";
import { Button } from "@/components/ui/Button";

function FilterGroups({ onNavigate }: { onNavigate?: () => void }) {
  const router = useRouter();
  const params = useSearchParams();

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value && next.get(key) !== value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    next.delete("page");
    router.push(`/jobs?${next.toString()}`);
    onNavigate?.();
  }

  const activeCategory = params.get("category") ?? "";
  const activeState = params.get("state") ?? "";
  const activeType = params.get("jobType") ?? "";

  return (
    <div className="space-y-6">
      <FilterSection title="Job Type">
        {Object.entries(JOB_TYPE_LABELS).map(([value, label]) => (
          <FilterChip
            key={value}
            active={activeType === value}
            onClick={() => setParam("jobType", value)}
          >
            {label}
          </FilterChip>
        ))}
      </FilterSection>

      <FilterSection title="State">
        {FOCUS_STATES.map((s) => (
          <FilterChip
            key={s.code}
            active={activeState === s.code}
            onClick={() => setParam("state", s.code)}
          >
            {s.name}
          </FilterChip>
        ))}
      </FilterSection>

      <FilterSection title="Category">
        {JOB_CATEGORIES.map((cat) => (
          <FilterChip
            key={cat}
            active={activeCategory === cat}
            onClick={() => setParam("category", cat)}
          >
            {cat}
          </FilterChip>
        ))}
      </FilterSection>
    </div>
  );
}

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-foreground">{title}</h3>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
        active
          ? "border-primary bg-primary text-white"
          : "border-border bg-surface text-foreground hover:border-primary"
      }`}
    >
      {children}
    </button>
  );
}

export function JobFilters() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile trigger */}
      <div className="lg:hidden">
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <SlidersHorizontal size={16} /> Filters
        </Button>
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden lg:block">
        <FilterGroups />
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-y-0 right-0 w-full max-w-sm overflow-y-auto bg-surface p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Filters</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close filters"
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl hover:bg-primary-light"
              >
                <X size={22} />
              </button>
            </div>
            <FilterGroups onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}

"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Clock,
  CopyPlus,
  Download,
  FileText,
  Loader2,
  PanelRightOpen,
  Save,
  Sparkles,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { ResumeProposalView, ResumeWorkspaceView } from "@/lib/resume-types";

const statusTone: Record<string, "neutral" | "primary" | "accent" | "success" | "warning" | "danger"> = {
  SYNCED: "success",
  RESUME_ONLY: "neutral",
  NEEDS_REVIEW: "warning",
  CONFLICT: "danger",
  APPLICATION_SPECIFIC: "accent",
  AI_DRAFT: "primary",
};

function prettyStatus(status: string) {
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(
    new Date(value),
  );
}

function proposalIconElement(proposal: ResumeProposalView) {
  if (proposal.target === "LICENSES" || proposal.target === "CERTIFICATIONS") {
    return <AlertTriangle size={18} />;
  }
  if (proposal.scope === "RESUME_ONLY") return <FileText size={18} />;
  return <Sparkles size={18} />;
}

export function ResumeWorkspace({ workspace }: { workspace: ResumeWorkspaceView }) {
  const router = useRouter();
  const [selectedSectionId, setSelectedSectionId] = useState(workspace.sections[0]?.id ?? "");
  const selectedSection = useMemo(
    () => workspace.sections.find((section) => section.id === selectedSectionId) ?? workspace.sections[0],
    [selectedSectionId, workspace.sections],
  );
  const [draft, setDraft] = useState({
    sectionId: selectedSection?.id ?? "",
    content: selectedSection?.content ?? "",
  });
  const [status, setStatus] = useState("Ready");
  const [isPending, startTransition] = useTransition();
  const draftContent =
    selectedSection && draft.sectionId === selectedSection.id ? draft.content : selectedSection?.content ?? "";

  async function saveSection() {
    if (!selectedSection) return;
    setStatus("Saving draft…");
    const response = await fetch(`/api/resumes/${workspace.document.id}/sections/${selectedSection.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: draftContent }),
    });
    if (!response.ok) {
      setStatus("Save failed");
      return;
    }
    setStatus("Draft saved");
    startTransition(() => router.refresh());
  }

  async function analyzeChanges() {
    setStatus("Analyzing changes…");
    const response = await fetch(`/api/resumes/${workspace.document.id}/analyze`, { method: "POST" });
    if (!response.ok) {
      setStatus("Analysis failed");
      return;
    }
    setStatus("Suggestions ready");
    startTransition(() => router.refresh());
  }

  async function decideProposal(proposalId: string, decision: "ACCEPTED" | "REJECTED", scope?: string | null) {
    setStatus(decision === "REJECTED" ? "Rejecting suggestion…" : "Applying suggestion…");
    const response = await fetch(`/api/resume-sync-proposals/${proposalId}/decision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, scope }),
    });
    if (!response.ok) {
      setStatus("Decision failed");
      return;
    }
    setStatus(decision === "REJECTED" ? "Suggestion rejected" : "Suggestion applied");
    startTransition(() => router.refresh());
  }

  async function createVariant() {
    setStatus("Creating variant…");
    const response = await fetch(`/api/resumes/${workspace.document.id}/variants`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targetRole: workspace.document.targetRole ?? "Targeted Role",
      }),
    });
    if (!response.ok) {
      setStatus("Variant failed");
      return;
    }
    setStatus("Variant created");
    startTransition(() => router.refresh());
  }

  const saveDisabled = !selectedSection || draftContent === selectedSection.content || isPending;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-primary/20 bg-primary-light/60 p-4 text-sm text-primary-dark xl:hidden">
        <strong>Best on desktop:</strong> this simplified review/edit flow works here, but the full
        CareersRX live résumé workspace is optimized for laptop and desktop screens.
      </div>

      <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold text-foreground">{workspace.document.title}</h2>
              {workspace.document.variantLabel ? <Badge tone="accent">{workspace.document.variantLabel}</Badge> : null}
              <Badge tone={workspace.document.status === "ACTIVE" ? "success" : "neutral"}>
                {prettyStatus(workspace.document.status)}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted">
              {workspace.document.targetRole ?? "General résumé"} · {status}
              {isPending ? " · Refreshing…" : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={saveSection} disabled={saveDisabled}>
              <Save size={16} /> Save Draft
            </Button>
            <Button type="button" size="sm" onClick={analyzeChanges} disabled={isPending}>
              {isPending ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              Analyze Changes
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => window.print()}>
              <Download size={16} /> Export
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={createVariant} disabled={isPending}>
              <CopyPlus size={16} /> Create Variant
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[260px_minmax(520px,1fr)_370px]">
        <aside className="space-y-4 rounded-2xl border border-border bg-surface p-4">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted">
              <PanelRightOpen size={15} /> Outline
            </h3>
            <div className="mt-3 space-y-2">
              {workspace.sections.map((section) => (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => setSelectedSectionId(section.id)}
                  className={`w-full rounded-xl border px-3 py-2 text-left transition-colors ${
                    selectedSection?.id === section.id
                      ? "border-primary bg-primary-light text-primary-dark"
                      : "border-border hover:bg-primary-light/50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{section.title}</span>
                    <Badge tone={statusTone[section.syncStatus] ?? "neutral"}>{prettyStatus(section.syncStatus)}</Badge>
                  </div>
                  <p className="mt-1 truncate text-xs text-muted">{section.type}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted">
              <Clock size={15} /> Versions
            </h3>
            <div className="mt-3 space-y-2 text-sm">
              {workspace.versions.slice(0, 5).map((version) => (
                <div key={version.id} className="rounded-xl border border-border px-3 py-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Version {version.versionNumber}</span>
                    {version.aiGenerated ? <Badge tone="primary">AI draft</Badge> : null}
                  </div>
                  <p className="mt-1 text-xs text-muted">{formatDate(version.createdAt)}</p>
                </div>
              ))}
            </div>
          </div>
        </aside>

        <main className="rounded-2xl border border-border bg-surface p-4">
          {selectedSection ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">{selectedSection.title}</h3>
                  <p className="text-sm text-muted">
                    Edit this section, save a draft version, then analyze changes for sync proposals.
                  </p>
                </div>
                <Badge tone={statusTone[selectedSection.syncStatus] ?? "neutral"}>
                  {prettyStatus(selectedSection.syncStatus)}
                </Badge>
              </div>
              <textarea
                value={draftContent}
                onChange={(event) =>
                  setDraft({ sectionId: selectedSection.id, content: event.target.value })
                }
                className="min-h-[360px] w-full resize-y rounded-2xl border border-border bg-background p-4 font-mono text-sm leading-6 outline-none focus-visible:border-primary"
              />
              <div className="rounded-2xl border border-border bg-background p-5">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted">
                  <FileText size={15} /> Live Preview
                </div>
                <article className="prose-job max-w-none whitespace-pre-wrap text-sm leading-7">
                  {draftContent}
                </article>
              </div>
            </div>
          ) : (
            <p className="text-muted">No résumé sections found.</p>
          )}
        </main>

        <aside className="space-y-4 rounded-2xl border border-border bg-surface p-4">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted">
              <Bot size={15} /> AI Sync Suggestions
            </h3>
            <p className="mt-2 rounded-xl bg-primary-light/60 p-3 text-xs text-primary-dark">
              AI suggestions are drafts. Only confirmed changes update your profile.
            </p>
          </div>

          {workspace.proposals.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-5 text-sm text-muted">
              No pending proposals. Save an edit and run analysis to generate reviewable sync options.
            </div>
          ) : (
            <div className="space-y-3">
              {workspace.proposals.map((proposal) => (
                <ProposalCard key={proposal.id} proposal={proposal} onDecision={decideProposal} />
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function ProposalCard({
  proposal,
  onDecision,
}: {
  proposal: ResumeProposalView;
  onDecision: (proposalId: string, decision: "ACCEPTED" | "REJECTED", scope?: string | null) => Promise<void>;
}) {
  return (
    <div className="rounded-2xl border border-border bg-background p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-light text-primary">
          {proposalIconElement(proposal)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-semibold text-foreground">{proposal.title}</h4>
            {proposal.confidence ? <Badge tone="neutral">{proposal.confidence}%</Badge> : null}
          </div>
          <p className="mt-1 text-sm text-muted">{proposal.summary}</p>
          {proposal.reason ? <p className="mt-2 text-xs text-muted">{proposal.reason}</p> : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => onDecision(proposal.id, "ACCEPTED", proposal.scope)}
            >
              <CheckCircle2 size={15} /> Apply Suggested
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onDecision(proposal.id, "ACCEPTED", "RESUME_ONLY")}
            >
              <FileText size={15} /> Keep Resume Only
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => onDecision(proposal.id, "REJECTED")}
            >
              <XCircle size={15} /> Reject
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

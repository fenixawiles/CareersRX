"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  Bold,
  CheckCircle2,
  Eye,
  FileClock,
  FilePenLine,
  Heading1,
  Italic,
  List,
  ListOrdered,
  Loader2,
  MoreHorizontal,
  Save,
  Upload,
  UserPlus,
  X,
} from "lucide-react";
import { RexOpenButton } from "@/components/rex/RexAssistantDrawer";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type {
  SandboxProposal,
  SandboxResumeSection,
  SandboxResumeVersionStatus,
  SandboxSnapshot,
} from "@/lib/sandbox-types";

const statusTone = {
  BLANK: "neutral",
  DRAFT: "accent",
  SYNCED: "success",
  NEEDS_REVIEW: "warning",
  RESUME_ONLY: "primary",
} as const;

function label(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

type SectionDecisionMenu = {
  sectionId: SandboxResumeSection["id"];
  proposalIds: string[];
  state: "choices" | "resume-only" | "blank-confirm";
};

type BatchDecisionMenu = {
  proposalIds: string[];
};

type NewVersionForm = {
  title: string;
  purpose: string;
  status: SandboxResumeVersionStatus;
};

type FormatAction = "bold" | "italic" | "bullet" | "numbered" | "heading";

type RexApplyEventDetail = {
  sectionId?: SandboxResumeSection["id"];
  patch?: string;
};

type ResumeImportIntent = "new_version" | "replace_current";
type ResumeImportApplyMode = "create_version" | "replace_current";
type ResumeImportResult = {
  resumeImport: {
    id: string;
    fileName: string;
    intent: ResumeImportIntent;
    extractedCharCount: number;
  } | null;
  review: unknown;
  fileName: string;
  extractedCharCount: number;
};

type ResumeImportAppliedEventDetail = {
  snapshot?: SandboxSnapshot;
  applyMode?: ResumeImportApplyMode;
};

function proposalTargetsForSection(sectionId: SandboxResumeSection["id"]) {
  switch (sectionId) {
    case "summary":
      return ["PROFILE_SUMMARY"];
    case "experience":
      return ["EXPERIENCE"];
    case "credentials":
      return ["CREDENTIALS"];
    case "skills":
      return ["SKILLS"];
    case "preferences":
      return ["PREFERENCES"];
  }
}

function pendingProposalsForSection(
  proposals: SandboxProposal[],
  sectionId: SandboxResumeSection["id"],
) {
  const targets = proposalTargetsForSection(sectionId);
  return proposals.filter(
    (proposal) => proposal.status === "PENDING" && targets.includes(proposal.target),
  );
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function looksLikeHtml(value: string) {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

function markdownToHtml(value: string) {
  const lines = escapeHtml(value)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/_(.+?)_/g, "<em>$1</em>")
    .split("\n");
  const html: string[] = [];
  let listOpen = false;
  let orderedOpen = false;

  for (const line of lines) {
    const bullet = line.match(/^\s*[-•]\s+(.+)/);
    const ordered = line.match(/^\s*\d+\.\s+(.+)/);
    if (bullet) {
      if (orderedOpen) {
        html.push("</ol>");
        orderedOpen = false;
      }
      if (!listOpen) {
        html.push("<ul>");
        listOpen = true;
      }
      html.push(`<li>${bullet[1]}</li>`);
      continue;
    }
    if (ordered) {
      if (listOpen) {
        html.push("</ul>");
        listOpen = false;
      }
      if (!orderedOpen) {
        html.push("<ol>");
        orderedOpen = true;
      }
      html.push(`<li>${ordered[1]}</li>`);
      continue;
    }
    if (listOpen) {
      html.push("</ul>");
      listOpen = false;
    }
    if (orderedOpen) {
      html.push("</ol>");
      orderedOpen = false;
    }
    html.push(line.trim() ? `<p>${line}</p>` : "<p><br></p>");
  }
  if (listOpen) html.push("</ul>");
  if (orderedOpen) html.push("</ol>");
  return html.join("");
}

function richTextToHtml(value: string) {
  return looksLikeHtml(value) ? value : markdownToHtml(value);
}

function plainTextFromRichText(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function isBlankRichText(value: string) {
  return plainTextFromRichText(value).length === 0;
}

type LiveResumeWorkspaceProps = {
  initialSnapshot: SandboxSnapshot;
  apiBase?: string;
  profileHref?: string;
  setupHref?: string;
  setupLabel?: string;
};

export function LiveResumeWorkspace({
  initialSnapshot,
  apiBase = "/api/account/live-resume",
  profileHref = "/dashboard/seeker/profile",
  setupHref = "/dashboard/seeker/account",
  setupLabel,
}: LiveResumeWorkspaceProps) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [sections, setSections] = useState(initialSnapshot.resume.sections);
  const [resumeTitle, setResumeTitle] = useState(initialSnapshot.resume.title);
  const [targetRole, setTargetRole] = useState(initialSnapshot.resume.targetRole);
  const [status, setStatus] = useState("Live résumé workspace ready");
  const [activeVersionId, setActiveVersionId] = useState(
    initialSnapshot.activeVersionId ?? initialSnapshot.namedVersions[0]?.id ?? "",
  );
  const [sectionDecisionMenu, setSectionDecisionMenu] = useState<SectionDecisionMenu | null>(null);
  const [batchDecisionMenu, setBatchDecisionMenu] = useState<BatchDecisionMenu | null>(null);
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const [newVersionMenuOpen, setNewVersionMenuOpen] = useState(false);
  const [uploadingIntent, setUploadingIntent] = useState<ResumeImportIntent | null>(null);
  const [newVersionForm, setNewVersionForm] = useState<NewVersionForm>({
    title: `${initialSnapshot.resume.title || "Live Résumé"} variant`,
    purpose: initialSnapshot.resume.targetRole,
    status: "DRAFT",
  });
  const [isPending, startTransition] = useTransition();
  const editorRefs = useRef<Partial<Record<SandboxResumeSection["id"], HTMLDivElement | null>>>({});
  const replaceUploadInputRef = useRef<HTMLInputElement | null>(null);

  const applySnapshot = useCallback((nextSnapshot: SandboxSnapshot, nextStatus: string) => {
    setSnapshot(nextSnapshot);
    setSections(nextSnapshot.resume.sections);
    setResumeTitle(nextSnapshot.resume.title);
    setTargetRole(nextSnapshot.resume.targetRole);
    setActiveVersionId(nextSnapshot.activeVersionId ?? nextSnapshot.namedVersions[0]?.id ?? "");
    setStatus(nextStatus);
    return nextSnapshot;
  }, []);

  const refreshFromResponse = useCallback(async (response: Response, nextStatus: string) => {
    if (!response.ok) {
      setStatus("Something failed — check the terminal");
      return null;
    }
    return applySnapshot((await response.json()) as SandboxSnapshot, nextStatus);
  }, [applySnapshot]);

  const updateSection = useCallback((sectionId: SandboxResumeSection["id"], content: string) => {
    setSections((current) =>
      current.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              content,
              syncStatus: content.trim() ? "DRAFT" : "BLANK",
            }
          : section,
      ),
    );
    setSectionDecisionMenu(null);
    setBatchDecisionMenu(null);
  }, []);

  useEffect(() => {
    function handleRexApply(event: Event) {
      const detail = (event as CustomEvent<RexApplyEventDetail>).detail;
      const sectionId = detail?.sectionId;
      const patch = detail?.patch;
      if (!sectionId || typeof patch !== "string") return;
      if (!sections.some((section) => section.id === sectionId)) return;
      updateSection(sectionId, patch);
      setStatus("Rex draft applied to the editor. Save the section to choose profile sync.");
      requestAnimationFrame(() => {
        editorRefs.current[sectionId]?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    }

    window.addEventListener("careersrx:rex-apply-section", handleRexApply);
    return () => window.removeEventListener("careersrx:rex-apply-section", handleRexApply);
  }, [sections, updateSection]);

  useEffect(() => {
    function handleImportApplied(event: Event) {
      const detail = (event as CustomEvent<ResumeImportAppliedEventDetail>).detail;
      if (!detail?.snapshot) return;
      applySnapshot(detail.snapshot, "Imported résumé draft applied. Checking profile sync impact…");
      void (async () => {
        const response = await fetch(`${apiBase}/analyze`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        const analyzedSnapshot = await refreshFromResponse(
          response,
          "Imported draft ready. Choose which changes update your public profile.",
        );
        if (!analyzedSnapshot) return;
        const pendingProposalIds = analyzedSnapshot.proposals
          .filter((proposal) => proposal.status === "PENDING")
          .map((proposal) => proposal.id);
        if (pendingProposalIds.length > 0) setBatchDecisionMenu({ proposalIds: pendingProposalIds });
      })();
    }

    window.addEventListener("careersrx:resume-import-applied", handleImportApplied);
    return () => window.removeEventListener("careersrx:resume-import-applied", handleImportApplied);
  }, [apiBase, applySnapshot, refreshFromResponse]);

  async function saveDraft(
    sectionId?: SandboxResumeSection["id"],
    nextStatus = "Draft saved",
    sectionsToSave = sections,
  ) {
    setStatus(sectionId ? "Saving section…" : "Saving changes…");
    const response = await fetch(apiBase, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sections: sectionsToSave,
        title: resumeTitle,
        targetRole,
        sectionId,
        namedVersionId: activeVersionId,
      }),
    });
    setSectionDecisionMenu(null);
    setBatchDecisionMenu(null);
    return refreshFromResponse(response, nextStatus);
  }

  async function syncAllChanges() {
    const blankedSections = sections.filter((section) => {
      const previousSection = snapshot.resume.sections.find((candidate) => candidate.id === section.id);
      return previousSection && !isBlankRichText(previousSection.content) && isBlankRichText(section.content);
    });
    if (blankedSections.length > 0) {
      setStatus(
        `Blank section detected: ${blankedSections.map((section) => section.title).join(", ")}. Save that section directly to confirm it should stay blank.`,
      );
      return;
    }

    setStatus("Saving and checking all résumé changes…");
    const saved = await saveDraft(undefined, "Changes saved. Checking all changes…");
    if (!saved) return;
    const response = await fetch(`${apiBase}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const analyzedSnapshot = await refreshFromResponse(response, "Choose how to sync all pending changes.");
    if (!analyzedSnapshot) return;
    const pendingProposalIds = analyzedSnapshot.proposals
      .filter((proposal) => proposal.status === "PENDING")
      .map((proposal) => proposal.id);
    if (pendingProposalIds.length === 0) {
      setStatus("All changed sections are already synced or saved as résumé-only.");
      return;
    }
    setBatchDecisionMenu({ proposalIds: pendingProposalIds });
  }

  async function saveSection(section: SandboxResumeSection) {
    if (isBlankRichText(section.content)) {
      setSectionDecisionMenu({
        sectionId: section.id,
        proposalIds: [],
        state: "blank-confirm",
      });
      setStatus(`${section.title} is blank. Confirm if you want to save it that way.`);
      return;
    }
    const saved = await saveDraft(section.id, `${section.title} saved. Checking profile impact…`);
    if (!saved) return;
    const response = await fetch(`${apiBase}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sectionId: section.id }),
    });
    const analyzedSnapshot = await refreshFromResponse(
      response,
      `${section.title} saved. Choose whether it updates the public profile.`,
    );
    if (!analyzedSnapshot) return;

    const sectionProposals = pendingProposalsForSection(analyzedSnapshot.proposals, section.id);
    setSectionDecisionMenu({
      sectionId: section.id,
      proposalIds: sectionProposals.map((proposal) => proposal.id),
      state: sectionProposals.length > 0 ? "choices" : "resume-only",
    });
  }

  async function saveBlankSection(sectionId: SandboxResumeSection["id"]) {
    const nextSections = sections.map((section) =>
      section.id === sectionId ? { ...section, content: "", syncStatus: "BLANK" as const } : section,
    );
    setSections(nextSections);
    const section = sections.find((candidate) => candidate.id === sectionId);
    const saved = await saveDraft(sectionId, `${section?.title ?? "Section"} saved blank.`, nextSections);
    if ((sectionId === "skills" || sectionId === "credentials") && saved) {
      const response = await fetch(`${apiBase}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sectionId }),
      });
      const analyzedSnapshot = await refreshFromResponse(
        response,
        `${section?.title ?? "Section"} saved blank. Choose whether to clear it from your public profile.`,
      );
      const sectionProposals = analyzedSnapshot
        ? pendingProposalsForSection(analyzedSnapshot.proposals, sectionId)
        : [];
      if (sectionProposals.length > 0) {
        setSectionDecisionMenu({
          sectionId,
          proposalIds: sectionProposals.map((proposal) => proposal.id),
          state: "choices",
        });
        return;
      }
    }
    setSectionDecisionMenu(null);
  }

  async function decideSection(proposalIds: string[], decision: "APPLY" | "KEEP_RESUME_ONLY") {
    if (proposalIds.length === 0) {
      setSectionDecisionMenu(null);
      setStatus("Section saved as résumé-only. Profile already matches or no profile update was detected.");
      return;
    }

    setStatus(decision === "APPLY" ? "Updating profile from this section…" : "Keeping this section résumé-only…");
    let latestSnapshot: SandboxSnapshot | null = null;
    for (const proposalId of proposalIds) {
      const response = await fetch(`${apiBase}/proposals/${proposalId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      if (!response.ok) {
        setStatus("Something failed — check the terminal");
        return;
      }
      latestSnapshot = (await response.json()) as SandboxSnapshot;
    }

    if (latestSnapshot) {
      setSnapshot(latestSnapshot);
      setSections(latestSnapshot.resume.sections);
      setResumeTitle(latestSnapshot.resume.title);
      setTargetRole(latestSnapshot.resume.targetRole);
      setActiveVersionId(latestSnapshot.activeVersionId ?? latestSnapshot.namedVersions[0]?.id ?? "");
    }
    setSectionDecisionMenu(null);
    setBatchDecisionMenu(null);
    setStatus(decision === "APPLY" ? "Profile updated from section" : "Section kept résumé-only");
  }

  async function decideBatch(decision: "APPLY" | "KEEP_RESUME_ONLY") {
    if (!batchDecisionMenu) return;
    setStatus(decision === "APPLY" ? "Updating profile from all changes…" : "Keeping all changes résumé-only…");
    await decideSection(batchDecisionMenu.proposalIds, decision);
    setBatchDecisionMenu(null);
  }

  async function createNamedVersion(source: "current" | "blank" = "current") {
    if (!newVersionForm.title.trim()) {
      setStatus("Name this résumé version before saving it.");
      return;
    }
    setStatus("Saving current edits before creating a named version…");
    const saved = await saveDraft(undefined, "Current edits saved. Creating named version…");
    if (!saved) return;
    setStatus(source === "blank" ? "Creating blank résumé version…" : "Creating named résumé version…");
    const response = await fetch(`${apiBase}/versions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...newVersionForm, source }),
    });
    setNewVersionMenuOpen(false);
    await refreshFromResponse(
      response,
      source === "blank" ? "Blank résumé version created and loaded." : "Named résumé version created and loaded.",
    );
  }

  async function uploadResumeForImport(file: File | null, intent: ResumeImportIntent) {
    if (!file) return;
    setUploadingIntent(intent);
    setStatus("Uploading résumé and asking Rex to parse it…");
    window.dispatchEvent(
      new CustomEvent("careersrx:rex-import-progress", {
        detail: {
          fileName: file.name,
          intent,
        },
      }),
    );
    const formData = new FormData();
    formData.set("file", file);
    formData.set("intent", intent);
    const response = await fetch(`${apiBase}/import`, {
      method: "POST",
      body: formData,
    });
    setUploadingIntent(null);
    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      const error = data?.error ?? "Rex could not import that résumé.";
      window.dispatchEvent(new CustomEvent("careersrx:rex-import-error", { detail: { error } }));
      setStatus(error);
      return;
    }
    const result = (await response.json()) as ResumeImportResult;
    window.dispatchEvent(
      new CustomEvent("careersrx:rex-import-review", {
        detail: {
          resumeImport: result.resumeImport,
          review: result.review,
          applyMode: intent === "replace_current" ? "replace_current" : "create_version",
          applyLabel: intent === "replace_current" ? "Replace Current Draft" : "Create Draft Version",
          fileName: result.fileName,
          extractedCharCount: result.extractedCharCount,
        },
      }),
    );
    setStatus("Rex prepared an import review. Open the Rex drawer to continue.");
  }

  async function selectNamedVersion(versionId: string) {
    setStatus("Loading named résumé version…");
    const response = await fetch(`${apiBase}/versions/${versionId}/select`, { method: "POST" });
    await refreshFromResponse(response, "Named résumé version loaded.");
  }

  function previewRevision(revisionId: string) {
    const revision = snapshot.revisions.find((candidate) => candidate.id === revisionId);
    if (!revision?.resume) return;
    setResumeTitle(revision.resume.title);
    setTargetRole(revision.resume.targetRole);
    setSections(revision.resume.sections);
    setActiveVersionId(revision.parentVersionId);
    setSectionDecisionMenu(null);
    setBatchDecisionMenu(null);
    setStatus(`Revision ${revision.versionNumber} previewed. Restore it to make it current without deleting newer work.`);
  }

  async function restoreRevision(revisionId: string) {
    setStatus("Restoring revision as a new current revision…");
    const response = await fetch(`${apiBase}/revisions/${revisionId}/restore`, { method: "POST" });
    await refreshFromResponse(response, "Revision restored non-destructively.");
  }

  function applyFormat(sectionId: SandboxResumeSection["id"], action: FormatAction) {
    const editor = editorRefs.current[sectionId];
    if (!editor) return;
    editor.focus();
    if (action === "bold") document.execCommand("bold");
    if (action === "italic") document.execCommand("italic");
    if (action === "bullet") document.execCommand("insertUnorderedList");
    if (action === "numbered") document.execCommand("insertOrderedList");
    if (action === "heading") document.execCommand("formatBlock", false, "h3");
    updateSection(sectionId, editor.innerHTML);
    requestAnimationFrame(() => {
      editor.focus();
    });
  }

  const hasProfile = Boolean(snapshot.profile.fullName.trim());

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-surface p-3 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-[260px] flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-foreground">Workspace controls</h2>
              <Badge tone="success">Logged in</Badge>
              {hasProfile ? <Badge tone="success">Profile created</Badge> : <Badge tone="warning">No profile yet</Badge>}
            </div>
            <p className="mt-1 max-w-3xl text-sm text-muted">
              Edit the live résumé, then choose which saved section changes update the public profile.
            </p>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <RexOpenButton className="min-h-10 px-3 py-1.5" />
            <div className="relative">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-10 whitespace-nowrap"
                onClick={() => startTransition(() => void syncAllChanges())}
                disabled={isPending}
              >
                {isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                Sync All
              </Button>
              {batchDecisionMenu ? (
                <InlineBatchDecision
                  proposalCount={batchDecisionMenu.proposalIds.length}
                  onUpdateProfile={() => startTransition(() => void decideBatch("APPLY"))}
                  onKeepResumeOnly={() => startTransition(() => void decideBatch("KEEP_RESUME_ONLY"))}
                  onDismiss={() => setBatchDecisionMenu(null)}
                />
              ) : null}
            </div>
            <Button href={profileHref} variant="outline" size="sm">
              <Eye size={16} /> View Public Profile
            </Button>
            <div className="relative">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-10 whitespace-nowrap"
                onClick={() => {
                  setNewVersionForm({
                    title: `${resumeTitle || "Live Résumé"} variant`,
                    purpose: targetRole,
                    status: "DRAFT",
                  });
                  setNewVersionMenuOpen((current) => !current);
                  setActionMenuOpen(false);
                  setSectionDecisionMenu(null);
                  setBatchDecisionMenu(null);
                }}
                disabled={isPending}
              >
                <FilePenLine size={16} /> New version
              </Button>
              {newVersionMenuOpen ? (
                <NewVersionMenu
                  form={newVersionForm}
                  onChange={setNewVersionForm}
                  uploading={uploadingIntent === "new_version"}
                  onCreateFromCurrent={() => startTransition(() => void createNamedVersion("current"))}
                  onCreateBlank={() => startTransition(() => void createNamedVersion("blank"))}
                  onUpload={(file) => void uploadResumeForImport(file, "new_version")}
                  onDismiss={() => setNewVersionMenuOpen(false)}
                />
              ) : null}
            </div>
            <div className="relative">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="min-h-10 px-2.5"
                onClick={() => {
                  setActionMenuOpen((current) => !current);
                  setNewVersionMenuOpen(false);
                }}
                aria-label="More workspace actions"
              >
                <MoreHorizontal size={18} />
              </Button>
              {actionMenuOpen ? (
                <div className="absolute right-0 top-[calc(100%+0.5rem)] z-20 w-64 rounded-2xl border border-border bg-surface p-2 text-sm shadow-xl">
                  {setupHref ? (
                    <Button href={setupHref} variant="ghost" size="sm" className="w-full justify-start">
                      <UserPlus size={16} /> {setupLabel ?? (hasProfile ? "Account Settings" : "Create Profile")}
                    </Button>
                  ) : null}
                  <button
                    type="button"
                    disabled={uploadingIntent === "replace_current"}
                    onClick={() => {
                      const confirmed = window.confirm(
                        "Upload into the current live résumé? Rex will show a review first, but applying the import will replace existing section contents.",
                      );
                      if (confirmed) replaceUploadInputRef.current?.click();
                    }}
                    className="flex min-h-10 w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold text-foreground hover:bg-primary-light disabled:opacity-50"
                  >
                    {uploadingIntent === "replace_current" ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Upload size={16} />
                    )}
                    Upload into current résumé
                  </button>
                </div>
              ) : null}
              <input
                ref={replaceUploadInputRef}
                type="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="hidden"
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0] ?? null;
                  event.currentTarget.value = "";
                  void uploadResumeForImport(file, "replace_current");
                }}
              />
            </div>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-3 border-t border-border pt-2 text-xs text-muted">
          <span>{status}</span>
          <span>Changes are saved to your CareersRX account workspace.</span>
        </div>
      </div>

      {!hasProfile ? (
        <div className="rounded-2xl border border-warning/30 bg-[#f6ecd8]/50 p-4 text-sm text-foreground">
          <strong>Finish your profile first</strong>{" "}
          to test the full loop: signup fields populate the live résumé, then résumé
          edits sync back to the profile only when you approve them.
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="space-y-4 rounded-2xl border border-border bg-surface p-3">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted">
              <FilePenLine size={15} /> Resume Outline
            </h2>
            <div className="mt-3 space-y-1.5">
              {sections.map((section) => (
                <a
                  key={section.id}
                  href={`#resume-section-${section.id}`}
                  className="block rounded-xl border border-border p-2.5 hover:bg-primary-light/40"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-foreground">{section.title}</span>
                    <Badge tone={statusTone[section.syncStatus]}>{label(section.syncStatus)}</Badge>
                  </div>
                </a>
              ))}
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted">
              <FileClock size={15} /> Résumé Versions
            </h2>
            <p className="mt-2 text-xs leading-5 text-muted">
              Named versions are intentional variants. Regular saves only add internal revisions.
            </p>
            <div className="mt-3 space-y-1.5">
              {snapshot.namedVersions.length === 0 ? (
                <p className="text-sm text-muted">Create a profile or save changes to create the first résumé version.</p>
              ) : (
                snapshot.namedVersions.map((version) => (
                  <button
                    key={version.id}
                    type="button"
                    onClick={() => startTransition(() => void selectNamedVersion(version.id))}
                    disabled={!version.resume}
                    className={`w-full rounded-xl border p-2.5 text-left text-sm transition-colors ${
                      activeVersionId === version.id
                        ? "border-primary bg-primary-light/60"
                        : "border-border hover:bg-primary-light/40"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-foreground">{version.title}</p>
                      <Badge tone={version.status === "ARCHIVED" ? "neutral" : version.status === "ACTIVE" ? "success" : "accent"}>
                        {label(version.status)}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {version.purpose || "General version"} · {version.revisionCount} revision
                      {version.revisionCount === 1 ? "" : "s"}
                    </p>
                    <p className="mt-1 text-[11px] text-muted">
                      {version.isCurrent ? "Current branch" : "Click to load"} · {formatDate(version.updatedAt)}
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted">
              <FileClock size={15} /> Revision History
            </h2>
            <p className="mt-2 text-xs leading-5 text-muted">
              Internal saves for the selected version. Restore creates a new revision.
            </p>
            <div className="mt-3 space-y-1.5">
              {snapshot.revisions.length === 0 ? (
                <p className="text-sm text-muted">No revisions yet.</p>
              ) : (
                snapshot.revisions.slice(0, 5).map((revision) => (
                  <div key={revision.id} className="rounded-xl border border-border p-2.5 text-sm">
                    <p className="font-medium text-foreground">Revision {revision.versionNumber}</p>
                    <p className="mt-1 text-xs text-muted">
                      {revision.note || revision.source} · {formatDate(revision.createdAt)}
                    </p>
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() => previewRevision(revision.id)}
                        disabled={!revision.resume}
                        className="rounded-lg border border-border px-2 py-1 text-xs font-medium text-foreground hover:bg-primary-light disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Preview
                      </button>
                      <button
                        type="button"
                        onClick={() => startTransition(() => void restoreRevision(revision.id))}
                        className="rounded-lg border border-border px-2 py-1 text-xs font-medium text-foreground hover:bg-primary-light"
                      >
                        Restore
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>

        <main className="space-y-4 rounded-2xl border border-border bg-surface p-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_220px]">
            <div>
              <label htmlFor="resume-title" className="mb-1.5 block text-sm font-medium text-foreground">
                Resume title
              </label>
              <input
                id="resume-title"
                value={resumeTitle}
                onChange={(event) => setResumeTitle(event.target.value)}
                placeholder="e.g. Operations Manager Master Résumé"
                className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus-visible:border-primary"
              />
            </div>
            <div>
              <label htmlFor="target-role" className="mb-1.5 block text-sm font-medium text-foreground">
                Target role
              </label>
              <input
                id="target-role"
                value={targetRole}
                onChange={(event) => setTargetRole(event.target.value)}
                placeholder="e.g. Operations Manager"
                className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus-visible:border-primary"
              />
            </div>
          </div>

          {sections.map((section) => (
            <section id={`resume-section-${section.id}`} key={section.id} className="rounded-2xl border border-border bg-background p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="font-semibold text-foreground">{section.title}</h2>
                  <p className="mt-1 text-xs text-muted">{section.helper}</p>
                </div>
                <div className="relative flex flex-wrap items-center gap-2">
                  <Badge tone={statusTone[section.syncStatus]}>{label(section.syncStatus)}</Badge>
                  <div className="relative">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => startTransition(() => void saveSection(section))}
                      disabled={isPending || !hasProfile}
                    >
                      {isPending ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                      Save Section
                    </Button>
                    {sectionDecisionMenu?.sectionId === section.id ? (
                      <InlineSectionDecision
                        menu={sectionDecisionMenu}
                        onUpdateProfile={() =>
                          startTransition(() => void decideSection(sectionDecisionMenu.proposalIds, "APPLY"))
                        }
                        onKeepResumeOnly={() =>
                          startTransition(() =>
                            void decideSection(sectionDecisionMenu.proposalIds, "KEEP_RESUME_ONLY"),
                          )
                        }
                        onSaveBlank={() => startTransition(() => void saveBlankSection(section.id))}
                        onDismiss={() => setSectionDecisionMenu(null)}
                      />
                    ) : null}
                  </div>
                </div>
              </div>
              <FormattingToolbar sectionId={section.id} onFormat={applyFormat} />
              <RichSectionEditor
                section={section}
                placeholder={placeholderFor(section.id)}
                onChange={updateSection}
                setEditorRef={(node) => {
                  editorRefs.current[section.id] = node;
                }}
              />
            </section>
          ))}
        </main>
      </div>
    </div>
  );
}

function placeholderFor(sectionId: SandboxResumeSection["id"]) {
  switch (sectionId) {
    case "summary":
      return "Example: Product-minded operator with 5 years leading support teams...";
    case "experience":
      return "Example:\nOperations Lead, Acme Co.\n• Improved onboarding process by 30%...";
    case "credentials":
      return "Example: PMP, Google Project Management Certificate, RN, BLS...";
    case "skills":
      return "Example: Team leadership, Scheduling, Epic, Salesforce, Budgeting...";
    case "preferences":
      return "Example:\nRoles:\nOperations Manager\nProgram Manager\n\nLocations:\nRemote\nAustin";
  }
}

function NewVersionMenu({
  form,
  uploading,
  onChange,
  onCreateFromCurrent,
  onCreateBlank,
  onUpload,
  onDismiss,
}: {
  form: NewVersionForm;
  uploading: boolean;
  onChange: (form: NewVersionForm) => void;
  onCreateFromCurrent: () => void;
  onCreateBlank: () => void;
  onUpload: (file: File | null) => void;
  onDismiss: () => void;
}) {
  return (
    <div className="absolute right-0 top-[calc(100%+0.5rem)] z-20 w-80 rounded-2xl border border-border bg-surface p-3 text-sm shadow-xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-foreground">Create new résumé version</p>
          <p className="mt-1 text-xs leading-5 text-muted">
            Start blank, clone the current draft, or upload a PDF/DOCX for Rex to organize first.
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Close new version menu"
          className="rounded-lg p-1 text-muted hover:bg-primary-light hover:text-foreground"
        >
          <X size={15} />
        </button>
      </div>
      <div className="mt-3 space-y-3">
        <label className="block text-xs font-semibold uppercase tracking-wide text-muted">
          Version title
          <input
            value={form.title}
            onChange={(event) => onChange({ ...form, title: event.target.value })}
            className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm normal-case tracking-normal text-foreground outline-none focus-visible:border-primary"
            placeholder="NP transition résumé"
          />
        </label>
        <label className="block text-xs font-semibold uppercase tracking-wide text-muted">
          Purpose or target role
          <input
            value={form.purpose}
            onChange={(event) => onChange({ ...form, purpose: event.target.value })}
            className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm normal-case tracking-normal text-foreground outline-none focus-visible:border-primary"
            placeholder="Nurse practitioner roles"
          />
        </label>
        <label className="block text-xs font-semibold uppercase tracking-wide text-muted">
          Status
          <select
            value={form.status}
            onChange={(event) =>
              onChange({ ...form, status: event.target.value as SandboxResumeVersionStatus })
            }
            className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm normal-case tracking-normal text-foreground outline-none focus-visible:border-primary"
          >
            <option value="DRAFT">Draft</option>
            <option value="ACTIVE">Active</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </label>
        <div className="grid gap-2 border-t border-border pt-3">
          <Button type="button" size="sm" onClick={onCreateFromCurrent} className="w-full justify-start">
            <Save size={15} /> Create from current résumé
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onCreateBlank} className="w-full justify-start">
            <FilePenLine size={15} /> Create blank version
          </Button>
          <label className="inline-flex min-h-11 w-full cursor-pointer items-center justify-start gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm font-semibold text-foreground hover:bg-primary-light">
            {uploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
            Upload PDF/DOCX for Rex review
            <input
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0] ?? null;
                event.currentTarget.value = "";
                onUpload(file);
              }}
            />
          </label>
        </div>
      </div>
    </div>
  );
}

function RichSectionEditor({
  section,
  placeholder,
  onChange,
  setEditorRef,
}: {
  section: SandboxResumeSection;
  placeholder: string;
  onChange: (sectionId: SandboxResumeSection["id"], content: string) => void;
  setEditorRef: (node: HTMLDivElement | null) => void;
}) {
  const localRef = useRef<HTMLDivElement | null>(null);
  const lastContent = useRef(section.content);

  useEffect(() => {
    const editor = localRef.current;
    if (!editor || lastContent.current === section.content) return;
    const nextHtml = section.content ? richTextToHtml(section.content) : "";
    if (editor.innerHTML !== nextHtml) editor.innerHTML = nextHtml;
    lastContent.current = section.content;
  }, [section.content]);

  function bindRef(node: HTMLDivElement | null) {
    localRef.current = node;
    setEditorRef(node);
    if (node && lastContent.current) {
      const nextHtml = richTextToHtml(lastContent.current);
      if (node.innerHTML !== nextHtml) node.innerHTML = nextHtml;
    }
  }

  function commitContent() {
    const editor = localRef.current;
    if (!editor) return;
    const nextContent = isBlankRichText(editor.innerHTML) ? "" : editor.innerHTML;
    lastContent.current = nextContent;
    onChange(section.id, nextContent);
  }

  return (
    <div
      ref={bindRef}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-multiline="true"
      aria-label={`${section.title} editor`}
      data-placeholder={placeholder}
      onInput={commitContent}
      onBlur={() => {
        if (localRef.current && isBlankRichText(localRef.current.innerHTML)) {
          localRef.current.innerHTML = "";
          commitContent();
        }
      }}
      className="mt-2 min-h-[170px] rounded-xl border border-border bg-surface p-4 text-sm leading-7 outline-none empty:before:text-muted empty:before:content-[attr(data-placeholder)] focus-visible:border-primary [&_em]:italic [&_h3]:mb-2 [&_h3]:text-base [&_h3]:font-bold [&_li]:ml-5 [&_ol]:list-decimal [&_strong]:font-bold [&_ul]:list-disc"
    />
  );
}

function FormattingToolbar({
  sectionId,
  onFormat,
}: {
  sectionId: SandboxResumeSection["id"];
  onFormat: (sectionId: SandboxResumeSection["id"], action: FormatAction) => void;
}) {
  const tools: Array<{ action: FormatAction; label: string; icon: React.ReactNode }> = [
    { action: "heading", label: "Heading", icon: <Heading1 size={14} /> },
    { action: "bold", label: "Bold", icon: <Bold size={14} /> },
    { action: "italic", label: "Italic", icon: <Italic size={14} /> },
    { action: "bullet", label: "Bullets", icon: <List size={14} /> },
    { action: "numbered", label: "Numbered", icon: <ListOrdered size={14} /> },
  ];

  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5 rounded-xl border border-border bg-surface p-1.5">
      {tools.map((tool) => (
        <button
          key={tool.action}
          type="button"
          onClick={() => onFormat(sectionId, tool.action)}
          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-primary-light"
        >
          {tool.icon}
          {tool.label}
        </button>
      ))}
    </div>
  );
}

function InlineSectionDecision({
  menu,
  onUpdateProfile,
  onKeepResumeOnly,
  onSaveBlank,
  onDismiss,
}: {
  menu: SectionDecisionMenu;
  onUpdateProfile: () => void;
  onKeepResumeOnly: () => void;
  onSaveBlank: () => void;
  onDismiss: () => void;
}) {
  const hasProfileProposal = menu.proposalIds.length > 0;
  const isBlankConfirmation = menu.state === "blank-confirm";

  return (
    <div className="absolute right-0 top-[calc(100%+0.5rem)] z-20 w-72 rounded-2xl border border-border bg-surface p-3 text-sm shadow-xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-foreground">
            {isBlankConfirmation
              ? "Save this section blank?"
              : hasProfileProposal
                ? "Where should this change go?"
                : "Section saved"}
          </p>
          <p className="mt-1 text-xs leading-5 text-muted">
            {isBlankConfirmation
              ? "This section has no visible content. Confirm if you intentionally want it saved blank."
              : hasProfileProposal
                ? "Choose now so the profile decision stays attached to this section."
                : "No profile change was detected. This version is saved as résumé-only."}
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Close section sync menu"
          className="rounded-lg p-1 text-muted hover:bg-primary-light hover:text-foreground"
        >
          <X size={15} />
        </button>
      </div>
      <div className="mt-3 grid gap-2">
        {isBlankConfirmation ? (
          <Button type="button" size="sm" variant="danger" onClick={onSaveBlank} className="w-full justify-start">
            <Save size={15} /> Save Blank
          </Button>
        ) : null}
        {!isBlankConfirmation && hasProfileProposal ? (
          <Button type="button" size="sm" onClick={onUpdateProfile} className="w-full justify-start">
            <CheckCircle2 size={15} /> Update Profile
          </Button>
        ) : null}
        {!isBlankConfirmation ? (
          <Button type="button" size="sm" variant="outline" onClick={onKeepResumeOnly} className="w-full justify-start">
            <FilePenLine size={15} /> Keep Résumé Only
          </Button>
        ) : (
          <Button type="button" size="sm" variant="outline" onClick={onDismiss} className="w-full justify-start">
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}

function InlineBatchDecision({
  proposalCount,
  onUpdateProfile,
  onKeepResumeOnly,
  onDismiss,
}: {
  proposalCount: number;
  onUpdateProfile: () => void;
  onKeepResumeOnly: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="absolute right-0 top-[calc(100%+0.5rem)] z-20 w-80 rounded-2xl border border-border bg-surface p-3 text-sm shadow-xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-foreground">Sync {proposalCount} pending change{proposalCount === 1 ? "" : "s"}</p>
          <p className="mt-1 text-xs leading-5 text-muted">
            Only changed unsynced sections are included. Sections that already match your profile stay synced.
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Close batch sync menu"
          className="rounded-lg p-1 text-muted hover:bg-primary-light hover:text-foreground"
        >
          <X size={15} />
        </button>
      </div>
      <div className="mt-3 grid gap-2">
        <Button type="button" size="sm" onClick={onUpdateProfile} className="w-full justify-start">
          <CheckCircle2 size={15} /> Update Profile for All
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onKeepResumeOnly} className="w-full justify-start">
          <FilePenLine size={15} /> Keep All Résumé Only
        </Button>
      </div>
    </div>
  );
}

"use client";

import { FormEvent, useEffect, useMemo, useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import { Bot, ChevronDown, Loader2, MessageSquareText, Send, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/Button";

type SectionId = "summary" | "experience" | "credentials" | "skills" | "preferences";
type RexTask =
  | "review_summary"
  | "review_section"
  | "resume_hygiene"
  | "suggest_skills_for_role"
  | "custom_chat"
  | "profile_sync_help"
  | "site_navigation"
  | "privacy_data";

type ChatTurn = {
  role: "user" | "assistant";
  content: string;
};

type SuggestionCard = {
  id: string;
  title: string;
  body: string;
  targetSectionId: SectionId | null;
  patch: string | null;
  actionLabel: string;
};

type RexResponse = {
  assistantName: "Rex";
  answer: string;
  suggestions: string[];
  sectionPatch: string | null;
  sectionId: SectionId | null;
  suggestionCards: SuggestionCard[];
  link: {
    label: string;
    href: string;
  } | null;
  safetyNotes: string[];
  demoMode: boolean;
};

type ResumeImportApplyMode = "create_version" | "replace_current" | "fill_signup_fields";
type ResumeImportPlacement = {
  sectionId: SectionId;
  title: string;
  content: string;
  sourceEvidence: string;
  confidence: number;
  notes: string[];
};
type ResumeImportReview = {
  assistantName: "Rex";
  answer: string;
  resumeTitle: string;
  targetRole: string;
  placements: ResumeImportPlacement[];
  suggestions: string[];
  ambiguousItems: string[];
  unsupportedItems: string[];
  confidence: number;
  safetyNotes: string[];
};
type ResumeImportReviewDetail = {
  resumeImport: {
    id: string;
    fileName: string;
    intent: "new_version" | "replace_current" | "signup_onboarding";
    extractedCharCount: number;
  } | null;
  review: ResumeImportReview;
  applyMode: ResumeImportApplyMode;
  applyLabel: string;
  fileName: string;
  extractedCharCount: number;
  signupPrefill?: {
    headline: string;
    summary: string;
    experience: string;
    skills: string;
    credentials: string;
    preferredRoles: string;
    preferredLocations: string;
  };
};

type ResumeImportProgressDetail = {
  fileName?: string;
  intent?: "new_version" | "replace_current" | "signup_onboarding";
};

type ResumeImportErrorDetail = {
  error?: string;
};

type DrawerPanel = "tasks" | "chat" | "result" | "import";

const sectionOptions: Array<{ id: SectionId; label: string }> = [
  { id: "summary", label: "Summary" },
  { id: "experience", label: "Experience" },
  { id: "credentials", label: "Credentials" },
  { id: "skills", label: "Skills" },
  { id: "preferences", label: "Preferences" },
];

const actionLabels: Record<RexTask, string> = {
  review_summary: "Rex is reviewing your summary…",
  review_section: "Rex is improving that section…",
  resume_hygiene: "Rex is checking résumé hygiene…",
  suggest_skills_for_role: "Rex is suggesting skills…",
  custom_chat: "Rex is thinking through your question…",
  profile_sync_help: "Rex is explaining profile sync…",
  site_navigation: "Rex is finding that page…",
  privacy_data: "Rex is reviewing data handling…",
};

const storageKey = "careersrx-rex-drawer-open";
const messageLimit = 800;
const importMessageLimit = 500;

function assistantEndpoint(pathname: string) {
  return pathname.startsWith("/demo") ? "/api/demo/live-resume/assistant" : "/api/account/live-resume/assistant";
}

function canApplyOnPage(pathname: string) {
  return pathname === "/demo/live-resume" || pathname === "/dashboard/seeker/resume";
}

function liveResumeHref(pathname: string) {
  return pathname.startsWith("/demo") ? "/demo/live-resume" : "/dashboard/seeker/resume";
}

function importApplyEndpoint(pathname: string, importId: string) {
  const base = pathname.startsWith("/demo") ? "/api/demo/live-resume/import" : "/api/account/live-resume/import";
  return `${base}/${importId}/apply`;
}

function importFollowupEndpoint(pathname: string, importId: string) {
  const base = pathname.startsWith("/demo") ? "/api/demo/live-resume/import" : "/api/account/live-resume/import";
  return `${base}/${importId}/follow-up`;
}

function scopedIntro(pathname: string) {
  if (canApplyOnPage(pathname)) {
    return "I can review this live résumé, draft editor-only changes, and explain profile sync.";
  }
  return "I can help with your CareersRX profile and live résumé. Open the live résumé for full section edits.";
}

function dispatchOpenEvent() {
  window.dispatchEvent(new Event("careersrx:rex-open"));
}

function applyToEditor(card: { targetSectionId: SectionId | null; patch: string | null }) {
  if (!card.targetSectionId || !card.patch) return;
  window.dispatchEvent(
    new CustomEvent("careersrx:rex-apply-section", {
      detail: {
        sectionId: card.targetSectionId,
        patch: card.patch,
      },
    }),
  );
}

export function RexOpenButton({ className = "" }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={dispatchOpenEvent}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-accent-dark ${className}`}
    >
      <Sparkles size={16} /> Ask Rex
    </button>
  );
}

export function RexAssistantDrawer() {
  const pathname = usePathname() ?? "/";
  const [open, setOpen] = useState(false);
  const [activePanel, setActivePanel] = useState<DrawerPanel>("tasks");
  const [selectedSectionId, setSelectedSectionId] = useState<SectionId>("summary");
  const [jobTitle, setJobTitle] = useState("");
  const [message, setMessage] = useState("");
  const [response, setResponse] = useState<RexResponse | null>(null);
  const [importReview, setImportReview] = useState<ResumeImportReviewDetail | null>(null);
  const [importProgress, setImportProgress] = useState<ResumeImportProgressDetail | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState("");
  const [importFollowup, setImportFollowup] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatTurn[]>([]);
  const [status, setStatus] = useState("Rex is ready when you are.");
  const [loggedOut, setLoggedOut] = useState(false);
  const [activeTask, setActiveTask] = useState<RexTask | null>(null);
  const [activeApplyId, setActiveApplyId] = useState<string | null>(null);
  const [importApplying, setImportApplying] = useState(false);
  const [importFollowupPending, setImportFollowupPending] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setOpen(window.localStorage.getItem(storageKey) === "true");
    }, 0);

    function handleOpen() {
      setOpen(true);
      window.localStorage.setItem(storageKey, "true");
    }

    function handleImportReview(event: Event) {
      const detail = (event as CustomEvent<ResumeImportReviewDetail>).detail;
      if (!detail?.review) return;
      setOpen(true);
      setImportReview(detail);
      setImportProgress(null);
      setImportError(null);
      setImportFollowup(null);
      setActivePanel("import");
      setStatus("Rex prepared an uploaded résumé review.");
      window.localStorage.setItem(storageKey, "true");
    }

    function handleImportProgress(event: Event) {
      const detail = (event as CustomEvent<ResumeImportProgressDetail>).detail ?? {};
      setOpen(true);
      setImportReview(null);
      setImportProgress(detail);
      setImportError(null);
      setImportFollowup(null);
      setActivePanel("import");
      setStatus("Rex is importing your résumé…");
      window.localStorage.setItem(storageKey, "true");
    }

    function handleImportError(event: Event) {
      const detail = (event as CustomEvent<ResumeImportErrorDetail>).detail ?? {};
      setImportProgress(null);
      setImportError(detail.error ?? "Rex could not import that résumé.");
      setActivePanel("import");
      setStatus(detail.error ?? "Rex could not import that résumé.");
    }

    window.addEventListener("careersrx:rex-open", handleOpen);
    window.addEventListener("careersrx:rex-import-progress", handleImportProgress);
    window.addEventListener("careersrx:rex-import-review", handleImportReview);
    window.addEventListener("careersrx:rex-import-error", handleImportError);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("careersrx:rex-open", handleOpen);
      window.removeEventListener("careersrx:rex-import-progress", handleImportProgress);
      window.removeEventListener("careersrx:rex-import-review", handleImportReview);
      window.removeEventListener("careersrx:rex-import-error", handleImportError);
    };
  }, []);

  function setDrawerOpen(nextOpen: boolean) {
    setOpen(nextOpen);
    window.localStorage.setItem(storageKey, String(nextOpen));
  }

  const applyEnabled = canApplyOnPage(pathname);
  const intro = useMemo(() => scopedIntro(pathname), [pathname]);

  async function askRex(
    task: RexTask,
    options: {
      sectionId?: SectionId;
      jobTitle?: string;
      message?: string;
      navigationTarget?: string;
    } = {},
  ) {
    setLoggedOut(false);
    setActiveTask(task);
    setStatus(actionLabels[task]);
    const payload = {
      task,
      sectionId: options.sectionId,
      jobTitle: options.jobTitle,
      navigationTarget: options.navigationTarget,
      message: options.message,
      chatHistory: chatHistory.slice(-6),
    };

    const endpoint = assistantEndpoint(pathname);
    const fetchResponse = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setActiveTask(null);

    if (fetchResponse.status === 401) {
      setLoggedOut(true);
      setStatus("Log in or use the demo to let Rex see a live résumé.");
      return;
    }

    if (!fetchResponse.ok) {
      setStatus("Rex could not complete that request. Try again in a moment.");
      return;
    }

    const nextResponse = (await fetchResponse.json()) as RexResponse;
    setResponse(nextResponse);
    setActivePanel(task === "custom_chat" ? "chat" : "result");
    setStatus(nextResponse.demoMode ? "Rex answered with safe local guidance." : "Rex finished reviewing.");

    if (task === "custom_chat" && options.message) {
      setChatHistory((current) =>
        [
          ...current,
          { role: "user" as const, content: options.message ?? "" },
          { role: "assistant" as const, content: nextResponse.answer },
        ].slice(-6),
      );
    }
  }

  function submitChat(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedMessage = message.trim();
    if (!trimmedMessage || trimmedMessage.length > messageLimit) return;
    setMessage("");
    setActivePanel("chat");
    startTransition(() => void askRex("custom_chat", { message: trimmedMessage }));
  }

  function applySuggestion(card: SuggestionCard | { id: string; targetSectionId: SectionId | null; patch: string | null }) {
    if (!applyEnabled || !card.targetSectionId || !card.patch) return;
    setActiveApplyId(card.id);
    setStatus("Applying Rex suggestion to the editor…");
    applyToEditor(card);
    window.setTimeout(() => {
      setStatus("Draft applied to editor. Save the section to choose profile sync.");
      setActiveApplyId(null);
    }, 450);
  }

  async function applyImportReview() {
    if (!importReview) return;
    setImportApplying(true);
    setStatus("Applying Rex import review…");

    if (importReview.applyMode === "fill_signup_fields") {
      window.dispatchEvent(
        new CustomEvent("careersrx:resume-import-signup-apply", {
          detail: {
            review: importReview.review,
            signupPrefill: importReview.signupPrefill,
          },
        }),
      );
      setStatus("Rex import applied to sign-up fields. Review before creating the account.");
      setImportApplying(false);
      return;
    }

    const importId = importReview.resumeImport?.id;
    if (!importId) {
      setStatus("This import review is missing its apply record.");
      setImportApplying(false);
      return;
    }

    const fetchResponse = await fetch(importApplyEndpoint(pathname, importId), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ applyMode: importReview.applyMode }),
    });
    setImportApplying(false);
    if (!fetchResponse.ok) {
      setStatus("Rex could not apply that import. Try uploading again.");
      return;
    }
    const snapshot = await fetchResponse.json();
    window.dispatchEvent(
      new CustomEvent("careersrx:resume-import-applied", {
        detail: {
          snapshot,
          applyMode: importReview.applyMode,
        },
      }),
    );
    setStatus("Import applied to the live résumé draft. Review sync choices next.");
  }

  async function submitImportFollowup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!importReview) return;
    const trimmedMessage = importMessage.trim();
    if (!trimmedMessage || trimmedMessage.length > importMessageLimit) return;
    setImportFollowupPending(true);
    setStatus("Rex is reviewing your import follow-up…");
    if (!importReview.resumeImport?.id) {
      window.setTimeout(() => {
        setImportFollowup(
          "I’m Rex, your CareersRX résumé and profile assistant. Because this is a sign-up import, I can review the placement plan but I cannot reference a saved profile yet. Apply the fields, then adjust any detail in the matching section before creating the account.",
        );
        setImportMessage("");
        setImportFollowupPending(false);
        setStatus("Rex answered your import follow-up.");
      }, 350);
      return;
    }
    const fetchResponse = await fetch(importFollowupEndpoint(pathname, importReview.resumeImport.id), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: trimmedMessage }),
    });
    setImportFollowupPending(false);
    if (!fetchResponse.ok) {
      setStatus("Rex could not answer that import follow-up.");
      return;
    }
    const data = (await fetchResponse.json()) as { answer?: string };
    setImportFollowup(data.answer ?? "Rex reviewed the import note.");
    setImportMessage("");
    setStatus("Rex answered your import follow-up.");
  }

  return (
    <>
      {!open ? <RexOpenButton className="fixed bottom-5 right-5 z-50 shadow-lg" /> : null}

      {importProgress ? <ResumeImportLoadingOverlay progress={importProgress} /> : null}

      {open ? (
        <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[380px] flex-col border-l border-border bg-surface shadow-2xl">
          <div className="border-b border-border p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-white">
                  <Bot size={18} />
                </div>
                <div>
                  <h2 className="font-semibold text-foreground">Rex Assistant</h2>
                  <p className="text-xs text-muted">CareersRX résumé and profile help</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close Rex"
                className="rounded-xl p-2 text-muted hover:bg-primary-light hover:text-foreground"
              >
                <X size={19} />
              </button>
            </div>
            <p className="mt-2 text-xs leading-5 text-muted">{intro}</p>
            <div className={`mt-3 grid ${importReview ? "grid-cols-4" : "grid-cols-3"} gap-1 rounded-xl bg-background p-1`}>
              <DrawerTab label="Tasks" active={activePanel === "tasks"} onClick={() => setActivePanel("tasks")} />
              <DrawerTab label="Chat" active={activePanel === "chat"} onClick={() => setActivePanel("chat")} />
              <DrawerTab label="Result" active={activePanel === "result"} onClick={() => setActivePanel("result")} />
              {importReview ? (
                <DrawerTab label="Import" active={activePanel === "import"} onClick={() => setActivePanel("import")} />
              ) : null}
            </div>
            <div className="mt-2 flex min-h-6 items-center gap-2 text-xs text-muted">
              {activeTask ? <Loader2 size={13} className="animate-spin text-accent" /> : null}
              <span>{status}</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {loggedOut ? (
              <div className="mb-3 rounded-2xl border border-warning/30 bg-[#f6ecd8]/60 p-3 text-sm">
                <p className="font-semibold text-foreground">Rex needs a profile or demo résumé.</p>
                <p className="mt-2 leading-6 text-muted">
                  Log in to use your CareersRX account, or try the SQLite demo without private account data.
                </p>
                <div className="mt-3 grid gap-2">
                  <Button href="/login" size="sm">
                    Log in
                  </Button>
                  <Button href="/register/seeker" variant="outline" size="sm">
                    Create account
                  </Button>
                  <Button href="/demo/live-resume" variant="outline" size="sm">
                    Try demo résumé
                  </Button>
                </div>
              </div>
            ) : null}

            {activePanel === "tasks" ? (
              <div className="space-y-3">
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Quick actions</p>
                  <div className="grid gap-1.5">
                    <RexTaskCard
                      title="Review summary"
                      body="Clarity and profile-safe edits."
                      loading={activeTask === "review_summary"}
                      disabled={activeTask === "review_summary"}
                      onClick={() => startTransition(() => void askRex("review_summary", { sectionId: "summary" }))}
                    />
                    <RexSectionTaskCard
                      sectionId={selectedSectionId}
                      onSectionChange={setSelectedSectionId}
                      loading={activeTask === "review_section"}
                      disabled={activeTask === "review_section"}
                      onClick={() =>
                        startTransition(() => void askRex("review_section", { sectionId: selectedSectionId }))
                      }
                    />
                    <RexTaskCard
                      title="Résumé hygiene"
                      body="Formatting, focus, and unsupported claims."
                      loading={activeTask === "resume_hygiene"}
                      disabled={activeTask === "resume_hygiene"}
                      onClick={() => startTransition(() => void askRex("resume_hygiene"))}
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-background p-2.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                    Target job title
                    <input
                      value={jobTitle}
                      onChange={(event) => setJobTitle(event.target.value)}
                      placeholder="e.g. RN Case Manager"
                      className="mt-1.5 w-full rounded-lg border border-border bg-surface px-2.5 py-2 text-sm normal-case tracking-normal text-foreground outline-none focus-visible:border-primary"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={activeTask === "suggest_skills_for_role"}
                    onClick={() =>
                      startTransition(() => void askRex("suggest_skills_for_role", { jobTitle }))
                    }
                    className="mt-2 flex w-full items-center justify-between rounded-lg border border-border px-2.5 py-2 text-left text-sm font-semibold text-foreground hover:bg-primary-light disabled:opacity-50"
                  >
                    <span>Suggest skills</span>
                    {activeTask === "suggest_skills_for_role" ? <Loader2 size={15} className="animate-spin" /> : null}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  <RexMiniButton
                    label="Sync help"
                    loading={activeTask === "profile_sync_help"}
                    disabled={activeTask === "profile_sync_help"}
                    onClick={() => startTransition(() => void askRex("profile_sync_help"))}
                  />
                  <RexMiniButton
                    label="Data handling"
                    loading={activeTask === "privacy_data"}
                    disabled={activeTask === "privacy_data"}
                    onClick={() => startTransition(() => void askRex("privacy_data"))}
                  />
                </div>

                <details className="rounded-xl border border-border bg-background p-2.5">
                  <summary className="flex cursor-pointer items-center justify-between text-sm font-semibold text-foreground">
                    Site navigation <ChevronDown size={15} />
                  </summary>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {[
                      ["profile", "Profile"],
                      ["live_resume", "Live résumé"],
                      ["applications", "Applications"],
                      ["saved_jobs", "Saved jobs"],
                      ["account", "Account"],
                      ["privacy", "Privacy"],
                      ["terms", "Terms"],
                      ["safety", "Safety"],
                      ["contact", "Contact"],
                    ].map(([target, label]) => (
                      <button
                        key={target}
                        type="button"
                        disabled={activeTask === "site_navigation"}
                        onClick={() =>
                          startTransition(() => void askRex("site_navigation", { navigationTarget: target }))
                        }
                        className="rounded-lg border border-border px-2 py-1 text-xs font-medium hover:bg-primary-light disabled:opacity-50"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </details>
              </div>
            ) : null}

            {activePanel === "chat" ? (
              <div className="space-y-3">
                <div className="rounded-xl border border-border bg-background p-2.5">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <MessageSquareText size={16} /> Ask Rex
                  </div>
                  <form onSubmit={submitChat} className="mt-2 space-y-2">
                    <textarea
                      value={message}
                      onChange={(event) => setMessage(event.target.value.slice(0, messageLimit))}
                      maxLength={messageLimit}
                      placeholder="Ask about your résumé, profile sync, or application readiness…"
                      className="min-h-28 w-full resize-none rounded-xl border border-border bg-surface p-3 text-sm leading-6 outline-none focus-visible:border-primary"
                    />
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs text-muted">
                        {message.length}/{messageLimit}
                      </span>
                      <button
                        type="submit"
                        disabled={activeTask === "custom_chat" || isPending || !message.trim()}
                        className="inline-flex items-center gap-2 rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-white hover:bg-accent-dark disabled:opacity-50"
                      >
                        {activeTask === "custom_chat" ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                        Send
                      </button>
                    </div>
                  </form>
                </div>

                {chatHistory.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">Recent chat</p>
                    {chatHistory.map((turn, index) => (
                      <div
                        key={`${turn.role}-${index}-${turn.content.slice(0, 12)}`}
                        className={`rounded-xl border p-2.5 text-sm leading-6 ${
                          turn.role === "user"
                            ? "border-accent/30 bg-accent-light/40"
                            : "border-border bg-background"
                        }`}
                      >
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                          {turn.role === "user" ? "You" : "Rex"}
                        </p>
                        <p className="mt-1 text-foreground">{turn.content}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-xl border border-dashed border-border p-3 text-sm leading-6 text-muted">
                    Chat stays scoped to your CareersRX profile and live résumé. Rex does not browse other users,
                    employer dashboards, or admin records.
                  </p>
                )}

                {response?.suggestionCards.length ? (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">Applyable suggestions</p>
                    {response.suggestionCards.map((card) => (
                      <ApplyCard
                        key={card.id}
                        {...card}
                        canApply={applyEnabled}
                        activeApplyId={activeApplyId}
                        liveResumeHref={liveResumeHref(pathname)}
                        onApply={applySuggestion}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            {activePanel === "result" ? (
              <ResultPanel
                response={response}
                activeTask={activeTask}
                applyEnabled={applyEnabled}
                activeApplyId={activeApplyId}
                liveResumeHref={liveResumeHref(pathname)}
                onApply={applySuggestion}
              />
            ) : null}

            {activePanel === "import" ? (
              <ImportReviewPanel
                importReview={importReview}
                importProgress={importProgress}
                importError={importError}
                importMessage={importMessage}
                importApplying={importApplying}
                importFollowup={importFollowup}
                importFollowupPending={importFollowupPending}
                onImportMessageChange={setImportMessage}
                onApply={applyImportReview}
                onFollowup={submitImportFollowup}
              />
            ) : null}
          </div>
        </aside>
      ) : null}
    </>
  );
}

function DrawerTab({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors ${
        active ? "bg-surface text-foreground shadow-sm" : "text-muted hover:bg-surface/70 hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

function ResumeImportLoadingOverlay({ progress }: { progress: ResumeImportProgressDetail }) {
  const intentLabel =
    progress.intent === "replace_current"
      ? "Preparing replacement draft"
      : progress.intent === "signup_onboarding"
        ? "Preparing sign-up prefill"
        : "Preparing new résumé version";

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-foreground/15 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl border border-border bg-surface p-6 text-center shadow-2xl">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10 text-accent">
          <Loader2 size={34} className="animate-spin" />
        </div>
        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-muted">{intentLabel}</p>
        <h3 className="mt-2 text-2xl font-semibold text-foreground">Rex is reading your résumé</h3>
        {progress.fileName ? <p className="mt-2 text-sm text-muted">{progress.fileName}</p> : null}
        <div className="mt-5 grid gap-2 text-left text-sm">
          {[
            "Parsing your résumé",
            "Putting your career on paper",
            "Filling out the live résumé sections",
            "Flibbergibeting the formatting goblins",
          ].map((step, index) => (
            <div key={step} className="flex items-center gap-3 rounded-xl border border-border bg-background px-3 py-2">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  index === 0 ? "animate-pulse bg-accent" : "bg-primary-light"
                }`}
              />
              <span className="text-foreground">{step}</span>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs leading-5 text-muted">
          Rex will show a placement review before anything changes. Your public profile stays untouched until you approve sync.
        </p>
      </div>
    </div>
  );
}

function ResultPanel({
  response,
  activeTask,
  applyEnabled,
  activeApplyId,
  liveResumeHref,
  onApply,
}: {
  response: RexResponse | null;
  activeTask: RexTask | null;
  applyEnabled: boolean;
  activeApplyId: string | null;
  liveResumeHref: string;
  onApply: (card: SuggestionCard) => void;
}) {
  if (activeTask) {
    return (
      <div className="rounded-xl border border-border bg-background p-3">
        <p className="text-sm font-semibold text-foreground">Rex is working…</p>
        <div className="mt-3 space-y-2">
          <div className="h-3 w-5/6 animate-pulse rounded-full bg-primary-light" />
          <div className="h-3 w-2/3 animate-pulse rounded-full bg-primary-light" />
        </div>
      </div>
    );
  }

  if (!response) {
    return (
      <div className="rounded-xl border border-dashed border-border p-3 text-sm leading-6 text-muted">
        Run a Rex task or ask a chat question. Results and applyable drafts will appear here.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-background p-3">
        <p className="text-sm leading-6 text-foreground">{response.answer}</p>
        {response.suggestions.length > 0 ? (
          <ul className="mt-2 list-disc space-y-1 pl-4 text-xs leading-5 text-muted">
            {response.suggestions.map((suggestion) => (
              <li key={suggestion}>{suggestion}</li>
            ))}
          </ul>
        ) : null}
        {response.link ? (
          <Button href={response.link.href} variant="outline" size="sm" className="mt-3 w-full justify-start">
            {response.link.label}
          </Button>
        ) : null}
      </div>

      {response.sectionPatch && response.sectionId ? (
        <ApplyCard
          id="section-patch"
          title="Rex draft"
          body="Apply this draft to the editor. Your public profile will not change until you save and approve sync."
          targetSectionId={response.sectionId}
          patch={response.sectionPatch}
          actionLabel="Apply Rex draft"
          canApply={applyEnabled}
          activeApplyId={activeApplyId}
          liveResumeHref={liveResumeHref}
          onApply={onApply}
        />
      ) : null}

      {response.suggestionCards.map((card) => (
        <ApplyCard
          key={card.id}
          {...card}
          canApply={applyEnabled}
          activeApplyId={activeApplyId}
          liveResumeHref={liveResumeHref}
          onApply={onApply}
        />
      ))}

      {response.safetyNotes.length > 0 ? (
        <p className="rounded-xl border border-border bg-surface p-2.5 text-[11px] leading-5 text-muted">
          {response.safetyNotes[0]}
        </p>
      ) : null}
    </div>
  );
}

function ImportReviewPanel({
  importReview,
  importProgress,
  importError,
  importMessage,
  importApplying,
  importFollowup,
  importFollowupPending,
  onImportMessageChange,
  onApply,
  onFollowup,
}: {
  importReview: ResumeImportReviewDetail | null;
  importProgress: ResumeImportProgressDetail | null;
  importError: string | null;
  importMessage: string;
  importApplying: boolean;
  importFollowup: string | null;
  importFollowupPending: boolean;
  onImportMessageChange: (message: string) => void;
  onApply: () => void;
  onFollowup: (event: FormEvent<HTMLFormElement>) => void;
}) {
  if (importProgress) {
    return (
      <div className="rounded-2xl border border-border bg-background p-4 text-sm leading-6 text-muted">
        <div className="flex items-center gap-3">
          <Loader2 size={18} className="animate-spin text-accent" />
          <div>
            <p className="font-semibold text-foreground">Rex is importing your résumé…</p>
            <p>{importProgress.fileName ? `Working on ${importProgress.fileName}` : "Extracting text and preparing placements."}</p>
          </div>
        </div>
      </div>
    );
  }

  if (importError) {
    return (
      <div className="rounded-2xl border border-warning/30 bg-[#f6ecd8]/70 p-4 text-sm leading-6">
        <p className="font-semibold text-foreground">Rex could not import that file.</p>
        <p className="mt-2 text-muted">{importError}</p>
        <p className="mt-3 text-xs text-muted">Try a DOCX or a selectable-text PDF. Scanned PDFs need OCR before upload.</p>
      </div>
    );
  }

  if (!importReview) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-4 text-sm leading-6 text-muted">
        Upload a PDF or DOCX résumé to let Rex prepare a review-first import.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-accent/25 bg-accent/5 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Rex import review</p>
        <h3 className="mt-2 text-lg font-semibold leading-tight text-foreground">{importReview.review.resumeTitle}</h3>
        <div className="mt-3 grid gap-2 text-xs text-muted">
          <div className="rounded-xl bg-surface px-3 py-2">
            <span className="font-semibold text-foreground">File:</span> {importReview.fileName}
          </div>
          <div className="rounded-xl bg-surface px-3 py-2">
            <span className="font-semibold text-foreground">Extracted:</span>{" "}
            {importReview.extractedCharCount.toLocaleString()} characters
          </div>
          <div className="rounded-xl bg-surface px-3 py-2">
            <span className="font-semibold text-foreground">Rex confidence:</span> {importReview.review.confidence}%
          </div>
        </div>
        <p className="mt-4 rounded-xl border border-border bg-surface p-3 text-sm leading-6 text-foreground">
          {importReview.review.answer}
        </p>
        <p className="mt-3 text-xs leading-5 text-muted">
          Nothing has changed yet. Review the placements, then choose whether to create/replace a draft.
        </p>
      </div>

      <div className="space-y-2.5">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Where Rex would place each part</p>
        {importReview.review.placements.map((placementItem) => (
          <div key={placementItem.sectionId} className="rounded-2xl border border-border bg-surface p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-foreground">{placementItem.title}</p>
              <span className="rounded-full bg-primary-light px-2 py-1 text-[11px] font-semibold text-primary">
                {placementItem.confidence}% match
              </span>
            </div>
            <p className="mt-2 line-clamp-6 whitespace-pre-line rounded-xl bg-background p-2.5 text-xs leading-5 text-muted">
              {placementItem.content || "No content placed here."}
            </p>
            {placementItem.notes.length > 0 ? (
              <p className="mt-2 rounded-lg border border-border bg-background px-2 py-1.5 text-[11px] leading-5 text-muted">
                {placementItem.notes[0]}
              </p>
            ) : null}
          </div>
        ))}
      </div>

      {importReview.review.ambiguousItems.length > 0 || importReview.review.unsupportedItems.length > 0 ? (
        <div className="rounded-2xl border border-warning/30 bg-[#f6ecd8]/70 p-3 text-xs leading-5 text-muted">
          <p className="mb-1 font-semibold uppercase tracking-wide text-foreground">Needs your eye</p>
          <ul className="list-disc space-y-1 pl-4">
            {[...importReview.review.ambiguousItems, ...importReview.review.unsupportedItems].slice(0, 3).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {importReview.review.suggestions.length > 0 ? (
        <div className="rounded-2xl border border-border bg-background p-3 text-xs leading-5 text-muted">
          <p className="mb-1 font-semibold uppercase tracking-wide text-foreground">Rex suggestions</p>
          <ul className="list-disc space-y-1 pl-4">
            {importReview.review.suggestions.slice(0, 4).map((suggestion) => (
              <li key={suggestion}>{suggestion}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <button
        type="button"
        disabled={importApplying}
        onClick={onApply}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-white hover:bg-accent-dark disabled:opacity-50"
      >
        {importApplying ? <Loader2 size={15} className="animate-spin" /> : null}
        {importReview.applyLabel}
      </button>

      <div className="rounded-xl border border-border bg-background p-2.5">
        <p className="text-sm font-semibold text-foreground">Ask about this import</p>
        <form onSubmit={onFollowup} className="mt-2 space-y-2">
          <textarea
            value={importMessage}
            onChange={(event) => onImportMessageChange(event.target.value.slice(0, importMessageLimit))}
            maxLength={importMessageLimit}
            placeholder="Ask Rex if something belongs in a different section…"
            className="min-h-20 w-full resize-none rounded-xl border border-border bg-surface p-3 text-sm leading-6 outline-none focus-visible:border-primary disabled:opacity-60"
          />
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-muted">
              {importMessage.length}/{importMessageLimit}
            </span>
            <button
              type="submit"
              disabled={importFollowupPending || !importMessage.trim()}
              className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-semibold hover:bg-primary-light disabled:opacity-50"
            >
              {importFollowupPending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
              Ask
            </button>
          </div>
        </form>
        {importFollowup ? (
          <p className="mt-2 rounded-lg bg-surface p-2 text-xs leading-5 text-muted">{importFollowup}</p>
        ) : null}
      </div>

      {importReview.review.safetyNotes.length > 0 ? (
        <p className="text-[11px] leading-5 text-muted">{importReview.review.safetyNotes[0]}</p>
      ) : null}
    </div>
  );
}

function RexTaskCard({
  title,
  body,
  loading,
  disabled,
  onClick,
}: {
  title: string;
  body: string;
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-xl border border-border bg-background p-2.5 text-left hover:border-primary hover:bg-primary-light/40 disabled:opacity-50"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {loading ? <Loader2 size={15} className="animate-spin text-primary" /> : <Sparkles size={15} className="text-muted" />}
      </div>
      <p className="mt-0.5 text-[11px] leading-4 text-muted">{body}</p>
    </button>
  );
}

function RexSectionTaskCard({
  sectionId,
  loading,
  disabled,
  onSectionChange,
  onClick,
}: {
  sectionId: SectionId;
  loading: boolean;
  disabled: boolean;
  onSectionChange: (sectionId: SectionId) => void;
  onClick: () => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-background p-2.5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-foreground">Improve section</p>
        {loading ? <Loader2 size={15} className="animate-spin text-primary" /> : null}
      </div>
      <div className="mt-2 grid grid-cols-[1fr_auto] gap-1.5">
        <select
          value={sectionId}
          onChange={(event) => onSectionChange(event.target.value as SectionId)}
          className="rounded-lg border border-border bg-surface px-2.5 py-2 text-sm text-foreground outline-none focus-visible:border-primary"
        >
          {sectionOptions.map((section) => (
            <option key={section.id} value={section.id}>
              {section.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={disabled}
          onClick={onClick}
          className="rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:bg-primary-light disabled:opacity-50"
        >
          Run
        </button>
      </div>
    </div>
  );
}

function RexMiniButton({
  label,
  loading,
  disabled,
  onClick,
}: {
  label: string;
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex items-center justify-between rounded-xl border border-border bg-background px-2.5 py-2 text-sm font-semibold hover:bg-primary-light disabled:opacity-50"
    >
      {label}
      {loading ? <Loader2 size={15} className="animate-spin" /> : null}
    </button>
  );
}

function ApplyCard({
  id,
  title,
  body,
  targetSectionId,
  patch,
  actionLabel,
  canApply,
  activeApplyId,
  liveResumeHref,
  onApply,
}: SuggestionCard & {
  canApply: boolean;
  activeApplyId: string | null;
  liveResumeHref: string;
  onApply: (card: SuggestionCard) => void;
}) {
  const applyable = Boolean(targetSectionId && patch);
  return (
    <div className="rounded-xl border border-border bg-surface p-2.5">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-xs leading-5 text-muted">{body}</p>
      {applyable ? (
        canApply ? (
          <button
            type="button"
            disabled={activeApplyId === id}
            onClick={() => onApply({ id, title, body, targetSectionId, patch, actionLabel })}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-white hover:bg-accent-dark disabled:opacity-50"
          >
            {activeApplyId === id ? <Loader2 size={15} className="animate-spin" /> : null}
            {actionLabel}
          </button>
        ) : (
          <Button href={liveResumeHref} variant="outline" size="sm" className="mt-3 w-full justify-start">
            Open live résumé to apply
          </Button>
        )
      ) : null}
    </div>
  );
}

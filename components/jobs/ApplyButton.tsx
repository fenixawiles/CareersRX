"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { X, Check, Upload, FileText, Heart } from "lucide-react";
import { Button } from "@/components/ui/Button";

type Props = {
  jobId: string;
  jobTitle: string;
  companyName: string;
  initiallySaved?: boolean;
  canApply?: boolean;
};

export function ApplyButton({ jobId, jobTitle, companyName, initiallySaved = false, canApply = false }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(initiallySaved);
  const [saving, setSaving] = useState(false);

  function loginHref() {
    return `/login?next=${encodeURIComponent(pathname)}`;
  }

  async function toggleSaved() {
    if (!canApply) {
      window.location.href = loginHref();
      return;
    }
    setSaving(true);
    const response = await fetch("/api/account/saved-jobs", {
      method: saved ? "DELETE" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId }),
    });
    setSaving(false);
    if (response.ok) setSaved((current) => !current);
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        <Button size="md" onClick={() => (canApply ? setOpen(true) : (window.location.href = loginHref()))}>
          Apply Now
        </Button>
        <Button
          variant={saved ? "secondary" : "outline"}
          size="md"
          onClick={toggleSaved}
          disabled={saving}
        >
          <Heart size={16} className={saved ? "fill-current" : ""} />
          {saved ? "Saved" : "Save Job"}
        </Button>
      </div>

      {open ? (
        <ApplyModal
          jobId={jobId}
          jobTitle={jobTitle}
          companyName={companyName}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

function ApplyModal({ jobId, jobTitle, companyName, onClose }: Props & { onClose: () => void }) {
  const [submitted, setSubmitted] = useState(false);
  const [status, setStatus] = useState("");
  const [coverLetter, setCoverLetter] = useState("");
  const [licenseConfirmed, setLicenseConfirmed] = useState(true);

  // Lock scroll + close on Escape (accessible modal behavior)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={`Apply to ${jobTitle}`}
    >
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-surface p-6 shadow-xl sm:rounded-2xl">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-xl hover:bg-primary-light"
        >
          <X size={20} />
        </button>

        {submitted ? (
          <div className="py-6 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#e3f0e9] text-success">
              <Check size={28} />
            </div>
            <h2 className="mt-4 text-xl font-bold text-foreground">Application submitted!</h2>
            <p className="mx-auto mt-2 max-w-sm text-muted">
              Your application for <span className="font-medium text-foreground">{jobTitle}</span>{" "}
              at {companyName} has been sent. You can track its status in your dashboard.
            </p>
            <div className="mt-6 flex justify-center gap-2">
              <Button href="/dashboard/seeker/applications" size="sm">
                View Applications
              </Button>
              <Button variant="outline" size="sm" onClick={onClose}>
                Keep Browsing
              </Button>
            </div>
          </div>
        ) : (
          <>
            <h2 className="text-xl font-bold text-foreground">Apply to {jobTitle}</h2>
            <p className="mt-1 text-sm text-muted">{companyName}</p>

            <form
              className="mt-5 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                setStatus("Submitting application…");
                fetch("/api/account/applications", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ jobId, coverLetter, licenseConfirmed }),
                }).then(async (response) => {
                  if (!response.ok) {
                    const data = (await response.json().catch(() => null)) as { error?: string } | null;
                    setStatus(data?.error ?? "Could not submit application.");
                    return;
                  }
                  setSubmitted(true);
                });
              }}
            >
              {/* Resume */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Resume</label>
                <div className="flex items-center justify-between rounded-xl border border-dashed border-border bg-background px-3 py-3 text-sm">
                  <span className="inline-flex items-center gap-2 text-muted">
                    <FileText size={16} /> Your current profile and live résumé snapshot
                  </span>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 font-medium text-primary"
                    onClick={() => {
                      window.location.href = "/dashboard/seeker/resume";
                    }}
                  >
                    <Upload size={15} /> Review
                  </button>
                </div>
              </div>

              {/* Screening question */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  Do you have a current license/certification for this role?
                </label>
                <div className="flex gap-2">
                  <label className="flex items-center gap-1.5 text-sm">
                    <input
                      type="radio"
                      name="license"
                      checked={licenseConfirmed}
                      onChange={() => setLicenseConfirmed(true)}
                    />{" "}
                    Yes
                  </label>
                  <label className="flex items-center gap-1.5 text-sm">
                    <input
                      type="radio"
                      name="license"
                      checked={!licenseConfirmed}
                      onChange={() => setLicenseConfirmed(false)}
                    />{" "}
                    No
                  </label>
                </div>
              </div>

              {/* Cover letter */}
              <div>
                <label
                  htmlFor="coverLetter"
                  className="mb-1.5 block text-sm font-medium text-foreground"
                >
                  Cover letter <span className="font-normal text-muted">(optional)</span>
                </label>
                <textarea
                  id="coverLetter"
                  rows={4}
                  value={coverLetter}
                  onChange={(event) => setCoverLetter(event.target.value)}
                  placeholder="Tell the employer why you're a great fit…"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 outline-none focus-visible:border-primary"
                />
              </div>

              <p className="min-h-5 text-sm text-muted">{status}</p>
              <Button type="submit" size="md" className="w-full">
                Submit Application
              </Button>
              <p className="text-center text-xs text-muted">
                By applying you agree to share your profile with {companyName}.
              </p>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

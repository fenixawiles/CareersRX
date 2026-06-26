import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, AlertTriangle, CheckCircle2, FileText } from "lucide-react";
import { DashboardHeading, Card } from "@/components/dashboard/DashboardUI";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PacketCompareButton } from "@/components/resume/PacketCompareButton";
import { getDemoSeeker } from "@/lib/demo";
import { getApplicationPacket } from "@/lib/resumes";

type PageProps = {
  params: Promise<{ id: string }>;
};

function jsonArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function itemLabel(item: unknown) {
  if (typeof item === "string") return item;
  if (typeof item === "object" && item && "label" in item && typeof item.label === "string") {
    return item.label;
  }
  return JSON.stringify(item);
}

function itemDetail(item: unknown) {
  if (typeof item === "object" && item && "reason" in item && typeof item.reason === "string") {
    return item.reason;
  }
  if (typeof item === "object" && item && "evidence" in item && typeof item.evidence === "string") {
    return item.evidence;
  }
  return null;
}

export default async function ApplicationPacketPage({ params }: PageProps) {
  const seeker = await getDemoSeeker();
  if (!seeker) notFound();

  const { id } = await params;
  const packet = await getApplicationPacket(seeker.id, id);
  if (!packet) notFound();

  const missingRequirements = jsonArray(packet.missingRequirements);
  const supportedMatches = jsonArray(packet.supportedMatches);

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/seeker/application-packets"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-primary"
      >
        <ArrowLeft size={16} /> Back to packets
      </Link>
      <DashboardHeading
        title={packet.title}
        description="Review job fit, selected résumé snapshot, cover letter, and missing requirements before applying."
        action={<PacketCompareButton packetId={packet.id} />}
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  {packet.job?.title ?? "Job not linked"}
                </h2>
                <p className="mt-1 text-sm text-muted">
                  {packet.job ? `${packet.job.companyName} · ${packet.job.city}, ${packet.job.state}` : "Attach a job to compare fit."}
                </p>
              </div>
              <Badge tone={packet.status === "READY" ? "success" : "neutral"}>{packet.status}</Badge>
            </div>
            <p className="mt-4 rounded-xl bg-primary-light/50 p-4 text-sm text-primary-dark">
              AI suggestions are drafts. Missing requirements are warnings, not automatic profile updates.
            </p>
          </Card>

          <Card>
            <h2 className="flex items-center gap-2 font-semibold text-foreground">
              <FileText size={18} className="text-primary" /> Export Preview
            </h2>
            <div className="mt-4 rounded-2xl border border-border bg-background p-6">
              <p className="text-sm font-semibold uppercase tracking-wide text-muted">Selected résumé</p>
              <h3 className="mt-2 text-xl font-bold text-foreground">
                {packet.resumeDocument?.title ?? "No résumé selected"}
              </h3>
              <p className="mt-1 text-sm text-muted">
                {packet.resumeVersion ? `Version ${packet.resumeVersion.versionNumber}` : "No version selected"}
              </p>
              <div className="mt-6 border-t border-border pt-4">
                <p className="text-sm font-semibold uppercase tracking-wide text-muted">Cover letter</p>
                <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">
                  {packet.fitSummary ??
                    "Run job-fit comparison to generate a packet summary and review missing requirements."}
                </p>
              </div>
            </div>
            <div className="mt-4">
              <Button type="button" variant="outline" size="sm" disabled>
                Export PDF coming soon
              </Button>
            </div>
          </Card>
        </div>

        <aside className="space-y-4">
          <Card>
            <h2 className="flex items-center gap-2 font-semibold text-foreground">
              <CheckCircle2 size={18} className="text-success" /> Supported Matches
            </h2>
            <div className="mt-3 space-y-3">
              {supportedMatches.length === 0 ? (
                <p className="text-sm text-muted">Run comparison to populate supported matches.</p>
              ) : (
                supportedMatches.map((item, index) => (
                  <div key={index} className="rounded-xl border border-border p-3 text-sm">
                    <p className="font-medium text-foreground">{itemLabel(item)}</p>
                    {itemDetail(item) ? <p className="mt-1 text-muted">{itemDetail(item)}</p> : null}
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card className={missingRequirements.length > 0 ? "border-warning/40" : ""}>
            <h2 className="flex items-center gap-2 font-semibold text-foreground">
              <AlertTriangle size={18} className="text-warning" /> Missing Requirements
            </h2>
            <div className="mt-3 space-y-3">
              {missingRequirements.length === 0 ? (
                <p className="text-sm text-muted">No missing requirements recorded.</p>
              ) : (
                missingRequirements.map((item, index) => (
                  <div key={index} className="rounded-xl border border-warning/30 bg-[#f6ecd8]/40 p-3 text-sm">
                    <p className="font-medium text-foreground">{itemLabel(item)}</p>
                    {itemDetail(item) ? <p className="mt-1 text-muted">{itemDetail(item)}</p> : null}
                  </div>
                ))
              )}
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}

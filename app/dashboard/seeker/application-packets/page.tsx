import Link from "next/link";
import { ClipboardList, FileText, Sparkles } from "lucide-react";
import { DashboardHeading, Card, EmptyState } from "@/components/dashboard/DashboardUI";
import { Badge } from "@/components/ui/Badge";
import { getDemoSeeker } from "@/lib/demo";
import { getApplicationPackets } from "@/lib/resumes";

function countMissing(value: unknown) {
  return Array.isArray(value) ? value.length : 0;
}

export default async function ApplicationPacketsPage() {
  const seeker = await getDemoSeeker();
  const packets = seeker ? await getApplicationPackets(seeker.id) : [];

  return (
    <div className="space-y-6">
      <DashboardHeading
        title="Application Packets"
        description="Job-specific résumé versions, cover letters, fit analysis, and missing requirement reviews."
      />

      <Card className="border-primary/20 bg-primary-light/40">
        <h2 className="flex items-center gap-2 font-semibold text-foreground">
          <Sparkles size={18} className="text-primary" /> Packet rule
        </h2>
        <p className="mt-2 text-sm text-muted">
          CareersRX can compare fit and draft packet materials, but it never invents skills,
          silently changes your profile, or submits applications for you.
        </p>
      </Card>

      {packets.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No application packets yet"
          description="Create a packet from a job to review résumé version, cover letter, fit, and missing requirements together."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {packets.map((packet) => (
            <Link
              key={packet.id}
              href={`/dashboard/seeker/application-packets/${packet.id}`}
              className="rounded-2xl border border-border bg-surface p-5 transition-shadow hover:shadow-md"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">{packet.title}</h2>
                  <p className="mt-1 text-sm text-muted">
                    {packet.job ? `${packet.job.companyName} · ${packet.job.city}, ${packet.job.state}` : "No job linked"}
                  </p>
                </div>
                <Badge tone={packet.status === "READY" ? "success" : "neutral"}>{packet.status}</Badge>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-muted">
                <span className="inline-flex items-center gap-1.5">
                  <FileText size={15} /> {packet.resumeDocument?.title ?? "No résumé"}
                </span>
                <span>{countMissing(packet.missingRequirements)} missing requirements</span>
                <span>Updated {new Date(packet.updatedAt).toLocaleDateString()}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, RotateCcw } from "lucide-react";
import { DashboardHeading, Card } from "@/components/dashboard/DashboardUI";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { getDemoSeeker } from "@/lib/demo";
import { getResumeVersions } from "@/lib/resumes";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ResumeVersionsPage({ params }: PageProps) {
  const seeker = await getDemoSeeker();
  if (!seeker) notFound();

  const { id } = await params;
  const result = await getResumeVersions(seeker.id, id);
  if (!result) notFound();

  return (
    <div className="space-y-6">
      <Link
        href={`/dashboard/seeker/resume/${result.document.id}`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-primary"
      >
        <ArrowLeft size={16} /> Back to workspace
      </Link>
      <DashboardHeading
        title="Version Timeline"
        description={`${result.document.title} snapshots, AI drafts, and restore-ready checkpoints.`}
      />

      <Card>
        <div className="space-y-4">
          {result.versions.map((version) => (
            <div key={version.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border p-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold text-foreground">Version {version.versionNumber}</h2>
                  {result.document.activeVersion?.id === version.id ? <Badge tone="success">Active</Badge> : null}
                  {version.aiGenerated ? <Badge tone="primary">AI draft</Badge> : null}
                </div>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
                  <Clock size={15} /> {new Date(version.createdAt).toLocaleString()} · {version.sourceType}
                </p>
              </div>
              <Button type="button" size="sm" variant="outline" disabled>
                <RotateCcw size={15} /> Restore coming soon
              </Button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

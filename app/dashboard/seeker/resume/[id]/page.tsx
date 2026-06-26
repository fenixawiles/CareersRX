import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, History, Sparkles } from "lucide-react";
import { DashboardHeading } from "@/components/dashboard/DashboardUI";
import { Button } from "@/components/ui/Button";
import { ResumeWorkspace } from "@/components/resume/ResumeWorkspace";
import { getDemoSeeker } from "@/lib/demo";
import { getResumeWorkspace } from "@/lib/resumes";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ResumeWorkspacePage({ params }: PageProps) {
  const seeker = await getDemoSeeker();
  if (!seeker) notFound();

  const { id } = await params;
  const workspace = await getResumeWorkspace(seeker.id, id);
  if (!workspace) notFound();

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/seeker/resume"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-primary"
      >
        <ArrowLeft size={16} /> Back to résumé library
      </Link>
      <DashboardHeading
        title="CareersRX Live Résumé Workspace"
        description="Three-column desktop workspace for editing, reviewing sync proposals, and creating application-ready variants."
        action={
          <div className="flex flex-wrap gap-2">
            <Button href="/dashboard/seeker/resume#rex-assistant" size="sm" variant="secondary">
              <Sparkles size={16} /> Ask Rex
            </Button>
            <Button href={`/dashboard/seeker/resume/${workspace.document.id}/versions`} size="sm" variant="outline">
              <History size={16} /> Version Timeline
            </Button>
          </div>
        }
      />
      <div className="rounded-2xl border border-primary/30 bg-primary-light/40 p-4 text-sm text-primary-dark">
        <strong>Looking for Rex?</strong> Rex is available in the SQLite account live résumé flow. Open Ask Rex to
        review your current profile and live résumé, then apply drafts to the editor before choosing profile sync.
      </div>
      <ResumeWorkspace workspace={workspace} />
    </div>
  );
}

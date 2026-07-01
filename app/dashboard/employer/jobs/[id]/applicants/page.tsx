import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Users, FileText, Mail } from "lucide-react";
import { getCurrentLocalUser } from "@/lib/local-auth";
import { getCompanyForUser, getJobForCompany, listApplicationsForCompany } from "@/lib/local-platform";
import { DashboardHeading, Card, EmptyState } from "@/components/dashboard/DashboardUI";
import { ApplicationStatusBadge } from "@/components/jobs/StatusBadge";
import { Button } from "@/components/ui/Button";
import { postedAgo } from "@/lib/utils";

type Params = Promise<{ id: string }>;

export default async function ApplicantsPage({ params }: { params: Params }) {
  const { id } = await params;
  const user = await getCurrentLocalUser();
  if (!user || user.role !== "EMPLOYER") redirect("/login?next=/dashboard/employer/jobs");
  const company = getCompanyForUser(user.id);
  if (!company) redirect("/register/employer");
  const job = getJobForCompany(id, company.id);
  if (!job) notFound();
  const applications = listApplicationsForCompany(company.id, job.id);

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/employer/jobs"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-primary"
      >
        <ArrowLeft size={16} /> Back to jobs
      </Link>

      <DashboardHeading
        title={job.title}
        description={`${applications.length} ${applications.length === 1 ? "applicant" : "applicants"}`}
      />

      {applications.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No applicants yet"
          description="When candidates apply, they'll appear here for you to review."
        />
      ) : (
        <div className="space-y-3">
          {applications.map((app) => (
            <Card key={app.id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="font-semibold text-foreground">
                    {app.seekerName}
                  </h3>
                  <p className="text-sm text-muted">
                    {app.seekerLocation || "Location not provided"} · Applied{" "}
                    {postedAgo(app.createdAt).replace("Posted ", "")}
                  </p>
                  {Array.isArray(app.profileSnapshot.credentials) && app.profileSnapshot.credentials.length > 0 ? (
                    <p className="mt-1 text-sm text-muted">
                      Credentials: {(app.profileSnapshot.credentials as string[]).join(", ")}
                    </p>
                  ) : null}
                  {app.seekerHeadline ? <p className="mt-1 text-sm text-muted">{app.seekerHeadline}</p> : null}
                  {app.coverLetter ? (
                    <p className="mt-2 line-clamp-2 max-w-xl text-sm text-foreground">
                      “{app.coverLetter}”
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <ApplicationStatusBadge status={app.status} />
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      <FileText size={14} /> Resume
                    </Button>
                    <Button variant="ghost" size="sm">
                      <Mail size={14} /> Message
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

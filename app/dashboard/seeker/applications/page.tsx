import Link from "next/link";
import { redirect } from "next/navigation";
import { FileText, MapPin } from "lucide-react";
import { getCurrentLocalUser } from "@/lib/local-auth";
import { listApplicationsForSeeker } from "@/lib/local-platform";
import { DashboardHeading, Card, EmptyState } from "@/components/dashboard/DashboardUI";
import { ApplicationStatusBadge } from "@/components/jobs/StatusBadge";
import { Button } from "@/components/ui/Button";
import { postedAgo } from "@/lib/utils";

export default async function SeekerApplications() {
  const user = await getCurrentLocalUser();
  if (!user || user.role !== "SEEKER") redirect("/login?next=/dashboard/seeker/applications");
  const applications = listApplicationsForSeeker(user.id);

  return (
    <div className="space-y-6">
      <DashboardHeading
        title="Your applications"
        description={`${applications.length} ${applications.length === 1 ? "application" : "applications"}`}
      />

      {applications.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No applications yet"
          description="When you apply to jobs, you'll be able to track them here."
          action={
            <Button href="/jobs" size="sm">
              Browse Jobs
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {applications.map((app) => (
            <Card key={app.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    href={`/jobs/${app.job.slug}`}
                    className="text-lg font-semibold text-foreground hover:text-primary"
                  >
                    {app.job.title}
                  </Link>
                  <p className="mt-0.5 text-sm text-muted">{app.job.company.name}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin size={14} /> {app.job.city}, {app.job.state}
                    </span>
                    <span>Applied {postedAgo(app.createdAt).replace("Posted ", "")}</span>
                  </div>
                </div>
                <ApplicationStatusBadge status={app.status} />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

import Link from "next/link";
import { Briefcase, Users, Eye, ArrowRight, BadgeCheck } from "lucide-react";
import { redirect } from "next/navigation";
import { getCurrentLocalUser } from "@/lib/local-auth";
import { getCompanyForUser, listApplicationsForCompany, listJobsForCompany } from "@/lib/local-platform";
import { DashboardHeading, StatCard, Card } from "@/components/dashboard/DashboardUI";
import { JobStatusBadge } from "@/components/jobs/StatusBadge";
import { Button } from "@/components/ui/Button";

export default async function EmployerOverview() {
  const user = await getCurrentLocalUser();
  if (!user || user.role !== "EMPLOYER") redirect("/login?next=/dashboard/employer");
  const company = getCompanyForUser(user.id);
  if (!company) redirect("/register/employer");
  const jobs = listJobsForCompany(company.id);
  const applications = listApplicationsForCompany(company.id);
  const activeJobs = jobs.filter((job) => job.status === "ACTIVE").length;
  const recentJobs = jobs.slice(0, 5);

  return (
    <div className="space-y-6">
      <DashboardHeading
        title={company.name}
        description="Your hiring dashboard"
        action={
          <Button href="/dashboard/employer/jobs/new" size="sm">
            Post a Job
          </Button>
        }
      />

      <div className="flex items-center gap-2 text-sm text-success">
        <BadgeCheck size={16} /> Employer workspace active
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Active jobs" value={activeJobs} icon={Briefcase} />
        <StatCard label="Total applicants" value={applications.length} icon={Users} />
        <StatCard label="Saved postings" value={jobs.length} icon={Eye} />
      </div>

      <Card>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-foreground">Your job postings</h2>
          <Link
            href="/dashboard/employer/jobs"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            View all <ArrowRight size={14} />
          </Link>
        </div>
        <ul className="mt-4 divide-y divide-border">
          {recentJobs.length === 0 ? (
            <li className="py-6 text-sm text-muted">
              No jobs yet. Create your first posting, then publish it when it is ready.
            </li>
          ) : recentJobs.map((job) => (
            <li key={job.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <Link
                  href={`/dashboard/employer/jobs/${job.id}/applicants`}
                  className="truncate font-medium text-foreground hover:text-primary"
                >
                  {job.title}
                </Link>
                <p className="text-sm text-muted">
                  {applications.filter((application) => application.jobId === job.id).length} applicants
                </p>
              </div>
              <JobStatusBadge status={job.status} />
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

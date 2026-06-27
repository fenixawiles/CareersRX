import Link from "next/link";
import { connection } from "next/server";
import { Briefcase, Users, MapPin } from "lucide-react";
import { getDemoCompany } from "@/lib/demo";
import { prisma } from "@/lib/prisma";
import { DashboardHeading, Card, EmptyState } from "@/components/dashboard/DashboardUI";
import { JobStatusBadge } from "@/components/jobs/StatusBadge";
import { Button } from "@/components/ui/Button";
import { JOB_TYPE_LABELS } from "@/lib/constants";
import { formatSalaryRange } from "@/lib/utils";

export default async function EmployerJobs() {
  await connection();

  const company = await getDemoCompany();
  if (!company) return null;

  const jobs = await prisma.job.findMany({
    where: { companyId: company.id },
    orderBy: { publishedAt: "desc" },
    include: { _count: { select: { applications: true } } },
  });

  return (
    <div className="space-y-6">
      <DashboardHeading
        title="Job postings"
        description={`${jobs.length} ${jobs.length === 1 ? "posting" : "postings"}`}
        action={
          <Button href="/dashboard/employer/jobs/new" size="sm">
            Post a Job
          </Button>
        }
      />

      {jobs.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="No jobs posted yet"
          description="Post your first job to start receiving applicants."
          action={
            <Button href="/dashboard/employer/jobs/new" size="sm">
              Post a Job
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => {
            const salary = formatSalaryRange(job);
            return (
              <Card key={job.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/dashboard/employer/jobs/${job.id}/applicants`}
                        className="text-lg font-semibold text-foreground hover:text-primary"
                      >
                        {job.title}
                      </Link>
                      <JobStatusBadge status={job.status} />
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin size={14} /> {job.city}, {job.state}
                      </span>
                      <span>{JOB_TYPE_LABELS[job.jobType]}</span>
                      {salary ? <span className="text-success">{salary}</span> : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
                      <Users size={15} /> {job._count.applications}
                    </span>
                    <Button
                      href={`/dashboard/employer/jobs/${job.id}/applicants`}
                      variant="outline"
                      size="sm"
                    >
                      View Applicants
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

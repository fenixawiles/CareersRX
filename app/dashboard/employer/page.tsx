import Link from "next/link";
import { connection } from "next/server";
import { Briefcase, Users, Eye, ArrowRight, BadgeCheck } from "lucide-react";
import { getDemoCompany } from "@/lib/demo";
import { prisma } from "@/lib/prisma";
import { DashboardHeading, StatCard, Card } from "@/components/dashboard/DashboardUI";
import { DemoBanner } from "@/components/dashboard/DemoBanner";
import { JobStatusBadge } from "@/components/jobs/StatusBadge";
import { Button } from "@/components/ui/Button";

export default async function EmployerOverview() {
  await connection();

  const company = await getDemoCompany();
  if (!company) return null;

  const [activeJobs, totalApplicants, recentJobs] = await Promise.all([
    prisma.job.count({ where: { companyId: company.id, status: "ACTIVE" } }),
    prisma.application.count({ where: { job: { companyId: company.id } } }),
    prisma.job.findMany({
      where: { companyId: company.id },
      orderBy: { publishedAt: "desc" },
      take: 5,
      include: { _count: { select: { applications: true } } },
    }),
  ]);

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

      <DemoBanner role="employer" />

      <div className="flex items-center gap-2 text-sm text-success">
        <BadgeCheck size={16} /> Verified employer
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Active jobs" value={activeJobs} icon={Briefcase} />
        <StatCard label="Total applicants" value={totalApplicants} icon={Users} />
        <StatCard label="Facilities" value={company.facilities.length} icon={Eye} />
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
          {recentJobs.map((job) => (
            <li key={job.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <Link
                  href={`/dashboard/employer/jobs/${job.id}/applicants`}
                  className="truncate font-medium text-foreground hover:text-primary"
                >
                  {job.title}
                </Link>
                <p className="text-sm text-muted">
                  {job._count.applications}{" "}
                  {job._count.applications === 1 ? "applicant" : "applicants"}
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

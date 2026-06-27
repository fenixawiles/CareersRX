import Link from "next/link";
import { connection } from "next/server";
import { Building2, Briefcase, Flag, Users, ArrowRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { DashboardHeading, StatCard, Card } from "@/components/dashboard/DashboardUI";
import { DemoBanner } from "@/components/dashboard/DemoBanner";
import { CompanyStatusBadge } from "@/components/jobs/StatusBadge";

export default async function AdminOverview() {
  await connection();

  const [pendingEmployers, pendingJobs, openReports, totalUsers, recentCompanies] =
    await Promise.all([
      prisma.company.count({ where: { verificationStatus: "PENDING" } }),
      prisma.job.count({ where: { status: "PENDING_REVIEW" } }),
      prisma.jobReport.count({ where: { resolved: false } }),
      prisma.user.count(),
      prisma.company.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { _count: { select: { jobs: true } } },
      }),
    ]);

  return (
    <div className="space-y-6">
      <DashboardHeading title="Admin dashboard" description="Platform health at a glance." />

      <DemoBanner role="admin" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Pending employers" value={pendingEmployers} icon={Building2} />
        <StatCard label="Jobs to review" value={pendingJobs} icon={Briefcase} />
        <StatCard label="Open reports" value={openReports} icon={Flag} />
        <StatCard label="Total users" value={totalUsers} icon={Users} />
      </div>

      <Card>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-foreground">Recent communities</h2>
          <Link
            href="/admin/employers"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            View all <ArrowRight size={14} />
          </Link>
        </div>
        <ul className="mt-4 divide-y divide-border">
          {recentCompanies.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 py-3">
              <div>
                <Link
                  href={`/admin/employers/${c.id}`}
                  className="font-medium text-foreground hover:text-primary"
                >
                  {c.name}
                </Link>
                <p className="text-sm text-muted">{c._count.jobs} jobs</p>
              </div>
              <CompanyStatusBadge status={c.verificationStatus} />
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

import Link from "next/link";
import { connection } from "next/server";
import { MapPin } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { DashboardHeading, Card } from "@/components/dashboard/DashboardUI";
import { JobStatusBadge } from "@/components/jobs/StatusBadge";
import { Button } from "@/components/ui/Button";

export default async function AdminJobs() {
  await connection();

  const jobs = await prisma.job.findMany({
    orderBy: { publishedAt: "desc" },
    take: 40,
    include: { company: { select: { name: true } } },
  });

  return (
    <div className="space-y-6">
      <DashboardHeading title="Jobs" description="Review and moderate all postings." />

      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-background text-left text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Title</th>
              <th className="hidden px-4 py-3 font-medium sm:table-cell">Community</th>
              <th className="hidden px-4 py-3 font-medium md:table-cell">Location</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {jobs.map((job) => (
              <tr key={job.id} className="hover:bg-background">
                <td className="px-4 py-3">
                  <Link href={`/jobs/${job.slug}`} className="font-medium text-foreground hover:text-primary">
                    {job.title}
                  </Link>
                </td>
                <td className="hidden px-4 py-3 text-muted sm:table-cell">{job.company.name}</td>
                <td className="hidden px-4 py-3 text-muted md:table-cell">
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin size={13} /> {job.city}, {job.state}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <JobStatusBadge status={job.status} />
                </td>
                <td className="px-4 py-3 text-right">
                  <Button href={`/jobs/${job.slug}`} variant="ghost" size="sm">
                    View
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

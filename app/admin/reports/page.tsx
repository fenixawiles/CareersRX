import { Flag } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { DashboardHeading, EmptyState } from "@/components/dashboard/DashboardUI";

export default async function AdminReports() {
  const reports = await prisma.jobReport.findMany({
    where: { resolved: false },
    orderBy: { createdAt: "desc" },
    include: { job: { select: { title: true, slug: true } } },
  });

  return (
    <div className="space-y-6">
      <DashboardHeading title="Reported jobs" description="Review flagged postings." />

      {reports.length === 0 ? (
        <EmptyState
          icon={Flag}
          title="No open reports"
          description="When users report a job, it will show up here for review."
        />
      ) : (
        <div className="space-y-3">
          {/* Rendered when reports exist */}
        </div>
      )}
    </div>
  );
}

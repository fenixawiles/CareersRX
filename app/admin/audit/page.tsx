import { ScrollText } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { DashboardHeading, EmptyState } from "@/components/dashboard/DashboardUI";

export default async function AdminAudit() {
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div className="space-y-6">
      <DashboardHeading title="Audit log" description="A record of sensitive admin actions." />

      {logs.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="No audit entries yet"
          description="Admin actions like approvals, rejections, and suspensions are logged here."
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-surface">
          {/* Rendered when logs exist */}
        </div>
      )}
    </div>
  );
}

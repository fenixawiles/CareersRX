import { connection } from "next/server";
import { Flag } from "lucide-react";
import { DashboardHeading, EmptyState } from "@/components/dashboard/DashboardUI";
import { requireAdmin } from "@/lib/auth/policy";

export default async function AdminReports() {
  await requireAdmin();
  await connection();

  // Job reporting has no backing store yet; this page is an explicit placeholder until it does.
  return (
    <div className="space-y-6">
      <DashboardHeading title="Reported jobs" description="Review flagged postings." />
      <EmptyState
        icon={Flag}
        title="Job reporting is not yet available"
        description="When report intake ships, flagged postings will appear here for review."
      />
    </div>
  );
}

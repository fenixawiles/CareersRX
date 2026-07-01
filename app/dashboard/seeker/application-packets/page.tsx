import { ClipboardList, Sparkles } from "lucide-react";
import { DashboardHeading, Card, EmptyState } from "@/components/dashboard/DashboardUI";

export default async function ApplicationPacketsPage() {
  return (
    <div className="space-y-6">
      <DashboardHeading
        title="Application Packets"
        description="Job-specific résumé versions, cover letters, fit analysis, and missing requirement reviews."
      />

      <Card className="border-primary/20 bg-primary-light/40">
        <h2 className="flex items-center gap-2 font-semibold text-foreground">
          <Sparkles size={18} className="text-primary" /> Packet rule
        </h2>
        <p className="mt-2 text-sm text-muted">
          CareersRX can compare fit and draft packet materials, but it never invents skills,
          silently changes your profile, or submits applications for you.
        </p>
      </Card>

      <EmptyState
        icon={ClipboardList}
        title="No application packets yet"
        description="Application packets will build on the live résumé workflow. For now, applying to a job sends your current profile and live résumé snapshot."
      />
    </div>
  );
}

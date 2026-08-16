import { connection } from "next/server";
import { Mail } from "lucide-react";
import { DashboardHeading, EmptyState } from "@/components/dashboard/DashboardUI";
import { requireAdmin } from "@/lib/auth/policy";

export default async function AdminContact() {
  await requireAdmin();
  await connection();

  // Contact-form intake has no backing store yet; this page is an explicit placeholder until it does.
  return (
    <div className="space-y-6">
      <DashboardHeading title="Contact submissions" description="Messages from the contact form." />
      <EmptyState
        icon={Mail}
        title="Contact intake is not yet available"
        description="When the contact form is wired to storage, submissions will appear here."
      />
    </div>
  );
}

import { connection } from "next/server";
import { Mail } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { DashboardHeading, EmptyState } from "@/components/dashboard/DashboardUI";

export default async function AdminContact() {
  await connection();

  const submissions = await prisma.contactSubmission.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <DashboardHeading title="Contact submissions" description="Messages from the contact form." />

      {submissions.length === 0 ? (
        <EmptyState
          icon={Mail}
          title="No messages yet"
          description="Submissions from the contact form will appear here."
        />
      ) : (
        <div className="space-y-3">{/* Rendered when submissions exist */}</div>
      )}
    </div>
  );
}

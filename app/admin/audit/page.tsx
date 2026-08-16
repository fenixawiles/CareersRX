import { connection } from "next/server";
import { ScrollText } from "lucide-react";
import { adminAuditEvents } from "@/lib/admin/queries";
import { DashboardHeading, EmptyState } from "@/components/dashboard/DashboardUI";
import { requireAdmin } from "@/lib/auth/policy";

export default async function AdminAudit() {
  await requireAdmin();
  await connection();

  const events = await adminAuditEvents(50);

  return (
    <div className="space-y-6">
      <DashboardHeading title="Audit log" description="A record of consequential platform events." />

      {events.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="No audit entries yet"
          description="Consequential events like publications, evaluations, and decisions are logged here."
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-background text-left text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Event</th>
                <th className="hidden px-4 py-3 font-medium sm:table-cell">Entity</th>
                <th className="px-4 py-3 font-medium">Actor</th>
                <th className="hidden px-4 py-3 font-medium md:table-cell">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {events.map((event) => (
                <tr key={event.id} className="hover:bg-background">
                  <td className="px-4 py-3 font-medium text-foreground">{event.eventType}</td>
                  <td className="hidden px-4 py-3 text-muted sm:table-cell">{event.entityType}</td>
                  <td className="px-4 py-3 text-muted">{event.actorKind}</td>
                  <td className="hidden px-4 py-3 text-muted md:table-cell">
                    {new Date(event.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

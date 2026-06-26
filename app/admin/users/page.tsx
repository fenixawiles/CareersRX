import { prisma } from "@/lib/prisma";
import { DashboardHeading } from "@/components/dashboard/DashboardUI";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

export default async function AdminUsers() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      seekerProfile: { select: { id: true } },
      companyUsers: { select: { id: true } },
    },
  });

  function roleLabel(u: (typeof users)[number]) {
    if (u.isAdmin) return { label: "Admin", tone: "primary" as const };
    if (u.companyUsers.length > 0) return { label: "Employer", tone: "accent" as const };
    if (u.seekerProfile) return { label: "Seeker", tone: "neutral" as const };
    return { label: "User", tone: "neutral" as const };
  }

  return (
    <div className="space-y-6">
      <DashboardHeading title="Users" description={`${users.length} accounts`} />

      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-background text-left text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="hidden px-4 py-3 font-medium sm:table-cell">Email</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.map((u) => {
              const role = roleLabel(u);
              return (
                <tr key={u.id} className="hover:bg-background">
                  <td className="px-4 py-3 font-medium text-foreground">{u.name ?? "—"}</td>
                  <td className="hidden px-4 py-3 text-muted sm:table-cell">{u.email}</td>
                  <td className="px-4 py-3">
                    <Badge tone={role.tone}>{role.label}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={u.status === "ACTIVE" ? "success" : "danger"}>
                      {u.status === "ACTIVE" ? "Active" : "Suspended"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm">
                      {u.status === "ACTIVE" ? "Suspend" : "Restore"}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

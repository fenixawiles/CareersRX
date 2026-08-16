import { connection } from "next/server";
import { adminUsers } from "@/lib/admin/queries";
import { DashboardHeading } from "@/components/dashboard/DashboardUI";
import { Badge } from "@/components/ui/Badge";
import { requireAdmin } from "@/lib/auth/policy";

export default async function AdminUsers() {
  await requireAdmin();
  await connection();

  const users = await adminUsers();

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
              <th className="px-4 py-3 font-medium">Verified</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-background">
                <td className="px-4 py-3 font-medium text-foreground">{user.fullName || "—"}</td>
                <td className="hidden px-4 py-3 text-muted sm:table-cell">{user.email}</td>
                <td className="px-4 py-3">
                  <Badge tone={user.isAdmin ? "primary" : user.role === "EMPLOYER" ? "accent" : "neutral"}>
                    {user.isAdmin ? "Admin" : user.role === "EMPLOYER" ? "Employer" : "Seeker"}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge tone={user.emailVerified ? "success" : "neutral"}>
                    {user.emailVerified ? "Verified" : "Unverified"}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

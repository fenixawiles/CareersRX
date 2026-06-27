import { connection } from "next/server";
import { getDemoCompany } from "@/lib/demo";
import { prisma } from "@/lib/prisma";
import { DashboardHeading, Card } from "@/components/dashboard/DashboardUI";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

const ROLE_LABELS: Record<string, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MEMBER: "Member",
};

export default async function TeamPage() {
  await connection();

  const company = await getDemoCompany();
  if (!company) return null;

  const members = await prisma.companyUser.findMany({
    where: { companyId: company.id, revokedAt: null },
    include: { user: true },
    orderBy: { joinedAt: "asc" },
  });

  return (
    <div className="space-y-6">
      <DashboardHeading
        title="Team"
        description="Manage who can post jobs and review applicants."
        action={
          <Button size="sm">Invite Member</Button>
        }
      />

      <div className="space-y-3">
        {members.map((m) => (
          <Card key={m.id}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-light font-semibold text-primary">
                  {(m.user.name ?? m.user.email)[0]?.toUpperCase()}
                </div>
                <div>
                  <p className="font-medium text-foreground">{m.user.name ?? m.user.email}</p>
                  <p className="text-sm text-muted">{m.user.email}</p>
                </div>
              </div>
              <Badge tone={m.role === "OWNER" ? "primary" : "neutral"}>
                {ROLE_LABELS[m.role]}
              </Badge>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

import Link from "next/link";
import { connection } from "next/server";
import { Globe, Phone, Mail } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { DashboardHeading, Card } from "@/components/dashboard/DashboardUI";
import { CompanyStatusBadge } from "@/components/jobs/StatusBadge";
import { Button } from "@/components/ui/Button";

export default async function AdminEmployers() {
  await connection();

  const companies = await prisma.company.findMany({
    orderBy: [{ verificationStatus: "asc" }, { createdAt: "desc" }],
    include: { _count: { select: { jobs: true, users: true } } },
  });

  return (
    <div className="space-y-6">
      <DashboardHeading
        title="Employers"
        description={`${companies.length} communities`}
      />

      <div className="space-y-3">
        {companies.map((c) => (
          <Card key={c.id}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/admin/employers/${c.id}`}
                    className="text-lg font-semibold text-foreground hover:text-primary"
                  >
                    {c.name}
                  </Link>
                  <CompanyStatusBadge status={c.verificationStatus} />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
                  {c.website ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Globe size={14} /> {c.website.replace(/^https?:\/\//, "")}
                    </span>
                  ) : null}
                  <span className="inline-flex items-center gap-1.5">
                    <Mail size={14} /> {c.contactEmail}
                  </span>
                  {c.phone ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Phone size={14} /> {c.phone}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-muted">
                  {c._count.jobs} jobs · {c._count.users} team members
                </p>
              </div>
              {c.verificationStatus === "PENDING" ? (
                <div className="flex gap-2">
                  <Button variant="primary" size="sm">
                    Approve
                  </Button>
                  <Button variant="outline" size="sm">
                    Reject
                  </Button>
                </div>
              ) : (
                <Button href={`/admin/employers/${c.id}`} variant="outline" size="sm">
                  View
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

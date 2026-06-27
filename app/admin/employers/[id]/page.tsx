import Link from "next/link";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin, Check, X } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { DashboardHeading, Card } from "@/components/dashboard/DashboardUI";
import { CompanyStatusBadge } from "@/components/jobs/StatusBadge";
import { Button } from "@/components/ui/Button";
import { FACILITY_TYPE_LABELS } from "@/lib/constants";

type Params = Promise<{ id: string }>;

const CHECKLIST = [
  "Real, identifiable community",
  "Valid contact information",
  "Facility address verified",
  "No scam indicators",
];

export default async function AdminEmployerDetail({ params }: { params: Params }) {
  await connection();

  const { id } = await params;
  const company = await prisma.company.findUnique({
    where: { id },
    include: {
      facilities: true,
      users: { include: { user: true }, where: { revokedAt: null } },
      _count: { select: { jobs: true } },
    },
  });

  if (!company) notFound();

  return (
    <div className="space-y-6">
      <Link
        href="/admin/employers"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-primary"
      >
        <ArrowLeft size={16} /> Back to employers
      </Link>

      <DashboardHeading
        title={company.name}
        action={<CompanyStatusBadge status={company.verificationStatus} />}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-6">
          <Card>
            <h2 className="font-semibold text-foreground">Details</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <Row label="Website" value={company.website ?? "—"} />
              <Row label="Email" value={company.contactEmail} />
              <Row label="Phone" value={company.phone ?? "—"} />
              <Row label="Jobs posted" value={String(company._count.jobs)} />
            </dl>
            {company.description ? (
              <p className="mt-3 text-sm text-muted">{company.description}</p>
            ) : null}
          </Card>

          <Card>
            <h2 className="font-semibold text-foreground">Facilities</h2>
            <div className="mt-3 space-y-2">
              {company.facilities.map((f) => (
                <div key={f.id} className="flex items-start justify-between gap-3 text-sm">
                  <span className="inline-flex items-center gap-1.5 text-muted">
                    <MapPin size={14} /> {f.name} — {f.city}, {f.state}
                  </span>
                  <span className="text-xs text-muted">{FACILITY_TYPE_LABELS[f.type]}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h2 className="font-semibold text-foreground">Team</h2>
            <ul className="mt-3 space-y-1 text-sm text-muted">
              {company.users.map((u) => (
                <li key={u.id}>
                  {u.user.name ?? u.user.email} — {u.role}
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <aside className="space-y-4">
          <Card>
            <h2 className="font-semibold text-foreground">Verification checklist</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {CHECKLIST.map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <input type="checkbox" defaultChecked={company.verificationStatus === "APPROVED"} />
                  {item}
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-col gap-2">
              <Button size="sm">
                <Check size={15} /> Approve
              </Button>
              <Button variant="outline" size="sm">
                <X size={15} /> Reject
              </Button>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium text-foreground">{value}</dd>
    </div>
  );
}

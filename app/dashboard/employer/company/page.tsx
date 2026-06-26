import { Building2, MapPin } from "lucide-react";
import { getDemoCompany } from "@/lib/demo";
import { DashboardHeading, Card } from "@/components/dashboard/DashboardUI";
import { CompanyStatusBadge } from "@/components/jobs/StatusBadge";
import { Button } from "@/components/ui/Button";
import { FACILITY_TYPE_LABELS } from "@/lib/constants";

export default async function CompanyPage() {
  const company = await getDemoCompany();
  if (!company) return null;

  return (
    <div className="space-y-6">
      <DashboardHeading
        title="Company profile"
        description="This is how your community appears to candidates."
        action={<CompanyStatusBadge status={company.verificationStatus} />}
      />

      <Card>
        <form className="space-y-4">
          <Field label="Community name" defaultValue={company.name} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Website" defaultValue={company.website ?? ""} />
            <Field label="Phone" defaultValue={company.phone ?? ""} />
          </div>
          <Field label="Contact email" defaultValue={company.contactEmail} />
          <div>
            <label className="mb-1.5 block text-sm font-medium">Description</label>
            <textarea
              defaultValue={company.description ?? ""}
              rows={4}
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 outline-none focus-visible:border-primary"
            />
          </div>
          <Button type="submit" size="md">
            Save Changes
          </Button>
        </form>
      </Card>

      <div>
        <h2 className="mb-3 flex items-center gap-2 font-semibold text-foreground">
          <Building2 size={18} className="text-primary" /> Facilities
        </h2>
        <div className="space-y-3">
          {company.facilities.map((f) => (
            <Card key={f.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-medium text-foreground">{f.name}</h3>
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
                    <MapPin size={14} /> {f.address}, {f.city}, {f.state} {f.zip}
                  </p>
                </div>
                <span className="rounded-full bg-primary-light px-2.5 py-1 text-xs font-medium text-primary-dark">
                  {FACILITY_TYPE_LABELS[f.type]}
                </span>
              </div>
            </Card>
          ))}
        </div>
        <div className="mt-3">
          <Button variant="outline" size="sm">
            Add Facility
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, defaultValue }: { label: string; defaultValue: string }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium">{label}</label>
      <input
        defaultValue={defaultValue}
        className="w-full rounded-xl border border-border bg-background px-3 py-2.5 outline-none focus-visible:border-primary"
      />
    </div>
  );
}

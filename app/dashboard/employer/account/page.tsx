import { DashboardHeading, Card } from "@/components/dashboard/DashboardUI";
import { Button } from "@/components/ui/Button";

export default function EmployerAccountPage() {
  return (
    <div className="space-y-6">
      <DashboardHeading title="Account settings" />

      <Card>
        <h2 className="font-semibold text-foreground">Password</h2>
        <p className="mt-1 text-sm text-muted">Update your password to keep your account secure.</p>
        <div className="mt-3">
          <Button variant="outline" size="sm">
            Change Password
          </Button>
        </div>
      </Card>

      <Card>
        <h2 className="font-semibold text-foreground">Notifications</h2>
        <p className="mt-1 text-sm text-muted">
          Choose which applicant status changes notify candidates by email.
        </p>
        <div className="mt-3 space-y-2 text-sm">
          {[
            ["Phone screen", true],
            ["Interview", true],
            ["Offer", true],
            ["Not selected", true],
            ["Reviewed", false],
          ].map(([label, on]) => (
            <label key={label as string} className="flex items-center gap-2">
              <input type="checkbox" defaultChecked={on as boolean} />
              {label}
            </label>
          ))}
        </div>
      </Card>
    </div>
  );
}

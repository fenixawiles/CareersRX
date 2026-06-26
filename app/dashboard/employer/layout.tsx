import { DashboardNav, type NavItem } from "@/components/dashboard/DashboardNav";

// Dashboards are per-user and must render on demand, never statically cached.
export const dynamic = "force-dynamic";

const NAV: NavItem[] = [
  { href: "/dashboard/employer", label: "Overview", icon: "dashboard" },
  { href: "/dashboard/employer/jobs", label: "Jobs", icon: "jobs" },
  { href: "/dashboard/employer/jobs/new", label: "Post a Job", icon: "postJob" },
  { href: "/dashboard/employer/company", label: "Company", icon: "company" },
  { href: "/dashboard/employer/team", label: "Team", icon: "team" },
  { href: "/dashboard/employer/account", label: "Account", icon: "settings" },
];

export default function EmployerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-7xl flex-col lg:flex-row">
      <DashboardNav items={NAV} title="Employer" />
      <div className="min-w-0 flex-1 px-4 py-8 sm:px-6">{children}</div>
    </div>
  );
}

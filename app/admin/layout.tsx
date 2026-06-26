import { DashboardNav, type NavItem } from "@/components/dashboard/DashboardNav";

// Admin pages are sensitive and per-session — always render on demand.
export const dynamic = "force-dynamic";

const NAV: NavItem[] = [
  { href: "/admin", label: "Overview", icon: "dashboard" },
  { href: "/admin/employers", label: "Employers", icon: "employers" },
  { href: "/admin/jobs", label: "Jobs", icon: "jobs" },
  { href: "/admin/reports", label: "Reports", icon: "reports" },
  { href: "/admin/users", label: "Users", icon: "users" },
  { href: "/admin/contact", label: "Contact", icon: "contact" },
  { href: "/admin/audit", label: "Audit Log", icon: "audit" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-7xl flex-col lg:flex-row">
      <DashboardNav items={NAV} title="Admin" />
      <div className="min-w-0 flex-1 px-4 py-8 sm:px-6">{children}</div>
    </div>
  );
}

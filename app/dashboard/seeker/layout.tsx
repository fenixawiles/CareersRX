import { redirect } from "next/navigation";
import { DashboardNav, type NavItem } from "@/components/dashboard/DashboardNav";
import { getCurrentLocalUser } from "@/lib/local-auth";

// Dashboards are per-user and must render on demand, never statically cached.
export const dynamic = "force-dynamic";

const NAV: NavItem[] = [
  { href: "/dashboard/seeker", label: "Overview", icon: "dashboard" },
  { href: "/dashboard/seeker/applications", label: "Applications", icon: "applications" },
  { href: "/dashboard/seeker/saved", label: "Saved Jobs", icon: "saved" },
  { href: "/dashboard/seeker/searches", label: "Saved Searches", icon: "search" },
  { href: "/dashboard/seeker/profile", label: "Profile", icon: "profile" },
  { href: "/dashboard/seeker/resume", label: "Live Résumé", icon: "resume" },
  { href: "/dashboard/seeker/resume#rex-assistant", label: "Ask Rex", icon: "assistant" },
  { href: "/dashboard/seeker/application-packets", label: "Application Packets", icon: "packets" },
  { href: "/dashboard/seeker/account", label: "Account", icon: "settings" },
];

export default async function SeekerLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentLocalUser();
  if (!user) redirect("/login?next=/dashboard/seeker");

  return (
    <div className="mx-auto flex max-w-[1760px] flex-col lg:flex-row">
      <DashboardNav items={NAV} title="Job Seeker" />
      <div className="min-w-0 flex-1 px-4 py-6 sm:px-5">{children}</div>
    </div>
  );
}

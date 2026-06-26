"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Menu,
  X,
  LayoutDashboard,
  FileText,
  Bookmark,
  Search,
  User,
  Settings,
  Briefcase,
  PlusCircle,
  Building2,
  Users,
  Flag,
  ScrollText,
  Mail,
  FilePenLine,
  ClipboardList,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Icon keys are passed from server layouts (strings are serializable; component
// references are not, which breaks static prerendering of client components).
const ICONS = {
  dashboard: LayoutDashboard,
  applications: FileText,
  saved: Bookmark,
  search: Search,
  profile: User,
  resume: FilePenLine,
  assistant: Sparkles,
  packets: ClipboardList,
  settings: Settings,
  jobs: Briefcase,
  postJob: PlusCircle,
  company: Building2,
  team: Users,
  employers: Building2,
  reports: Flag,
  users: Users,
  audit: ScrollText,
  contact: Mail,
} as const;

export type IconKey = keyof typeof ICONS;

export type NavItem = {
  href: string;
  label: string;
  icon: IconKey;
};

function NavLinks({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  const roots = ["/dashboard/seeker", "/dashboard/employer", "/admin"];
  return (
    <nav className="space-y-1">
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        const active =
          pathname === item.href ||
          (!roots.includes(item.href) && pathname.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-2.5 whitespace-nowrap rounded-xl px-2.5 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-white"
                : "text-foreground hover:bg-primary-light",
            )}
          >
            <Icon size={18} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function DashboardNav({ items, title }: { items: NavItem[]; title: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile bar */}
      <div className="flex items-center justify-between border-b border-border bg-surface px-4 py-3 lg:hidden">
        <span className="font-semibold">{title}</span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open dashboard menu"
          className="inline-flex h-11 w-11 items-center justify-center rounded-xl hover:bg-primary-light"
        >
          <Menu size={22} />
        </button>
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden w-56 shrink-0 border-r border-border bg-surface p-3 lg:block">
        <div className="mb-3 px-2.5 text-xs font-semibold uppercase tracking-wide text-muted">
          {title}
        </div>
        <NavLinks items={items} />
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-y-0 left-0 w-72 overflow-y-auto bg-surface p-4 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <span className="font-semibold">{title}</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl hover:bg-primary-light"
              >
                <X size={22} />
              </button>
            </div>
            <NavLinks items={items} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}

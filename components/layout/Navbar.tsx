import { Logo } from "./Logo";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { Button } from "@/components/ui/Button";
import { MobileNav } from "./MobileNav";
import { dashboardPathForUser, getCurrentLocalUser } from "@/lib/local-auth";

const NAV_LINKS = [
  { href: "/jobs", label: "Find Jobs" },
  { href: "/employers", label: "For Employers" },
  { href: "/about", label: "About" },
];

export async function Navbar() {
  const user = await getCurrentLocalUser();
  const dashboardPath = user ? dashboardPathForUser(user) : null;

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-8">
          <Logo />
          <nav aria-label="Primary" className="hidden md:flex items-center gap-6">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-foreground hover:text-primary transition-colors"
              >
                {link.label}
              </a>
            ))}
          </nav>
        </div>

        <div className="hidden md:flex items-center gap-3">
          {dashboardPath ? (
            <>
              <Button href={dashboardPath} variant="ghost" size="sm">
                Dashboard
              </Button>
              <LogoutButton />
            </>
          ) : (
            <>
              <Button href="/login" variant="ghost" size="sm">
                Log in
              </Button>
              <Button href="/register" variant="primary" size="sm">
                Sign up
              </Button>
            </>
          )}
        </div>

        <MobileNav links={NAV_LINKS} dashboardPath={dashboardPath} />
      </div>
    </header>
  );
}

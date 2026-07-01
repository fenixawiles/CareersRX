"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { Button } from "@/components/ui/Button";

export function MobileNav({
  links,
  dashboardPath,
}: {
  links: { href: string; label: string }[];
  dashboardPath: string | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        className="inline-flex h-11 w-11 items-center justify-center rounded-xl hover:bg-primary-light"
      >
        {open ? <X size={24} /> : <Menu size={24} />}
      </button>

      {open && (
        <div className="absolute inset-x-0 top-full border-b border-border bg-surface shadow-lg">
          <nav aria-label="Mobile" className="flex flex-col gap-1 p-4">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-3 text-base font-medium hover:bg-primary-light"
              >
                {link.label}
              </a>
            ))}
            <div className="mt-2 flex flex-col gap-2 border-t border-border pt-3">
              {dashboardPath ? (
                <>
                  <Button href={dashboardPath} variant="primary" size="md">
                    Dashboard
                  </Button>
                  <LogoutButton />
                </>
              ) : (
                <>
                  <Button href="/login" variant="outline" size="md">
                    Log in
                  </Button>
                  <Button href="/register" variant="primary" size="md">
                    Sign up
                  </Button>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </div>
  );
}

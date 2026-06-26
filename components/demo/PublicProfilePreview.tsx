import {
  Award,
  BriefcaseBusiness,
  Clock,
  FilePenLine,
  Mail,
  MapPin,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import type { ReactNode } from "react";
import sanitizeHtml from "sanitize-html";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { SandboxProfile, SandboxSnapshot } from "@/lib/sandbox-types";

function initials(name: string) {
  return (
    name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "CO"
  );
}

function formatDate(value: string) {
  if (!value) return "Not updated yet";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function listOrFallback(items: string[], fallback: string) {
  return items.length > 0 ? items : [fallback];
}

function hasProfile(profile: SandboxProfile) {
  return Boolean(profile.fullName.trim());
}

function hasPreferences(profile: SandboxProfile) {
  return profile.preferences.roles.length > 0 || profile.preferences.locations.length > 0;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function looksLikeHtml(value: string) {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

function markdownToHtml(value: string) {
  return escapeHtml(value)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/_(.+?)_/g, "<em>$1</em>")
    .split("\n")
    .map((line) => {
      const bullet = line.match(/^\s*[-•]\s+(.+)/);
      if (bullet) return `<p>• ${bullet[1]}</p>`;
      const ordered = line.match(/^\s*\d+\.\s+(.+)/);
      if (ordered) return `<p>${ordered[0]}</p>`;
      return line.trim() ? `<p>${line}</p>` : "<p><br></p>";
    })
    .join("");
}

function richTextToHtml(value: string) {
  return looksLikeHtml(value) ? value : markdownToHtml(value);
}

function safeRichTextHtml(value: string) {
  return sanitizeHtml(richTextToHtml(value), {
    allowedTags: ["p", "br", "strong", "em", "ul", "ol", "li", "h3", "div"],
    allowedAttributes: {},
  });
}

type PublicProfilePreviewProps = {
  snapshot: SandboxSnapshot;
  resumeHref?: string;
  signupHref?: string;
  signupLabel?: string;
  emptyDescription?: string;
};

export function PublicProfilePreview({
  snapshot,
  resumeHref = "/demo/live-resume",
  signupHref = "/demo/live-resume/signup",
  signupLabel = "Create Sandbox Profile",
  emptyDescription = "Create a sandbox profile first. CareersRX will generate the live résumé from that profile, then approved résumé section syncs will update this public page.",
}: PublicProfilePreviewProps) {
  const profile = snapshot.profile;

  if (!hasProfile(profile)) {
    return (
      <div className="rounded-3xl border border-dashed border-border bg-surface p-10 text-center shadow-sm">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-light text-primary">
          <UserRound size={30} />
        </div>
        <h1 className="mt-6 text-3xl font-bold tracking-tight text-foreground">
          No public profile yet
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-muted">
          {emptyDescription}
        </p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <Button href={signupHref} size="lg">
            <Sparkles size={18} /> {signupLabel}
          </Button>
          <Button href={resumeHref} variant="outline" size="lg">
            Open Live Résumé
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-3xl border border-border bg-surface shadow-sm">
        <div className="h-32 bg-gradient-to-r from-primary-light via-accent-light to-background" />
        <div className="px-6 pb-6 sm:px-8">
          <div className="-mt-12 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="flex h-24 w-24 items-center justify-center rounded-3xl border-4 border-surface bg-primary text-3xl font-bold text-white shadow-sm">
                {initials(profile.fullName)}
              </div>
              <div className="pb-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-3xl font-bold tracking-tight text-foreground">
                    {profile.fullName}
                  </h1>
                  <Badge tone="success" icon={<ShieldCheck size={13} />}>
                    Profile synced
                  </Badge>
                </div>
                <p className="mt-1 text-lg font-medium text-foreground">
                  {profile.headline || "CareersRX candidate"}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted">
                  {profile.location ? (
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin size={15} /> {profile.location}
                    </span>
                  ) : null}
                  <span className="inline-flex items-center gap-1.5">
                    <Clock size={15} /> Updated {formatDate(profile.updatedAt)}
                  </span>
                </div>
                <div className="mt-4 rounded-2xl border border-border bg-background/70 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                    Open to
                  </p>
                  {hasPreferences(profile) ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {profile.preferences.roles.map((role) => (
                        <Badge key={`role-${role}`} tone="accent">
                          {role}
                        </Badge>
                      ))}
                      {profile.preferences.locations.map((location) => (
                        <Badge key={`location-${location}`} tone="neutral">
                          {location}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-muted">
                      Add target roles or locations from the live résumé Role Preferences section.
                    </p>
                  )}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button href={resumeHref} size="md">
                <FilePenLine size={17} /> Edit via Live Résumé
              </Button>
              {signupHref ? (
                <Button href={signupHref} variant="outline" size="md">
                  {signupLabel}
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <main className="space-y-5">
          <ProfileCard title="About" icon={<UserRound size={17} />}>
            <RichTextBlock
              value={profile.summary}
              fallback="No summary has been synced to the public profile yet."
            />
          </ProfileCard>

          <ProfileCard title="Experience" icon={<BriefcaseBusiness size={17} />}>
            <RichTextBlock
              value={profile.experience}
              fallback="No experience has been synced to the public profile yet."
            />
          </ProfileCard>

          <ProfileCard title="Skills" icon={<Sparkles size={17} />}>
            <div className="flex flex-wrap gap-2">
              {listOrFallback(profile.skills, "No skills synced yet").map((skill) => (
                <Badge key={skill} tone={profile.skills.length > 0 ? "neutral" : "warning"}>
                  {skill}
                </Badge>
              ))}
            </div>
          </ProfileCard>

          <ProfileCard title="Credentials" icon={<Award size={17} />}>
            <div className="flex flex-wrap gap-2">
              {listOrFallback(profile.credentials, "No credentials synced yet").map((credential) => (
                <Badge
                  key={credential}
                  tone={profile.credentials.length > 0 ? "primary" : "warning"}
                >
                  {credential}
                </Badge>
              ))}
            </div>
          </ProfileCard>
        </main>

        <aside className="space-y-5">
          <ProfileCard title="Contact" icon={<Mail size={17} />}>
            <div className="space-y-3 text-sm">
              <InfoRow label="Email" value={profile.email || "Not provided"} />
              <InfoRow label="Location" value={profile.location || "Not provided"} />
            </div>
          </ProfileCard>

          <ProfileCard title="Open To / Career Preferences" icon={<BriefcaseBusiness size={17} />}>
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Target roles
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {listOrFallback(profile.preferences.roles, "No roles synced yet").map((role) => (
                    <Badge key={role} tone={profile.preferences.roles.length > 0 ? "accent" : "warning"}>
                      {role}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Preferred locations
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {listOrFallback(profile.preferences.locations, "No locations synced yet").map(
                    (location) => (
                      <Badge
                        key={location}
                        tone={profile.preferences.locations.length > 0 ? "neutral" : "warning"}
                      >
                        {location}
                      </Badge>
                    ),
                  )}
                </div>
              </div>
            </div>
          </ProfileCard>

          <div className="rounded-2xl border border-primary/20 bg-primary-light/50 p-4 text-sm text-primary-dark">
            <p className="font-semibold">How this profile stays current</p>
            <p className="mt-2 leading-6">
              Employers see this profile. You edit the live résumé, save a section, then
              decide whether that section updates this profile or remains résumé-only.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function ProfileCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted">
        {icon} {title}
      </h2>
      {children}
    </section>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-foreground">{value}</p>
    </div>
  );
}

function RichTextBlock({ value, fallback }: { value: string; fallback: string }) {
  if (!value) return <p className="leading-7 text-muted">{fallback}</p>;
  return (
    <div
      className="space-y-2 leading-7 text-foreground [&_em]:italic [&_h3]:text-base [&_h3]:font-bold [&_li]:ml-5 [&_ol]:list-decimal [&_strong]:font-bold [&_ul]:list-disc"
      dangerouslySetInnerHTML={{ __html: safeRichTextHtml(value) }}
    />
  );
}

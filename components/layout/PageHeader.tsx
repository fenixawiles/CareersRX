export function PageHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="border-b border-border bg-surface">
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-bold text-foreground sm:text-4xl">{title}</h1>
        {subtitle ? <p className="mt-3 text-lg text-muted">{subtitle}</p> : null}
      </div>
    </div>
  );
}

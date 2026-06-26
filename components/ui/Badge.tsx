import { cn } from "@/lib/utils";

type Tone = "neutral" | "primary" | "accent" | "success" | "warning" | "danger";

const tones: Record<Tone, string> = {
  neutral: "bg-primary-light text-primary-dark",
  primary: "bg-primary text-white",
  accent: "bg-accent-light text-accent-dark",
  success: "bg-[#e3f0e9] text-success",
  warning: "bg-[#f6ecd8] text-warning",
  danger: "bg-[#fbe6de] text-danger",
};

export function Badge({
  children,
  tone = "neutral",
  icon,
  className,
}: {
  children: React.ReactNode;
  tone?: Tone;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
        tones[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

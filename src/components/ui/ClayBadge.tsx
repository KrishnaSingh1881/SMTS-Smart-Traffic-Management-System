import { cn } from "@/lib/utils/cn";

type BadgeVariant = "default" | "success" | "warning" | "danger" | "accent";

interface ClayBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-[var(--clay-surface)] text-[var(--clay-text)]",
  success: "bg-[var(--clay-success)]/20 text-[var(--clay-success)]",
  warning: "bg-[var(--clay-warning)]/20 text-[var(--clay-warning)]",
  danger: "bg-[var(--clay-danger)]/20 text-[var(--clay-danger)]",
  accent: "bg-[var(--clay-accent)]/20 text-[var(--clay-accent)]",
};

export default function ClayBadge({
  variant = "default",
  children,
  className,
  ...props
}: ClayBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-3 py-1",
        "rounded-full text-xs font-semibold",
        "shadow-clay-inset border border-[var(--clay-border)]",
        variantClasses[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

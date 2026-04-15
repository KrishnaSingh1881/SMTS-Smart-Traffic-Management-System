import { forwardRef } from "react";
import { cn } from "@/lib/utils/cn";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

interface ClayButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  children: React.ReactNode;
  className?: string;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--clay-accent)] text-white hover:brightness-110 active:shadow-clay-inset",
  secondary:
    "bg-[var(--clay-surface)] text-[var(--clay-text)] hover:brightness-95 active:shadow-clay-inset",
  danger:
    "bg-[var(--clay-danger)]/20 text-[var(--clay-danger)] hover:bg-[var(--clay-danger)]/30 active:shadow-clay-inset",
  ghost:
    "bg-transparent text-[var(--clay-muted)] hover:bg-[var(--clay-surface)] active:shadow-clay-inset",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-5 py-2.5 text-sm",
  lg: "px-7 py-3 text-base",
};

const ClayButton = forwardRef<HTMLButtonElement, ClayButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      isLoading = false,
      children,
      className,
      disabled,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          "inline-flex items-center justify-center gap-2 font-medium",
          "rounded-clay shadow-clay border border-[var(--clay-border)]",
          "transition-all duration-150 cursor-pointer",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {isLoading ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : null}
        {children}
      </button>
    );
  }
);

ClayButton.displayName = "ClayButton";

export default ClayButton;

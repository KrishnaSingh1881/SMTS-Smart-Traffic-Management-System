import { forwardRef } from "react";
import { cn } from "@/lib/utils/cn";

interface ClayInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  className?: string;
}

const ClayInput = forwardRef<HTMLInputElement, ClayInputProps>(
  ({ label, error, className, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="flex flex-col gap-1.5">
        {label ? (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-[var(--clay-text)]"
          >
            {label}
          </label>
        ) : null}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            "w-full rounded-clay px-4 py-2.5 text-sm",
            "bg-[var(--clay-surface)] text-[var(--clay-text)]",
            "border border-[var(--clay-border)] shadow-clay-inset",
            "placeholder:text-[var(--clay-muted)]",
            "outline-none focus:ring-2 focus:ring-[var(--clay-accent)]/40",
            "transition-shadow duration-150",
            error && "ring-2 ring-[var(--clay-danger)]/50",
            className
          )}
          {...props}
        />
        {error ? (
          <p className="text-xs text-[var(--clay-danger)]">{error}</p>
        ) : null}
      </div>
    );
  }
);

ClayInput.displayName = "ClayInput";

export default ClayInput;

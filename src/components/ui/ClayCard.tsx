import { forwardRef } from "react";
import { cn } from "@/lib/utils/cn";

interface ClayCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  /** Larger radius + shadow variant */
  size?: "default" | "lg" | "sm";
  /** Disable hover lift effect */
  static?: boolean;
}

const ClayCard = forwardRef<HTMLDivElement, ClayCardProps>(
  ({ children, className, size = "default", static: isStatic, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          // base surface
          "bg-[var(--clay-surface)] border border-[var(--clay-border)]",
          "backdrop-blur-[var(--clay-blur)]",
          // gradient sheen
          "bg-gradient-to-br from-[var(--clay-surface-raised)] to-[var(--clay-surface)]",
          // shadow & radius
          size === "lg"
            ? "rounded-[var(--clay-border-radius-lg)] shadow-clay-lg"
            : size === "sm"
            ? "rounded-[var(--clay-border-radius-sm)] shadow-clay-sm"
            : "rounded-[var(--clay-border-radius)] shadow-clay",
          // hover
          !isStatic && "transition-all duration-200 hover:shadow-clay-hover hover:-translate-y-0.5",
          "p-5",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

ClayCard.displayName = "ClayCard";
export default ClayCard;

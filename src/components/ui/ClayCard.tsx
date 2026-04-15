import { forwardRef } from "react";
import { cn } from "@/lib/utils/cn";

interface ClayCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
}

const ClayCard = forwardRef<HTMLDivElement, ClayCardProps>(
  ({ children, className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-clay bg-[var(--clay-surface)] shadow-clay",
          "border border-[var(--clay-border)]",
          "backdrop-blur-clay p-6",
          "transition-shadow duration-200",
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

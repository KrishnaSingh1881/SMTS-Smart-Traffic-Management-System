"use client";

import { motion } from "framer-motion";
import type { CongestionLevel } from "@prisma/client";
import ClayBadge from "@/components/ui/ClayBadge";
import { cn } from "@/lib/utils/cn";

interface CongestionBadgeProps {
  level: CongestionLevel;
  className?: string;
}

const levelVariant: Record<CongestionLevel, "success" | "warning" | "danger"> = {
  Free: "success",
  Moderate: "warning",
  Heavy: "danger",
  Gridlock: "danger",
};

const gridlockExtra = "ring-2 ring-[var(--clay-danger)] ring-offset-1 font-bold";

export default function CongestionBadge({ level, className }: CongestionBadgeProps) {
  return (
    <motion.span layout>
      <ClayBadge
        variant={levelVariant[level]}
        className={cn(level === "Gridlock" && gridlockExtra, className)}
      >
        {level}
      </ClayBadge>
    </motion.span>
  );
}

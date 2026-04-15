"use client";

import ClayBadge from "@/components/ui/ClayBadge";
import { cn } from "@/lib/utils/cn";

interface SensorOfflineAlertProps {
  segmentName: string;
  className?: string;
}

export default function SensorOfflineAlert({
  segmentName,
  className,
}: SensorOfflineAlertProps) {
  return (
    <ClayBadge variant="warning" className={cn("w-full justify-center", className)}>
      ⚠️ Sensor offline — {segmentName}
    </ClayBadge>
  );
}

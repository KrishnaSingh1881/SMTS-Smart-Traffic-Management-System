"use client";

import { motion } from "framer-motion";
import type { SegmentState } from "@/store/useTrafficStore";
import ClayCard from "@/components/ui/ClayCard";
import CongestionBadge from "@/components/monitoring/CongestionBadge";
import SensorOfflineAlert from "@/components/monitoring/SensorOfflineAlert";

interface SegmentGridProps {
  segments: SegmentState[];
}

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export default function SegmentGrid({ segments }: SegmentGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {segments.map((seg, i) => (
        <div key={seg.id}>
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.08, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
          <ClayCard className="flex flex-col gap-3">
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-semibold text-[var(--clay-text)] leading-tight">
                {seg.name}
              </h3>
              <CongestionBadge level={seg.currentCongestion} />
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-2 text-xs text-[var(--clay-text-muted)]">
              <div>
                <span className="block font-medium text-[var(--clay-text)]">
                  {seg.vehicleCount ?? "—"}
                </span>
                vehicles
              </div>
              <div>
                <span className="block font-medium text-[var(--clay-text)]">
                  {seg.avgSpeedKmh != null ? `${seg.avgSpeedKmh} km/h` : "—"}
                </span>
                avg speed
              </div>
            </div>

            {/* Last updated */}
            <p className="text-xs text-[var(--clay-text-muted)]">
              Updated: {formatTime(seg.lastObservationAt)}
            </p>

            {/* Offline alert */}
            {!seg.sensorOnline && (
              <SensorOfflineAlert segmentName={seg.name} />
            )}
          </ClayCard>
          </motion.div>
        </div>
      ))}
    </div>
  );
}

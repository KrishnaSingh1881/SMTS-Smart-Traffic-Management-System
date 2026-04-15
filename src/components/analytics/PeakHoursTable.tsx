"use client";

/**
 * Peak Hours Table with clay row styling
 * Requirements: 7.3
 */

import type { PeakHourRow } from "@/lib/db/queries/storedProcedures";
import ClayBadge from "@/components/ui/ClayBadge";

interface PeakHoursTableProps {
  data: PeakHourRow[];
}

const congestionLevelMap: Record<number, { label: string; variant: "success" | "warning" | "danger" }> = {
  0: { label: "Free", variant: "success" },
  1: { label: "Moderate", variant: "warning" },
  2: { label: "Heavy", variant: "danger" },
  3: { label: "Gridlock", variant: "danger" },
};

export default function PeakHoursTable({ data }: PeakHoursTableProps) {
  if (data.length === 0) {
    return (
      <p className="text-center text-[var(--clay-muted)]">No data available</p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-[var(--clay-border)]">
            <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--clay-text)]">
              Rank
            </th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--clay-text)]">
              Segment Name
            </th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--clay-text)]">
              Avg Congestion
            </th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--clay-text)]">
              Peak Vehicles
            </th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--clay-text)]">
              Peak Hour
            </th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, index) => {
            const congestionLevel = Math.round(row.avg_congestion);
            const congestionInfo = congestionLevelMap[congestionLevel] || congestionLevelMap[0];

            return (
              <tr
                key={row.segment_id}
                className="border-b border-[var(--clay-border)] bg-[var(--clay-surface)] shadow-clay-inset transition-all hover:bg-[var(--clay-surface)]/80"
              >
                <td className="px-4 py-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--clay-accent)]/20 text-sm font-bold text-[var(--clay-accent)]">
                    {index + 1}
                  </div>
                </td>
                <td className="px-4 py-4 text-sm font-medium text-[var(--clay-text)]">
                  {row.segment_name}
                </td>
                <td className="px-4 py-4">
                  <ClayBadge variant={congestionInfo.variant}>
                    {congestionInfo.label} ({row.avg_congestion.toFixed(2)})
                  </ClayBadge>
                </td>
                <td className="px-4 py-4 text-sm text-[var(--clay-text)]">
                  {row.peak_vehicle_count}
                </td>
                <td className="px-4 py-4 text-sm font-semibold text-[var(--clay-text)]">
                  {row.peak_hour}:00
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

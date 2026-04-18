"use client";

/**
 * MonitoringStatsBar — global network stats at a glance
 * Requirements: 20.3
 */

import { useTrafficStore } from "@/store/useTrafficStore";
import ClayCard from "@/components/ui/ClayCard";

function pct(count: number, total: number): string {
  if (total === 0) return "0%";
  return `${Math.round((count / total) * 100)}%`;
}

export default function MonitoringStatsBar() {
  const segments = useTrafficStore((s) => Object.values(s.segments));
  const activeIncidents = useTrafficStore(
    (s) => Object.values(s.incidents).filter((i) => i.status === "Active").length
  );

  const total = segments.length;
  const free = segments.filter((s) => s.currentCongestion === "Free").length;
  const moderate = segments.filter((s) => s.currentCongestion === "Moderate").length;
  const heavy = segments.filter((s) => s.currentCongestion === "Heavy").length;
  const gridlock = segments.filter((s) => s.currentCongestion === "Gridlock").length;

  const stats = [
    { label: "Total Segments", value: String(total), color: "text-[var(--clay-text)]" },
    { label: "Free", value: pct(free, total), color: "text-[var(--clay-success)]" },
    { label: "Moderate", value: pct(moderate, total), color: "text-[var(--clay-warning)]" },
    { label: "Heavy", value: pct(heavy, total), color: "text-[var(--clay-danger)]" },
    { label: "Gridlock", value: pct(gridlock, total), color: "text-[var(--clay-danger)] font-bold" },
    { label: "Active Incidents", value: String(activeIncidents), color: activeIncidents > 0 ? "text-[var(--clay-danger)]" : "text-[var(--clay-text)]" },
  ];

  return (
    <ClayCard static className="p-4">
      <div className="flex flex-wrap gap-6 items-center">
        {stats.map((stat) => (
          <div key={stat.label} className="flex flex-col items-center min-w-[80px]">
            <span className={`text-xl font-bold ${stat.color}`}>{stat.value}</span>
            <span className="text-xs text-[var(--clay-text-muted)] mt-0.5">{stat.label}</span>
          </div>
        ))}
      </div>
    </ClayCard>
  );
}

"use client";

import { useEffect } from "react";
import { useTrafficStore, type SegmentState } from "@/store/useTrafficStore";
import TrafficMap from "@/components/map/TrafficMap";

export default function MapPage() {
  const setSegments = useTrafficStore((s) => s.setSegments);
  const segments = useTrafficStore((s) => Object.values(s.segments) as SegmentState[]);

  useEffect(() => {
    async function hydrate() {
      const res = await fetch("/api/monitoring/segments");
      if (res.ok) {
        const data = await res.json();
        setSegments(Array.isArray(data) ? data : (data.segments ?? []));
      }
    }
    hydrate();
  }, [setSegments]);

  return (
    <div className="flex flex-col gap-6 h-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--clay-text)]">Traffic Map</h1>
          <p className="text-sm text-[var(--clay-text-muted)] mt-0.5">
            Live road network — updates every 30s via SSE
          </p>
        </div>
        <Legend />
      </div>
      <TrafficMap segments={segments} />
    </div>
  );
}

function Legend() {
  const items = [
    { label: "Free",     color: "#22c55e" },
    { label: "Moderate", color: "#f59e0b" },
    { label: "Heavy",    color: "#ef4444" },
    { label: "Gridlock", color: "#dc2626" },
    { label: "Offline",  color: "#94a3b8" },
  ];
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 rounded-[var(--clay-border-radius-sm)] shadow-clay-sm bg-[var(--clay-surface)] border border-[var(--clay-border)]">
      {items.map((i) => (
        <div key={i.label} className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: i.color }} />
          <span className="text-xs text-[var(--clay-text-muted)]">{i.label}</span>
        </div>
      ))}
    </div>
  );
}

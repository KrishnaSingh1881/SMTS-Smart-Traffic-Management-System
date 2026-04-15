"use client";

/**
 * Traffic Monitoring dashboard page
 * Requirements: 7.4
 */

import { useEffect, useState } from "react";
import { useTrafficStore } from "@/store/useTrafficStore";
import SegmentGrid from "@/components/monitoring/SegmentGrid";
import type { SegmentState } from "@/store/useTrafficStore";

export default function MonitoringPage() {
  const [loading, setLoading] = useState(true);
  const setSegments = useTrafficStore((state) => state.setSegments);
  const segments = useTrafficStore((state) =>
    Object.values(state.segments) as SegmentState[]
  );

  useEffect(() => {
    async function hydrate() {
      try {
        const res = await fetch("/api/monitoring/segments");
        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data) ? data : (data.segments ?? []);
          setSegments(list);
        }
      } finally {
        setLoading(false);
      }
    }
    hydrate();
  }, [setSegments]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-[var(--clay-text)]">
        Traffic Monitoring
      </h1>

      {loading ? (
        <p className="text-sm text-[var(--clay-text-muted)]">Loading segments…</p>
      ) : segments.length === 0 ? (
        <p className="text-sm text-[var(--clay-text-muted)]">No segments found.</p>
      ) : (
        <SegmentGrid segments={segments} />
      )}
    </div>
  );
}

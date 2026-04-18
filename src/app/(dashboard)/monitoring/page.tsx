"use client";

/**
 * Traffic Monitoring dashboard page
 * Requirements: 20.1, 20.2, 20.3
 */

import { useEffect, useState } from "react";
import { useTrafficStore } from "@/store/useTrafficStore";
import SegmentGrid from "@/components/monitoring/SegmentGrid";
import SegmentTable from "@/components/monitoring/SegmentTable";
import MonitoringStatsBar from "@/components/monitoring/MonitoringStatsBar";
import type { SegmentState } from "@/store/useTrafficStore";

// ── Icons ──────────────────────────────────────────────────────────────────

function GridIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="9" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="1" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="9" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function TableIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1" y="1" width="14" height="3" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="1" y="6" width="14" height="3" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="1" y="11" width="14" height="3" rx="1" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

type ViewMode = "table" | "grid";

export default function MonitoringPage() {
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>("table");

  const setSegments = useTrafficStore((state) => state.setSegments);
  const setIncidents = useTrafficStore((state) => state.setIncidents);
  const segments = useTrafficStore(
    (state) => Object.values(state.segments) as SegmentState[]
  );

  useEffect(() => {
    async function hydrate() {
      try {
        const [segRes, incRes] = await Promise.all([
          fetch("/api/monitoring/segments"),
          fetch("/api/incidents"),
        ]);
        if (segRes.ok) {
          const data = await segRes.json();
          const list = Array.isArray(data) ? data : (data.segments ?? []);
          setSegments(list);
        }
        if (incRes.ok) {
          const data = await incRes.json();
          const list = Array.isArray(data) ? data : (data.incidents ?? []);
          setIncidents(list);
        }
      } finally {
        setLoading(false);
      }
    }
    hydrate();
  }, [setSegments, setIncidents]);

  return (
    <div className="flex flex-col gap-4">
      {/* Header row */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-[var(--clay-text)]">Traffic Monitoring</h1>

        {/* View toggle */}
        <div className="flex items-center gap-1 rounded-[var(--clay-border-radius-sm)] border border-[var(--clay-border)] bg-[var(--clay-surface)] p-1">
          <button
            onClick={() => setView("table")}
            aria-label="Table view"
            title="Table view"
            className={[
              "flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium transition-colors",
              view === "table"
                ? "bg-[var(--clay-accent)] text-white shadow-sm"
                : "text-[var(--clay-text-muted)] hover:text-[var(--clay-text)]",
            ].join(" ")}
          >
            <TableIcon />
            Table
          </button>
          <button
            onClick={() => setView("grid")}
            aria-label="Grid view"
            title="Grid view"
            className={[
              "flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium transition-colors",
              view === "grid"
                ? "bg-[var(--clay-accent)] text-white shadow-sm"
                : "text-[var(--clay-text-muted)] hover:text-[var(--clay-text)]",
            ].join(" ")}
          >
            <GridIcon />
            Grid
          </button>
        </div>
      </div>

      {/* Stats bar — always visible */}
      <MonitoringStatsBar />

      {/* Content */}
      {loading ? (
        <p className="text-sm text-[var(--clay-text-muted)]">Loading segments…</p>
      ) : view === "table" ? (
        <SegmentTable />
      ) : segments.length === 0 ? (
        <p className="text-sm text-[var(--clay-text-muted)]">No segments found.</p>
      ) : (
        <SegmentGrid segments={segments} />
      )}
    </div>
  );
}

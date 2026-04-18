"use client";

/**
 * SegmentTable — sortable table view for road segments
 * Requirements: 20.1, 20.4
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { useTrafficStore } from "@/store/useTrafficStore";
import type { SegmentState } from "@/store/useTrafficStore";
import CongestionBadge from "@/components/monitoring/CongestionBadge";
import { cn } from "@/lib/utils/cn";

// ── Types ──────────────────────────────────────────────────────────────────

type SortKey = "name" | "zone" | "congestion" | "vehicles" | "avgSpeed" | "lastUpdate";
type SortDir = "asc" | "desc";

// ── Sparkline ──────────────────────────────────────────────────────────────

function Sparkline({ history }: { history: number[] }) {
  if (history.length < 2) {
    return <span className="text-xs text-[var(--clay-text-muted)]">—</span>;
  }
  const w = 48;
  const h = 20;
  const max = Math.max(...history, 1);
  const min = Math.min(...history);
  const range = max - min || 1;
  const pts = history.map((v, i) => {
    const x = (i / (history.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 2) - 1;
    return `${x},${y}`;
  });
  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke="var(--clay-accent)"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ── Sort helpers ───────────────────────────────────────────────────────────

const congestionOrder: Record<string, number> = {
  Free: 0,
  Moderate: 1,
  Heavy: 2,
  Gridlock: 3,
};

function sortSegments(
  segments: SegmentState[],
  key: SortKey,
  dir: SortDir,
  zoneMap: Record<string, string>
): SegmentState[] {
  return [...segments].sort((a, b) => {
    let cmp = 0;
    switch (key) {
      case "name":
        cmp = a.name.localeCompare(b.name);
        break;
      case "zone":
        cmp = (zoneMap[a.id] ?? "").localeCompare(zoneMap[b.id] ?? "");
        break;
      case "congestion":
        cmp = (congestionOrder[a.currentCongestion] ?? 0) - (congestionOrder[b.currentCongestion] ?? 0);
        break;
      case "vehicles":
        cmp = (a.vehicleCount ?? 0) - (b.vehicleCount ?? 0);
        break;
      case "avgSpeed":
        cmp = (a.avgSpeedKmh ?? 0) - (b.avgSpeedKmh ?? 0);
        break;
      case "lastUpdate":
        cmp = (a.lastObservationAt ?? "").localeCompare(b.lastObservationAt ?? "");
        break;
    }
    return dir === "asc" ? cmp : -cmp;
  });
}

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

// ── Column header ──────────────────────────────────────────────────────────

function Th({
  label,
  sortKey,
  current,
  dir,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  current: SortKey;
  dir: SortDir;
  onSort: (k: SortKey) => void;
}) {
  const active = current === sortKey;
  return (
    <th
      className="px-3 py-2 text-left text-xs font-semibold text-[var(--clay-text-muted)] cursor-pointer select-none whitespace-nowrap hover:text-[var(--clay-text)] transition-colors"
      onClick={() => onSort(sortKey)}
    >
      {label}
      <span className="ml-1 opacity-60">
        {active ? (dir === "asc" ? "↑" : "↓") : "↕"}
      </span>
    </th>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function SegmentTable() {
  const segments = useTrafficStore((s) => Object.values(s.segments) as SegmentState[]);
  const upsertSegment = useTrafficStore((s) => s.upsertSegment);

  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // segmentId → last 5 vehicle counts
  const [history, setHistory] = useState<Record<string, number[]>>({});

  // segmentId → flash state
  const [flashing, setFlashing] = useState<Record<string, boolean>>({});
  const flashTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // zone labels fetched from segment data (zoneType not in SegmentState, so we derive from API)
  // We'll store zone info in a local map populated from SSE / initial load
  const [zoneMap, setZoneMap] = useState<Record<string, string>>({});

  // Fetch zone info once on mount
  useEffect(() => {
    fetch("/api/monitoring/segments")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data) return;
        const list: Array<{ id: string; zoneType?: string[] }> = Array.isArray(data)
          ? data
          : (data.segments ?? []);
        const map: Record<string, string> = {};
        for (const seg of list) {
          if (seg.id && seg.zoneType?.length) {
            map[seg.id] = seg.zoneType.join(", ");
          }
        }
        setZoneMap(map);
      })
      .catch(() => {/* ignore */});
  }, []);

  // SSE subscription for segment:update — flash row + update history
  const handleSegmentUpdate = useCallback(
    (seg: SegmentState) => {
      upsertSegment(seg);

      // Update vehicle count history (last 5)
      setHistory((prev) => {
        const existing = prev[seg.id] ?? [];
        const next = [...existing, seg.vehicleCount ?? 0].slice(-5);
        return { ...prev, [seg.id]: next };
      });

      // Flash the row
      setFlashing((prev) => ({ ...prev, [seg.id]: true }));
      if (flashTimers.current[seg.id]) clearTimeout(flashTimers.current[seg.id]);
      flashTimers.current[seg.id] = setTimeout(() => {
        setFlashing((prev) => ({ ...prev, [seg.id]: false }));
      }, 800);
    },
    [upsertSegment]
  );

  useEffect(() => {
    const es = new EventSource("/api/monitoring/sse");
    es.addEventListener("segment:update", (e) => {
      try {
        const seg = JSON.parse(e.data) as SegmentState;
        handleSegmentUpdate(seg);
      } catch {/* ignore */}
    });
    return () => {
      es.close();
      // clear all flash timers
      Object.values(flashTimers.current).forEach(clearTimeout);
    };
  }, [handleSegmentUpdate]);

  // Seed initial history from current store values
  useEffect(() => {
    setHistory((prev) => {
      const next = { ...prev };
      for (const seg of segments) {
        if (!next[seg.id] && seg.vehicleCount != null) {
          next[seg.id] = [seg.vehicleCount];
        }
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segments.length]);

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const sorted = sortSegments(segments, sortKey, sortDir, zoneMap);

  return (
    <div className="overflow-x-auto rounded-[var(--clay-border-radius)] border border-[var(--clay-border)] bg-[var(--clay-surface)]">
      <table className="w-full text-sm">
        <thead className="border-b border-[var(--clay-border)] bg-[var(--clay-surface-raised)]">
          <tr>
            <Th label="Segment Name" sortKey="name" current={sortKey} dir={sortDir} onSort={handleSort} />
            <Th label="Zone" sortKey="zone" current={sortKey} dir={sortDir} onSort={handleSort} />
            <Th label="Congestion" sortKey="congestion" current={sortKey} dir={sortDir} onSort={handleSort} />
            <Th label="Vehicles" sortKey="vehicles" current={sortKey} dir={sortDir} onSort={handleSort} />
            <Th label="Avg Speed" sortKey="avgSpeed" current={sortKey} dir={sortDir} onSort={handleSort} />
            <Th label="Last Update" sortKey="lastUpdate" current={sortKey} dir={sortDir} onSort={handleSort} />
            <th className="px-3 py-2 text-left text-xs font-semibold text-[var(--clay-text-muted)]">Trend</th>
            <th className="px-3 py-2 text-left text-xs font-semibold text-[var(--clay-text-muted)]">Actions</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((seg) => (
            <tr
              key={seg.id}
              className={cn(
                "border-b border-[var(--clay-border)] last:border-0 transition-colors duration-150",
                flashing[seg.id]
                  ? "bg-[var(--clay-accent)]/15"
                  : "hover:bg-[var(--clay-surface-raised)]"
              )}
            >
              <td className="px-3 py-2 font-medium text-[var(--clay-text)] whitespace-nowrap">
                {seg.name}
              </td>
              <td className="px-3 py-2 text-[var(--clay-text-muted)] whitespace-nowrap capitalize">
                {zoneMap[seg.id] ?? "—"}
              </td>
              <td className="px-3 py-2">
                <CongestionBadge level={seg.currentCongestion} />
              </td>
              <td className="px-3 py-2 text-[var(--clay-text)] tabular-nums">
                {seg.vehicleCount ?? "—"}
              </td>
              <td className="px-3 py-2 text-[var(--clay-text)] tabular-nums whitespace-nowrap">
                {seg.avgSpeedKmh != null ? `${seg.avgSpeedKmh} km/h` : "—"}
              </td>
              <td className="px-3 py-2 text-[var(--clay-text-muted)] tabular-nums whitespace-nowrap">
                {formatTime(seg.lastObservationAt)}
              </td>
              <td className="px-3 py-2">
                <Sparkline history={history[seg.id] ?? []} />
              </td>
              <td className="px-3 py-2">
                <a
                  href={`/signals?segment=${seg.id}`}
                  className="text-xs text-[var(--clay-accent)] hover:underline whitespace-nowrap"
                >
                  View signals
                </a>
              </td>
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={8} className="px-3 py-6 text-center text-sm text-[var(--clay-text-muted)]">
                No segments found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

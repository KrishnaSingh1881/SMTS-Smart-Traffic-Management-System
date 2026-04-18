"use client";

/**
 * SegmentDetailPanel component
 * Slide-in panel triggered by segment click on the map.
 * Requirements: 5.1
 *
 * Displays: segment name, current vehicle count, avg speed,
 * congestion level, active incidents, and AI prediction.
 */

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ClayCard from "@/components/ui/ClayCard";
import ClayBadge from "@/components/ui/ClayBadge";
import ClayButton from "@/components/ui/ClayButton";
import CongestionBadge from "@/components/monitoring/CongestionBadge";
import type { CongestionLevel } from "@prisma/client";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SegmentData {
  id: string;
  name: string;
  currentCongestion: CongestionLevel;
  sensorOnline: boolean;
  lastObservationAt: string | null;
  vehicleCount?: number;
  avgSpeedKmh?: number;
}

interface Prediction {
  id: string;
  segmentId: string;
  predictedLevel: CongestionLevel;
  targetWindowMinutes: number;
  confidenceScore: number;
  predictedAt: string;
}

interface Incident {
  id: string;
  type: string;
  severity: number;
  status: string;
  description: string | null;
  createdAt: string;
}

// ─── Colour map matching SegmentLayer / TrafficMap ────────────────────────────

const CONGESTION_COLORS: Record<string, string> = {
  Free: "#22c55e",
  Moderate: "#eab308",
  Heavy: "#f97316",
  Gridlock: "#ef4444",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatConfidence(score: number): string {
  return `${Math.round(score * 100)}%`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="px-3 py-2 rounded-[var(--clay-border-radius-sm)]"
      style={{
        boxShadow: "var(--clay-shadow-inset)",
        border: "1px solid var(--clay-border)",
      }}
    >
      <p className="text-[10px]" style={{ color: "var(--clay-text-muted)" }}>
        {label}
      </p>
      <p className="text-sm font-bold" style={{ color: "var(--clay-text)" }}>
        {value}
      </p>
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface SegmentDetailPanelProps {
  segmentId: string | null;
  onClose: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SegmentDetailPanel({
  segmentId,
  onClose,
}: SegmentDetailPanelProps) {
  const [segment, setSegment] = useState<SegmentData | null>(null);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!segmentId) {
      setSegment(null);
      setPredictions([]);
      setIncidents([]);
      setError(null);
      return;
    }

    let cancelled = false;

    async function fetchData() {
      setLoading(true);
      setError(null);

      try {
        const [segRes, predRes, incRes] = await Promise.all([
          fetch("/api/monitoring/segments"),
          fetch("/api/predictions"),
          fetch(`/api/incidents?segment_id=${segmentId}&status=Active`),
        ]);

        if (cancelled) return;

        if (!segRes.ok || !predRes.ok || !incRes.ok) {
          throw new Error("Failed to load segment data");
        }

        const [allSegments, allPredictions, allIncidents] = await Promise.all([
          segRes.json() as Promise<SegmentData[]>,
          predRes.json() as Promise<Prediction[]>,
          incRes.json() as Promise<Incident[]>,
        ]);

        if (cancelled) return;

        const found = allSegments.find((s) => s.id === segmentId) ?? null;
        const segPredictions = allPredictions.filter(
          (p) => p.segmentId === segmentId
        );

        setSegment(found);
        setPredictions(segPredictions);
        setIncidents(allIncidents);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unknown error");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [segmentId]);

  const congestionColor =
    segment ? (CONGESTION_COLORS[segment.currentCongestion] ?? "#22c55e") : "#22c55e";

  const prediction60 = predictions.find((p) => p.targetWindowMinutes === 60);
  const prediction120 = predictions.find((p) => p.targetWindowMinutes === 120);

  return (
    <AnimatePresence>
      {segmentId && (
        <motion.div
          key="segment-detail-panel"
          initial={{ x: "100%", opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: "100%", opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="absolute top-0 right-0 h-full w-80 z-20 flex flex-col"
          style={{
            background:
              "linear-gradient(135deg, var(--clay-surface-raised) 0%, var(--clay-surface) 100%)",
            borderLeft: "1px solid var(--clay-border)",
            boxShadow: "var(--clay-shadow-lg)",
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-5 py-4 border-b"
            style={{ borderColor: "var(--clay-border)" }}
          >
            <div className="flex-1 min-w-0">
              {loading ? (
                <div
                  className="h-4 w-32 rounded animate-pulse"
                  style={{ background: "var(--clay-border)" }}
                />
              ) : (
                <h2
                  className="text-sm font-bold truncate"
                  style={{ color: "var(--clay-text)" }}
                >
                  {segment?.name ?? "Segment"}
                </h2>
              )}
              <p
                className="text-[10px] mt-0.5"
                style={{ color: "var(--clay-text-muted)" }}
              >
                Road Segment
              </p>
            </div>
            <ClayButton variant="ghost" size="sm" onClick={onClose}>
              ✕
            </ClayButton>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
            {error && (
              <div
                className="px-3 py-2 rounded-[var(--clay-border-radius-sm)] text-xs"
                style={{
                  background: "var(--clay-danger)/10",
                  border: "1px solid var(--clay-danger)",
                  color: "var(--clay-danger)",
                }}
              >
                {error}
              </div>
            )}

            {loading && (
              <div className="flex flex-col gap-3">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-16 rounded-[var(--clay-border-radius-sm)] animate-pulse"
                    style={{ background: "var(--clay-border)" }}
                  />
                ))}
              </div>
            )}

            {!loading && segment && (
              <>
                {/* Congestion level */}
                <div
                  className="flex items-center gap-2 px-3 py-2.5 rounded-[var(--clay-border-radius-sm)]"
                  style={{
                    background: `${congestionColor}18`,
                    border: `1px solid ${congestionColor}40`,
                  }}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ background: congestionColor }}
                  />
                  <span
                    className="text-xs font-bold"
                    style={{ color: congestionColor }}
                  >
                    {segment.currentCongestion}
                  </span>
                  {!segment.sensorOnline && (
                    <ClayBadge variant="danger" className="ml-auto text-[10px]">
                      ⚠ Offline
                    </ClayBadge>
                  )}
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-2 gap-2">
                  <StatBox
                    label="Vehicles"
                    value={
                      segment.vehicleCount != null
                        ? String(segment.vehicleCount)
                        : "—"
                    }
                  />
                  <StatBox
                    label="Avg Speed"
                    value={
                      segment.avgSpeedKmh != null
                        ? `${segment.avgSpeedKmh} km/h`
                        : "—"
                    }
                  />
                  <StatBox
                    label="Sensor"
                    value={segment.sensorOnline ? "Online" : "Offline"}
                  />
                  <StatBox
                    label="Last Update"
                    value={
                      segment.lastObservationAt
                        ? formatTime(segment.lastObservationAt)
                        : "—"
                    }
                  />
                </div>

                {/* Active incidents */}
                <section>
                  <div className="flex items-center justify-between mb-2">
                    <p
                      className="text-xs font-semibold"
                      style={{ color: "var(--clay-text)" }}
                    >
                      Active Incidents
                    </p>
                    {incidents.length > 0 && (
                      <ClayBadge variant="danger">{incidents.length}</ClayBadge>
                    )}
                  </div>

                  {incidents.length === 0 ? (
                    <p
                      className="text-xs"
                      style={{ color: "var(--clay-text-muted)" }}
                    >
                      No active incidents
                    </p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {incidents.map((inc) => (
                        <ClayCard key={inc.id} size="sm" static className="p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p
                                className="text-xs font-semibold truncate"
                                style={{ color: "var(--clay-text)" }}
                              >
                                {inc.type.replace("_", " ")}
                              </p>
                              {inc.description && (
                                <p
                                  className="text-[10px] mt-0.5 line-clamp-2"
                                  style={{ color: "var(--clay-text-muted)" }}
                                >
                                  {inc.description}
                                </p>
                              )}
                            </div>
                            <ClayBadge variant="warning" className="flex-shrink-0">
                              Sev {inc.severity}
                            </ClayBadge>
                          </div>
                          <p
                            className="text-[10px] mt-1.5"
                            style={{ color: "var(--clay-text-muted)" }}
                          >
                            {formatTime(inc.createdAt)}
                          </p>
                        </ClayCard>
                      ))}
                    </div>
                  )}
                </section>

                {/* AI Prediction */}
                <section>
                  <p
                    className="text-xs font-semibold mb-2"
                    style={{ color: "var(--clay-text)" }}
                  >
                    AI Prediction
                  </p>

                  {predictions.length === 0 ? (
                    <p
                      className="text-xs"
                      style={{ color: "var(--clay-text-muted)" }}
                    >
                      No predictions available
                    </p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {[
                        { label: "60 min", pred: prediction60 },
                        { label: "120 min", pred: prediction120 },
                      ].map(({ label, pred }) =>
                        pred ? (
                          <div
                            key={label}
                            className="flex items-center justify-between px-3 py-2 rounded-[var(--clay-border-radius-sm)]"
                            style={{
                              boxShadow: "var(--clay-shadow-inset)",
                              border: "1px solid var(--clay-border)",
                            }}
                          >
                            <p
                              className="text-xs"
                              style={{ color: "var(--clay-text-muted)" }}
                            >
                              {label}
                            </p>
                            <div className="flex items-center gap-2">
                              <CongestionBadge level={pred.predictedLevel} />
                              <span
                                className="text-[10px]"
                                style={{ color: "var(--clay-text-muted)" }}
                              >
                                {formatConfidence(pred.confidenceScore)}
                              </span>
                            </div>
                          </div>
                        ) : null
                      )}
                      {(prediction60 || prediction120) && (
                        <p
                          className="text-[10px]"
                          style={{ color: "var(--clay-text-muted)" }}
                        >
                          Updated:{" "}
                          {formatTime(
                            prediction60?.predictedAt ??
                              prediction120!.predictedAt
                          )}
                        </p>
                      )}
                    </div>
                  )}
                </section>
              </>
            )}

            {!loading && !segment && !error && (
              <p
                className="text-xs text-center"
                style={{ color: "var(--clay-text-muted)" }}
              >
                Segment not found
              </p>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

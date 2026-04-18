"use client";

/**
 * IntersectionPopup component
 * Floating popup triggered by intersection click on the map.
 * Requirements: 5.2
 *
 * Displays: signal phase (with colour indicator), last override timestamp,
 * and AI recommended timing.
 */

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ClayButton from "@/components/ui/ClayButton";
import ClayBadge from "@/components/ui/ClayBadge";
import { Zap } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type SignalPhase = "Green" | "Yellow" | "Red" | "Off";

interface SignalPhaseRecord {
  id: string;
  phaseState: SignalPhase;
  durationSeconds: number;
  sequenceOrder: number;
  isActive: boolean;
  appliedAt: string;
  source: string;
  aiConfidenceScore: number | null;
}

interface SignalDetail {
  id: string;
  label: string;
  currentPhase: SignalPhase;
  isOnline: boolean;
  overrideActive: boolean;
  overrideExpiresAt: string | null;
  aiOptimized: boolean;
  lastUpdatedAt: string;
  intersection: {
    id: string;
    name: string;
  };
  signalPhases: SignalPhaseRecord[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PHASE_COLORS: Record<SignalPhase, string> = {
  Green: "#22c55e",
  Yellow: "#eab308",
  Red: "#ef4444",
  Off: "#64748b",
};

const PHASE_BADGE_VARIANTS: Record<
  SignalPhase,
  "success" | "warning" | "danger" | "default"
> = {
  Green: "success",
  Yellow: "warning",
  Red: "danger",
  Off: "default",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface IntersectionPopupProps {
  intersectionId: string | null;
  onClose: () => void;
  mode?: 'monitor' | 'simulation';
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function IntersectionPopup({
  intersectionId,
  onClose,
}: IntersectionPopupProps) {
  const [signal, setSignal] = useState<SignalDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!intersectionId) {
      setSignal(null);
      setError(null);
      return;
    }

    let cancelled = false;

    async function fetchSignal() {
      setLoading(true);
      setError(null);

      try {
        // Fetch all signals to find the one for this intersection
        const listRes = await fetch("/api/signals");
        if (!listRes.ok) throw new Error("Failed to load signals");

        const signals: Array<{
          id: string;
          intersection: { id: string };
        }> = await listRes.json();

        if (cancelled) return;

        const match = signals.find((s) => s.intersection?.id === intersectionId);
        if (!match) {
          if (!cancelled) {
            setSignal(null);
            setError("No signal found for this intersection");
            setLoading(false);
          }
          return;
        }

        // Fetch full signal detail including phase history
        const detailRes = await fetch(`/api/signals/${match.id}`);
        if (!detailRes.ok) throw new Error("Failed to load signal detail");

        const detail: SignalDetail = await detailRes.json();
        if (!cancelled) {
          setSignal(detail);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unknown error");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchSignal();
    return () => {
      cancelled = true;
    };
  }, [intersectionId]);

  // Derive AI recommended timing from most recent ai_optimized phase
  const aiPhase = signal?.signalPhases.find((p) => p.source === "ai_optimized");

  // Derive last override timestamp
  const lastOverridePhase = signal?.signalPhases.find(
    (p) => p.source === "manual_override"
  );
  const lastOverrideAt =
    signal?.overrideExpiresAt ?? lastOverridePhase?.appliedAt ?? null;

  const phaseColor = signal
    ? (PHASE_COLORS[signal.currentPhase] ?? PHASE_COLORS.Off)
    : PHASE_COLORS.Off;

  return (
    <AnimatePresence>
      {intersectionId && (
        <motion.div
          key="intersection-popup"
          initial={{ opacity: 0, scale: 0.92, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 8 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className="absolute bottom-24 left-1/2 -translate-x-1/2 z-30 w-72"
          style={{
            background:
              "linear-gradient(135deg, var(--clay-surface-raised) 0%, var(--clay-surface) 100%)",
            border: "1px solid var(--clay-border)",
            borderRadius: "var(--clay-border-radius)",
            boxShadow: "var(--clay-shadow-lg)",
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3 border-b"
            style={{ borderColor: "var(--clay-border)" }}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: "var(--clay-accent)" }}
              />
              <h3
                className="text-sm font-bold truncate"
                style={{ color: "var(--clay-text)" }}
              >
                {loading
                  ? "Loading…"
                  : signal?.intersection.name ?? "Intersection"}
              </h3>
            </div>
            <ClayButton variant="ghost" size="sm" onClick={onClose}>
              ✕
            </ClayButton>
          </div>

          {/* Body */}
          <div className="px-4 py-3 flex flex-col gap-3">
            {error && (
              <p
                className="text-xs"
                style={{ color: "var(--clay-danger)" }}
              >
                {error}
              </p>
            )}

            {loading && (
              <div className="flex flex-col gap-2">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-8 rounded animate-pulse"
                    style={{ background: "var(--clay-border)" }}
                  />
                ))}
              </div>
            )}

            {!loading && signal && (
              <>
                {/* Signal Phase */}
                <div
                  className="flex items-center justify-between px-3 py-2 rounded"
                  style={{
                    background: `${phaseColor}18`,
                    border: `1px solid ${phaseColor}40`,
                    borderRadius: "var(--clay-border-radius-sm)",
                  }}
                >
                  <span
                    className="text-xs font-semibold"
                    style={{ color: "var(--clay-text-muted)" }}
                  >
                    Current Phase
                  </span>
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ background: phaseColor }}
                    />
                    <ClayBadge
                      variant={PHASE_BADGE_VARIANTS[signal.currentPhase]}
                      className="text-[10px]"
                    >
                      {signal.currentPhase}
                    </ClayBadge>
                  </div>
                </div>

                {/* Last Override */}
                <div
                  className="flex items-center justify-between px-3 py-2 rounded"
                  style={{
                    boxShadow: "var(--clay-shadow-inset)",
                    border: "1px solid var(--clay-border)",
                    borderRadius: "var(--clay-border-radius-sm)",
                  }}
                >
                  <span
                    className="text-xs"
                    style={{ color: "var(--clay-text-muted)" }}
                  >
                    Last Override
                  </span>
                  <span
                    className="text-xs font-medium"
                    style={{ color: "var(--clay-text)" }}
                  >
                    {lastOverrideAt ? formatTimestamp(lastOverrideAt) : "None"}
                  </span>
                </div>

                {/* AI Recommended Timing */}
                <div
                  className="flex items-center justify-between px-3 py-2 rounded"
                  style={{
                    boxShadow: "var(--clay-shadow-inset)",
                    border: "1px solid var(--clay-border)",
                    borderRadius: "var(--clay-border-radius-sm)",
                  }}
                >
                  <span
                    className="text-xs"
                    style={{ color: "var(--clay-text-muted)" }}
                  >
                    AI Timing
                  </span>
                  {aiPhase ? (
                    <div className="flex items-center gap-1.5">
                      <span
                        className="text-xs font-medium"
                        style={{ color: "var(--clay-text)" }}
                      >
                        {aiPhase.durationSeconds}s
                      </span>
                      {aiPhase.aiConfidenceScore != null && (
                        <ClayBadge variant="accent" className="text-[10px]">
                          {Math.round(Number(aiPhase.aiConfidenceScore) * 100)}%
                        </ClayBadge>
                      )}
                    </div>
                  ) : (
                    <span
                      className="text-xs"
                      style={{ color: "var(--clay-text-muted)" }}
                    >
                      Not available
                    </span>
                  )}
                </div>

                {/* Status badges */}
                {(signal.overrideActive || !signal.isOnline) && (
                  <div className="flex gap-2 flex-wrap">
                    {signal.overrideActive && (
                      <ClayBadge variant="warning" className="text-[10px]">
                        ⚡ Override Active
                      </ClayBadge>
                    )}
                    {!signal.isOnline && (
                      <ClayBadge variant="danger" className="text-[10px]">
                        ⚠ Offline
                      </ClayBadge>
                    )}
                  </div>
                )}
              </>
            )}

            {!loading && !signal && !error && (
              <p
                className="text-xs text-center font-medium mt-2"
                style={{ color: "var(--clay-text-muted)" }}
              >
                No signal data
              </p>
            )}
          </div>

          {/* Simulation Footer */}
          {!loading && signal && mode === 'simulation' && (
            <div className="px-4 pb-4">
              <ClayButton 
                variant="accent" 
                className="w-full text-xs font-bold gap-2 shadow-clay py-2 flex items-center justify-center"
                onClick={() => {
                  fetch('/api/simulation/optimize', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ intersectionId }),
                  }).catch(() => {});
                }}
              >
                <Zap size={14} fill="currentColor" />
                Optimize Flow (+50 XP)
              </ClayButton>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}


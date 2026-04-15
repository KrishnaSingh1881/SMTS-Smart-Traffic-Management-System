"use client";

/**
 * Signal Detail Page
 * Requirements: 2.2, 2.4, 2.5, 2.6
 */

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import ClayCard from "@/components/ui/ClayCard";
import ClayBadge from "@/components/ui/ClayBadge";
import SignalStatusRing from "@/components/signals/SignalStatusRing";
import SignalOverridePanel from "@/components/signals/SignalOverridePanel";
import type { SignalPhaseState } from "@prisma/client";

interface SignalPhase {
  id: string;
  phaseState: SignalPhaseState;
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
  intersectionId: string;
  currentPhase: SignalPhaseState;
  isOnline: boolean;
  overrideActive: boolean;
  overrideExpiresAt: string | null;
  aiOptimized: boolean;
  lastUpdatedAt: string;
  intersection: {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
  };
  signalPhases: SignalPhase[];
}

export default function SignalDetailPage() {
  const params = useParams();
  const signalId = params.signalId as string;

  const [signal, setSignal] = useState<SignalDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSignal = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/signals/${signalId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch signal");
      }
      const data = await response.json();
      setSignal(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSignal();
  }, [signalId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-[var(--clay-muted)]">Loading signal...</p>
      </div>
    );
  }

  if (error || !signal) {
    return (
      <ClayCard>
        <p className="text-center text-[var(--clay-danger)]">
          {error || "Signal not found"}
        </p>
      </ClayCard>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-[var(--clay-text)]">
          {signal.label}
        </h1>
        <p className="mt-2 text-sm text-[var(--clay-muted)]">
          {signal.intersection.name}
        </p>
      </div>

      {/* Offline Alert (Req 2.6) */}
      {!signal.isOnline && (
        <ClayCard className="border-[var(--clay-danger)] bg-[var(--clay-danger)]/10">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <h3 className="font-semibold text-[var(--clay-danger)]">
                Signal Offline
              </h3>
              <p className="text-sm text-[var(--clay-muted)]">
                This signal is currently unreachable. Last known state is
                displayed.
              </p>
            </div>
          </div>
        </ClayCard>
      )}

      {/* Current Status */}
      <ClayCard>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-[var(--clay-text)]">
              Current Status
            </h2>
            <div className="mt-4 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm text-[var(--clay-muted)]">Phase:</span>
                <ClayBadge variant="default">{signal.currentPhase}</ClayBadge>
              </div>
              <div className="flex flex-wrap gap-2">
                {signal.overrideActive && (
                  <ClayBadge variant="warning">Manual Override</ClayBadge>
                )}
                {signal.aiOptimized && !signal.overrideActive && (
                  <ClayBadge variant="accent">AI Optimized</ClayBadge>
                )}
              </div>
              <p className="text-xs text-[var(--clay-muted)]">
                Last updated: {new Date(signal.lastUpdatedAt).toLocaleString()}
              </p>
              {signal.overrideExpiresAt && (
                <p className="text-xs text-[var(--clay-warning)]">
                  Override expires:{" "}
                  {new Date(signal.overrideExpiresAt).toLocaleString()}
                </p>
              )}
            </div>
          </div>
          <SignalStatusRing phase={signal.currentPhase} size={80} />
        </div>
      </ClayCard>

      {/* Override Panel (Req 2.2, 2.4, 2.5) */}
      <SignalOverridePanel
        signalId={signal.id}
        currentPhase={signal.currentPhase}
        overrideActive={signal.overrideActive}
        isOnline={signal.isOnline}
        onOverrideChange={fetchSignal}
      />

      {/* Phase History */}
      <ClayCard>
        <h2 className="text-xl font-semibold text-[var(--clay-text)]">
          Phase History
        </h2>
        <div className="mt-4 space-y-3">
          {signal.signalPhases.length === 0 ? (
            <p className="text-sm text-[var(--clay-muted)]">
              No phase history available
            </p>
          ) : (
            signal.signalPhases.map((phase) => (
              <div
                key={phase.id}
                className="flex items-center justify-between border-b border-[var(--clay-border)] pb-3 last:border-b-0"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <ClayBadge variant="default">{phase.phaseState}</ClayBadge>
                    <span className="text-sm text-[var(--clay-muted)]">
                      {phase.durationSeconds}s
                    </span>
                    {phase.isActive && (
                      <ClayBadge variant="success">Active</ClayBadge>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-[var(--clay-muted)]">
                    Applied: {new Date(phase.appliedAt).toLocaleString()} •
                    Source: {phase.source}
                    {phase.aiConfidenceScore !== null &&
                      ` • Confidence: ${(phase.aiConfidenceScore * 100).toFixed(1)}%`}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </ClayCard>
    </div>
  );
}

"use client";

/**
 * SignalOverridePanel — Manual override controls
 * Requirements: 2.2, 2.4, 2.5, 2.6
 */

import { useState } from "react";
import ClayCard from "@/components/ui/ClayCard";
import ClayButton from "@/components/ui/ClayButton";
import ClayInput from "@/components/ui/ClayInput";
import type { SignalPhaseState } from "@prisma/client";

interface SignalOverridePanelProps {
  signalId: string;
  currentPhase: SignalPhaseState;
  overrideActive: boolean;
  isOnline: boolean;
  onOverrideChange: () => void;
}

const phaseOptions: SignalPhaseState[] = ["Green", "Yellow", "Red", "Off"];

export default function SignalOverridePanel({
  signalId,
  currentPhase,
  overrideActive,
  isOnline,
  onOverrideChange,
}: SignalOverridePanelProps) {
  const [selectedPhase, setSelectedPhase] =
    useState<SignalPhaseState>(currentPhase);
  const [duration, setDuration] = useState<number>(30);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Client-side validation (Req 2.5)
  const durationError =
    duration < 10 || duration > 180
      ? "Duration must be between 10 and 180 seconds"
      : null;

  const handleApplyOverride = async () => {
    if (durationError) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/signals/${signalId}/override`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phase: selectedPhase,
          duration_seconds: duration,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to apply override");
      }

      onOverrideChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelOverride = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/signals/${signalId}/override`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to cancel override");
      }

      onOverrideChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ClayCard>
      <h2 className="text-xl font-semibold text-[var(--clay-text)]">
        Manual Override
      </h2>

      {!isOnline && (
        <p className="mt-2 text-sm text-[var(--clay-danger)]">
          Signal is offline. Override controls are disabled.
        </p>
      )}

      <div className="mt-4 space-y-4">
        {/* Phase Selector */}
        <div>
          <label className="mb-2 block text-sm font-medium text-[var(--clay-text)]">
            Select Phase
          </label>
          <div className="grid grid-cols-4 gap-2">
            {phaseOptions.map((phase) => (
              <button
                key={phase}
                onClick={() => setSelectedPhase(phase)}
                disabled={!isOnline || isSubmitting}
                className={`rounded-clay border px-4 py-2 text-sm font-medium transition-all ${
                  selectedPhase === phase
                    ? "border-[var(--clay-accent)] bg-[var(--clay-accent)]/20 text-[var(--clay-accent)]"
                    : "border-[var(--clay-border)] bg-[var(--clay-surface)] text-[var(--clay-text)] hover:bg-[var(--clay-surface)]/80"
                } disabled:cursor-not-allowed disabled:opacity-50`}
              >
                {phase}
              </button>
            ))}
          </div>
        </div>

        {/* Duration Input */}
        <ClayInput
          type="number"
          label="Duration (seconds)"
          value={duration}
          onChange={(e) => setDuration(Number(e.target.value))}
          min={10}
          max={180}
          disabled={!isOnline || isSubmitting}
          error={durationError || undefined}
        />

        {/* Error Display */}
        {error && (
          <p className="text-sm text-[var(--clay-danger)]">{error}</p>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          {overrideActive ? (
            <ClayButton
              variant="danger"
              onClick={handleCancelOverride}
              disabled={!isOnline || isSubmitting}
              isLoading={isSubmitting}
            >
              Cancel Override
            </ClayButton>
          ) : (
            <ClayButton
              variant="primary"
              onClick={handleApplyOverride}
              disabled={!isOnline || isSubmitting || !!durationError}
              isLoading={isSubmitting}
            >
              Apply Override
            </ClayButton>
          )}
        </div>
      </div>
    </ClayCard>
  );
}

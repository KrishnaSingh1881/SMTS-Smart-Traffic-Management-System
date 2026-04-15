"use client";

/**
 * IncidentForm — Report new incident
 * Requirements: 4.2, 4.3
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import ClayCard from "@/components/ui/ClayCard";
import ClayButton from "@/components/ui/ClayButton";
import ClayInput from "@/components/ui/ClayInput";
import type { IncidentType } from "@prisma/client";

interface Segment {
  id: string;
  name: string;
}

export default function IncidentForm() {
  const router = useRouter();
  const [segments, setSegments] = useState<Segment[]>([]);
  const [isLoadingSegments, setIsLoadingSegments] = useState(true);

  const [segmentId, setSegmentId] = useState("");
  const [type, setType] = useState<IncidentType>("Accident");
  const [severity, setSeverity] = useState(3);
  const [description, setDescription] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);

  const incidentTypes: IncidentType[] = [
    "Accident",
    "Road_Closure",
    "Debris",
    "Flooding",
    "Other",
  ];

  // Fetch segments on mount
  useEffect(() => {
    async function fetchSegments() {
      try {
        const response = await fetch("/api/monitoring/segments");
        if (!response.ok) throw new Error("Failed to fetch segments");
        const data = await response.json();
        setSegments(data);
      } catch (err) {
        console.error("Error fetching segments:", err);
        setError("Failed to load segments");
      } finally {
        setIsLoadingSegments(false);
      }
    }

    fetchSegments();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!segmentId) {
      setError("Please select a segment");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          segment_id: segmentId,
          type,
          severity,
          description: description.trim() || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create incident");
      }

      // Show success toast
      setShowToast(true);

      // Redirect to incidents feed after 1 second
      setTimeout(() => {
        router.push("/incidents");
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <ClayCard>
        <h2 className="text-2xl font-bold text-[var(--clay-text)]">
          Report New Incident
        </h2>
        <p className="mt-2 text-sm text-[var(--clay-muted)]">
          Provide details about the traffic incident
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-6">
          {/* Segment Selector */}
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--clay-text)]">
              Road Segment <span className="text-[var(--clay-danger)]">*</span>
            </label>
            {isLoadingSegments ? (
              <p className="text-sm text-[var(--clay-muted)]">
                Loading segments...
              </p>
            ) : (
              <select
                value={segmentId}
                onChange={(e) => setSegmentId(e.target.value)}
                disabled={isSubmitting}
                className="w-full rounded-clay border border-[var(--clay-border)] bg-[var(--clay-surface)] px-4 py-2 text-[var(--clay-text)] shadow-clay-inset transition-all focus:border-[var(--clay-accent)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                required
              >
                <option value="">Select a segment</option>
                {segments.map((segment) => (
                  <option key={segment.id} value={segment.id}>
                    {segment.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Incident Type */}
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--clay-text)]">
              Incident Type <span className="text-[var(--clay-danger)]">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
              {incidentTypes.map((incidentType) => (
                <button
                  key={incidentType}
                  type="button"
                  onClick={() => setType(incidentType)}
                  disabled={isSubmitting}
                  className={`rounded-clay border px-4 py-2 text-sm font-medium transition-all ${
                    type === incidentType
                      ? "border-[var(--clay-accent)] bg-[var(--clay-accent)]/20 text-[var(--clay-accent)]"
                      : "border-[var(--clay-border)] bg-[var(--clay-surface)] text-[var(--clay-text)] hover:bg-[var(--clay-surface)]/80"
                  } disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  {incidentType.replace(/_/g, " ")}
                </button>
              ))}
            </div>
          </div>

          {/* Severity */}
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--clay-text)]">
              Severity: {severity}/5
            </label>
            <input
              type="range"
              min="1"
              max="5"
              value={severity}
              onChange={(e) => setSeverity(Number(e.target.value))}
              disabled={isSubmitting}
              className="w-full"
            />
            <div className="mt-1 flex justify-between text-xs text-[var(--clay-muted)]">
              <span>Minor</span>
              <span>Critical</span>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--clay-text)]">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSubmitting}
              rows={4}
              placeholder="Provide additional details about the incident..."
              className="w-full rounded-clay border border-[var(--clay-border)] bg-[var(--clay-surface)] px-4 py-2 text-[var(--clay-text)] shadow-clay-inset transition-all focus:border-[var(--clay-accent)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          {/* Error Display */}
          {error && (
            <div className="rounded-clay bg-[var(--clay-danger)]/10 px-4 py-3">
              <p className="text-sm text-[var(--clay-danger)]">{error}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <ClayButton
              type="submit"
              variant="primary"
              disabled={isSubmitting || !segmentId}
              isLoading={isSubmitting}
            >
              Submit Report
            </ClayButton>
            <ClayButton
              type="button"
              variant="secondary"
              onClick={() => router.push("/incidents")}
              disabled={isSubmitting}
            >
              Cancel
            </ClayButton>
          </div>
        </form>
      </ClayCard>

      {/* Success Toast */}
      {showToast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-clay bg-[var(--clay-success)] px-6 py-4 text-white shadow-lg">
          <p className="font-semibold">✓ Incident reported successfully!</p>
          <p className="mt-1 text-sm opacity-90">Redirecting to feed...</p>
        </div>
      )}
    </>
  );
}

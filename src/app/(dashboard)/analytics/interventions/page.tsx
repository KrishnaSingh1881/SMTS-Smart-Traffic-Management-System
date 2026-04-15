"use client";

/**
 * Interventions Analytics Page
 * Shows signal override and AI update history from audit log
 * Requirements: 7.4, 7.5
 */

import { useState, useEffect } from "react";
import ClayCard from "@/components/ui/ClayCard";
import ClayInput from "@/components/ui/ClayInput";
import ClayButton from "@/components/ui/ClayButton";
import ClayBadge from "@/components/ui/ClayBadge";
import type { InterventionRow } from "@/lib/db/queries/storedProcedures";

export default function InterventionsPage() {
  const [intersections, setIntersections] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedIntersectionId, setSelectedIntersectionId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [data, setData] = useState<InterventionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Load intersections on mount
  useEffect(() => {
    async function loadIntersections() {
      try {
        const res = await fetch("/api/signals");
        if (res.ok) {
          const signals = await res.json();
          const uniqueIntersections = Array.from(
            new Map(
              signals.map((s: { intersection: { id: string; name: string } }) => [
                s.intersection.id,
                s.intersection,
              ])
            ).values()
          );
          setIntersections(uniqueIntersections as Array<{ id: string; name: string }>);
          if (uniqueIntersections.length > 0) {
            setSelectedIntersectionId((uniqueIntersections[0] as { id: string }).id);
          }
        }
      } catch (err) {
        console.error("Failed to load intersections:", err);
      }
    }
    loadIntersections();

    // Set default date range (last 7 days)
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 7);
    setStartDate(start.toISOString().split("T")[0]);
    setEndDate(end.toISOString().split("T")[0]);
  }, []);

  async function handleFetch() {
    if (!selectedIntersectionId || !startDate || !endDate) {
      setError("Please select an intersection and date range");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        intersection_id: selectedIntersectionId,
        start_date: startDate,
        end_date: endDate,
      });

      const res = await fetch(`/api/analytics/interventions?${params}`);
      const result = await res.json();

      if (!res.ok) {
        setError(result.error || "Failed to fetch data");
        setData([]);
      } else {
        setData(result);
        setError("");
      }
    } catch (err) {
      setError("Network error. Please try again.");
      setData([]);
    } finally {
      setLoading(false);
    }
  }

  const actionLabels: Record<string, string> = {
    SIGNAL_OVERRIDE_APPLY: "Override Applied",
    SIGNAL_OVERRIDE_CANCEL: "Override Cancelled",
    SIGNAL_AI_UPDATE: "AI Update",
  };

  const actionVariants: Record<string, "warning" | "success" | "accent"> = {
    SIGNAL_OVERRIDE_APPLY: "warning",
    SIGNAL_OVERRIDE_CANCEL: "success",
    SIGNAL_AI_UPDATE: "accent",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-[var(--clay-text)]">
          Signal Interventions
        </h1>
        <p className="mt-2 text-sm text-[var(--clay-muted)]">
          View signal override and AI update history from audit logs
        </p>
      </div>

      <ClayCard>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div>
            <label className="text-sm font-medium text-[var(--clay-text)]">
              Intersection
            </label>
            <select
              value={selectedIntersectionId}
              onChange={(e) => setSelectedIntersectionId(e.target.value)}
              className="mt-1.5 w-full rounded-clay px-4 py-2.5 text-sm bg-[var(--clay-surface)] text-[var(--clay-text)] border border-[var(--clay-border)] shadow-clay-inset outline-none focus:ring-2 focus:ring-[var(--clay-accent)]/40"
            >
              {intersections.map((int) => (
                <option key={int.id} value={int.id}>
                  {int.name}
                </option>
              ))}
            </select>
          </div>

          <ClayInput
            label="Start Date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />

          <ClayInput
            label="End Date"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />

          <div className="flex items-end">
            <ClayButton
              onClick={handleFetch}
              isLoading={loading}
              className="w-full"
            >
              Load Data
            </ClayButton>
          </div>
        </div>

        {error && (
          <p className="mt-4 text-sm text-[var(--clay-danger)]">{error}</p>
        )}
      </ClayCard>

      {data.length > 0 && (
        <ClayCard>
          <h2 className="mb-4 text-xl font-semibold text-[var(--clay-text)]">
            Intervention History ({data.length} events)
          </h2>
          <div className="space-y-3">
            {data.map((row) => (
              <div
                key={row.audit_id}
                className="rounded-clay bg-[var(--clay-surface)] p-4 shadow-clay-inset border border-[var(--clay-border)]"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <ClayBadge variant={actionVariants[row.action] || "default"}>
                        {actionLabels[row.action] || row.action}
                      </ClayBadge>
                      <span className="text-sm text-[var(--clay-muted)]">
                        {new Date(row.created_at).toLocaleString()}
                      </span>
                    </div>
                    {row.metadata && (
                      <div className="mt-2 text-xs text-[var(--clay-muted)]">
                        <pre className="overflow-x-auto">
                          {JSON.stringify(row.metadata, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ClayCard>
      )}

      {!loading && data.length === 0 && !error && (
        <ClayCard>
          <p className="text-center text-[var(--clay-muted)]">
            Select an intersection and date range to view intervention history
          </p>
        </ClayCard>
      )}
    </div>
  );
}

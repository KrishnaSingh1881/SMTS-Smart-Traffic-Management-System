"use client";

/**
 * Peak Hours Analytics Page
 * Requirements: 7.3
 */

import { useState, useEffect } from "react";
import ClayCard from "@/components/ui/ClayCard";
import ClayInput from "@/components/ui/ClayInput";
import ClayButton from "@/components/ui/ClayButton";
import PeakHoursTable from "@/components/analytics/PeakHoursTable";
import type { PeakHourRow } from "@/lib/db/queries/storedProcedures";

export default function PeakHoursPage() {
  const [weekStart, setWeekStart] = useState("");
  const [data, setData] = useState<PeakHourRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Set default to current week start (Monday)
  useEffect(() => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Adjust to Monday
    const monday = new Date(today);
    monday.setDate(today.getDate() + diff);
    setWeekStart(monday.toISOString().split("T")[0]);
  }, []);

  async function handleFetch() {
    if (!weekStart) {
      setError("Please select a week start date");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        week_start: weekStart,
      });

      const res = await fetch(`/api/analytics/peak-hours?${params}`);
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-[var(--clay-text)]">
          Peak Hours Report
        </h1>
        <p className="mt-2 text-sm text-[var(--clay-muted)]">
          Top 5 most congested road segments for the selected week
        </p>
      </div>

      <ClayCard>
        <div className="flex flex-col gap-4 md:flex-row md:items-end">
          <div className="flex-1">
            <ClayInput
              label="Week Start (Monday)"
              type="date"
              value={weekStart}
              onChange={(e) => setWeekStart(e.target.value)}
            />
          </div>

          <ClayButton
            onClick={handleFetch}
            isLoading={loading}
            className="md:w-auto"
          >
            Load Report
          </ClayButton>
        </div>

        {error && (
          <p className="mt-4 text-sm text-[var(--clay-danger)]">{error}</p>
        )}
      </ClayCard>

      {data.length > 0 && (
        <ClayCard>
          <h2 className="mb-4 text-xl font-semibold text-[var(--clay-text)]">
            Top 5 Congested Segments
          </h2>
          <PeakHoursTable data={data} />
        </ClayCard>
      )}

      {!loading && data.length === 0 && !error && (
        <ClayCard>
          <p className="text-center text-[var(--clay-muted)]">
            Select a week to view the peak hours report
          </p>
        </ClayCard>
      )}
    </div>
  );
}

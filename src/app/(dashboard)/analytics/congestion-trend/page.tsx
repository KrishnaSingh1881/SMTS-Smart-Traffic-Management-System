"use client";

/**
 * Congestion Trend Analytics Page
 * Requirements: 7.2
 */

import { useState, useEffect } from "react";
import ClayCard from "@/components/ui/ClayCard";
import ClayInput from "@/components/ui/ClayInput";
import ClayButton from "@/components/ui/ClayButton";
import CongestionChart from "@/components/analytics/CongestionChart";
import type { CongestionTrendRow } from "@/lib/db/queries/storedProcedures";

export default function CongestionTrendPage() {
  const [segments, setSegments] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedSegmentId, setSelectedSegmentId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [data, setData] = useState<CongestionTrendRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Load segments on mount
  useEffect(() => {
    async function loadSegments() {
      try {
        const res = await fetch("/api/monitoring/segments");
        if (res.ok) {
          const segmentData = await res.json();
          setSegments(segmentData.map((s: { id: string; name: string }) => ({ id: s.id, name: s.name })));
          if (segmentData.length > 0) {
            setSelectedSegmentId(segmentData[0].id);
          }
        }
      } catch (err) {
        console.error("Failed to load segments:", err);
      }
    }
    loadSegments();

    // Set default date range (last 30 days)
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    setStartDate(start.toISOString().split("T")[0]);
    setEndDate(end.toISOString().split("T")[0]);
  }, []);

  async function handleFetch() {
    if (!selectedSegmentId || !startDate || !endDate) {
      setError("Please select a segment and date range");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        segment_id: selectedSegmentId,
        start_date: startDate,
        end_date: endDate,
      });

      const res = await fetch(`/api/analytics/congestion-trend?${params}`);
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
          Congestion Trend
        </h1>
        <p className="mt-2 text-sm text-[var(--clay-muted)]">
          View historical congestion patterns for road segments
        </p>
      </div>

      <ClayCard>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div>
            <label className="text-sm font-medium text-[var(--clay-text)]">
              Road Segment
            </label>
            <select
              value={selectedSegmentId}
              onChange={(e) => setSelectedSegmentId(e.target.value)}
              className="mt-1.5 w-full rounded-clay px-4 py-2.5 text-sm bg-[var(--clay-surface)] text-[var(--clay-text)] border border-[var(--clay-border)] shadow-clay-inset outline-none focus:ring-2 focus:ring-[var(--clay-accent)]/40"
            >
              {segments.map((seg) => (
                <option key={seg.id} value={seg.id}>
                  {seg.name}
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
            Trend Chart
          </h2>
          <CongestionChart data={data} />
        </ClayCard>
      )}

      {!loading && data.length === 0 && !error && (
        <ClayCard>
          <p className="text-center text-[var(--clay-muted)]">
            Select a segment and date range to view congestion trends
          </p>
        </ClayCard>
      )}
    </div>
  );
}

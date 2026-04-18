"use client";

/**
 * EventFeed — Right sidebar live feed of active incidents
 * Requirements: 12.1, 12.2, 12.3, 12.4
 *
 * - Fetches active incidents on mount from GET /api/incidents?status=Active
 * - Subscribes to incident:new, incident:update, incident:escalated SSE events
 * - Shows ESCALATED badge when incident has been Active for >2 minutes real time
 *   (proxy for >2 simulated hours per demo spec)
 * - Resolve button calls PATCH /api/incidents/[incidentId] with { action: "resolve" }
 */

import { useEffect, useRef, useState, useCallback } from "react";
import EventFeedItem, { type EventFeedIncident } from "./EventFeedItem";
import type { SSEEvent } from "@/lib/sse/emitter";

// 2 minutes real time = proxy for 2 simulated hours (demo purposes)
const ESCALATION_THRESHOLD_MS = 2 * 60 * 1000;

interface ApiIncident {
  id: string;
  segmentId: string;
  type: string;
  status: string;
  severity: number;
  description: string | null;
  createdAt: string;
  resolvedAt: string | null;
  segment?: { id: string; name: string } | null;
}

function toFeedIncident(raw: ApiIncident): EventFeedIncident {
  const ageMs = Date.now() - new Date(raw.createdAt).getTime();
  const escalated =
    raw.status === "Active" && ageMs > ESCALATION_THRESHOLD_MS;

  return {
    id: raw.id,
    segmentId: raw.segmentId,
    segmentName: raw.segment?.name,
    type: raw.type as EventFeedIncident["type"],
    status: raw.status,
    severity: raw.severity,
    description: raw.description,
    createdAt: raw.createdAt,
    resolvedAt: raw.resolvedAt,
    escalated,
  };
}

export default function EventFeed() {
  const [incidents, setIncidents] = useState<EventFeedIncident[]>([]);
  const [resolvingIds, setResolvingIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const escalationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Re-evaluate escalation status every 30 seconds
  const refreshEscalation = useCallback(() => {
    setIncidents((prev) =>
      prev.map((inc) => {
        if (inc.status !== "Active") return inc;
        const ageMs = Date.now() - new Date(inc.createdAt).getTime();
        const escalated = ageMs > ESCALATION_THRESHOLD_MS;
        if (escalated === inc.escalated) return inc;
        return { ...inc, escalated };
      })
    );
  }, []);

  // Fetch active incidents on mount
  useEffect(() => {
    let cancelled = false;

    async function fetchIncidents() {
      try {
        const res = await fetch("/api/incidents?status=Active");
        if (!res.ok) throw new Error("Failed to fetch incidents");
        const data: ApiIncident[] = await res.json();
        if (!cancelled) {
          setIncidents(data.map(toFeedIncident));
        }
      } catch (err) {
        console.error("[EventFeed] fetch error:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchIncidents();
    return () => {
      cancelled = true;
    };
  }, []);

  // Subscribe to SSE events
  useEffect(() => {
    const es = new EventSource("/api/monitoring/sse");

    es.onmessage = (e: MessageEvent) => {
      try {
        const event: SSEEvent = JSON.parse(e.data as string);

        if (event.type === "incident:new") {
          const payload = event.data as ApiIncident;
          if (payload.status === "Active") {
            setIncidents((prev) => {
              // avoid duplicates
              if (prev.some((i) => i.id === payload.id)) return prev;
              return [toFeedIncident(payload), ...prev];
            });
          }
        } else if (event.type === "incident:update") {
          const payload = event.data as Partial<ApiIncident> & { incidentId?: string };
          const id = payload.id ?? payload.incidentId;
          if (!id) return;

          setIncidents((prev) => {
            const idx = prev.findIndex((i) => i.id === id);
            if (idx === -1) return prev;

            const existing = prev[idx];
            const updated: EventFeedIncident = {
              ...existing,
              status: payload.status ?? existing.status,
              resolvedAt: payload.resolvedAt ?? existing.resolvedAt,
            };

            // Remove resolved incidents from the feed
            if (updated.status === "Resolved") {
              return prev.filter((i) => i.id !== id);
            }

            const next = [...prev];
            next[idx] = updated;
            return next;
          });
        } else if (event.type === "incident:escalated") {
          const payload = event.data as { incidentId?: string; id?: string };
          const id = payload.id ?? payload.incidentId;
          if (!id) return;

          setIncidents((prev) =>
            prev.map((i) => (i.id === id ? { ...i, escalated: true } : i))
          );
        }
      } catch {
        // ignore parse errors
      }
    };

    es.onerror = () => {
      // SSE will auto-reconnect; no action needed
    };

    return () => {
      es.close();
    };
  }, []);

  // Escalation timer
  useEffect(() => {
    escalationTimerRef.current = setInterval(refreshEscalation, 30_000);
    return () => {
      if (escalationTimerRef.current) clearInterval(escalationTimerRef.current);
    };
  }, [refreshEscalation]);

  const handleResolve = useCallback(async (incidentId: string) => {
    setResolvingIds((prev) => new Set(prev).add(incidentId));
    try {
      const res = await fetch(`/api/incidents/${incidentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resolve" }),
      });

      if (res.ok) {
        // Optimistically remove from feed; SSE incident:update will confirm
        setIncidents((prev) => prev.filter((i) => i.id !== incidentId));
      } else {
        console.error("[EventFeed] resolve failed:", res.status);
      }
    } catch (err) {
      console.error("[EventFeed] resolve error:", err);
    } finally {
      setResolvingIds((prev) => {
        const next = new Set(prev);
        next.delete(incidentId);
        return next;
      });
    }
  }, []);

  const activeIncidents = incidents.filter((i) => i.status !== "Resolved");

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--clay-border)]">
        <h2 className="text-sm font-semibold text-[var(--clay-text)]">
          Event Feed
        </h2>
        {activeIncidents.length > 0 && (
          <span className="inline-flex items-center justify-center rounded-full bg-[var(--clay-danger)]/20 text-[var(--clay-danger)] text-xs font-bold px-2 py-0.5 min-w-[1.5rem]">
            {activeIncidents.length}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {loading ? (
          <p className="text-xs text-[var(--clay-muted)] text-center py-6">
            Loading incidents…
          </p>
        ) : activeIncidents.length === 0 ? (
          <p className="text-xs text-[var(--clay-muted)] text-center py-6">
            No active incidents
          </p>
        ) : (
          activeIncidents.map((incident) => (
            <EventFeedItem
              key={incident.id}
              incident={incident}
              onResolve={handleResolve}
              isResolving={resolvingIds.has(incident.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

"use client";

/**
 * EventFeedItem — Single incident entry in the Event Feed
 * Requirements: 12.2, 12.4
 */

import ClayBadge from "@/components/ui/ClayBadge";
import ClayButton from "@/components/ui/ClayButton";
import type { IncidentType } from "@prisma/client";

export interface EventFeedIncident {
  id: string;
  segmentId: string;
  segmentName?: string;
  type: IncidentType;
  status: string;
  severity: number;
  description: string | null;
  createdAt: string;
  resolvedAt: string | null;
  escalated?: boolean;
}

interface EventFeedItemProps {
  incident: EventFeedIncident;
  onResolve: (incidentId: string) => void;
  isResolving?: boolean;
}

const TYPE_ICONS: Record<IncidentType, string> = {
  Accident: "🚗",
  Road_Closure: "🚧",
  Debris: "⚠️",
  Flooding: "🌊",
  Other: "📍",
};

function getSeverityVariant(
  severity: number
): "success" | "warning" | "danger" {
  if (severity <= 2) return "success";
  if (severity === 3) return "warning";
  return "danger";
}

function getSeverityLabel(severity: number): string {
  if (severity <= 2) return "Low";
  if (severity === 3) return "Medium";
  return "High";
}

function getElapsedTime(createdAt: string): string {
  const diffMs = Date.now() - new Date(createdAt).getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

export default function EventFeedItem({
  incident,
  onResolve,
  isResolving = false,
}: EventFeedItemProps) {
  const icon = TYPE_ICONS[incident.type] ?? "📍";
  const severityVariant = getSeverityVariant(incident.severity);
  const severityLabel = getSeverityLabel(incident.severity);
  const elapsed = getElapsedTime(incident.createdAt);
  const displayName = incident.segmentName ?? incident.segmentId;
  const typeLabel = incident.type.replace(/_/g, " ");

  return (
    <div
      className={`rounded-[var(--clay-border-radius)] border p-3 transition-all ${
        incident.escalated
          ? "border-[var(--clay-danger)] bg-[var(--clay-danger)]/5"
          : "border-[var(--clay-border)] bg-[var(--clay-surface)]"
      }`}
    >
      {/* Header row: icon + type + segment name */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg leading-none flex-shrink-0" aria-label={typeLabel}>
            {icon}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--clay-text)] truncate">
              {typeLabel}
            </p>
            <p className="text-xs text-[var(--clay-muted)] truncate">{displayName}</p>
          </div>
        </div>

        {/* Severity badge */}
        <ClayBadge variant={severityVariant} className="flex-shrink-0">
          {severityLabel}
        </ClayBadge>
      </div>

      {/* Time elapsed + escalated badge */}
      <div className="mt-2 flex items-center gap-2 flex-wrap">
        <span className="text-xs text-[var(--clay-muted)]">{elapsed}</span>
        {incident.escalated && (
          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--clay-danger)] px-2 py-0.5 text-xs font-bold text-white">
            ESCALATED
          </span>
        )}
      </div>

      {/* Resolve button */}
      <div className="mt-3">
        <ClayButton
          variant="secondary"
          size="sm"
          onClick={() => onResolve(incident.id)}
          isLoading={isResolving}
          disabled={isResolving}
          className="w-full text-xs"
        >
          Resolve
        </ClayButton>
      </div>
    </div>
  );
}

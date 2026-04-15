"use client";

/**
 * IncidentFeed — Sortable list of incident cards
 * Requirements: 4.1, 4.6
 */

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ClayCard from "@/components/ui/ClayCard";
import ClayBadge from "@/components/ui/ClayBadge";
import type { IncidentState } from "@/store/useTrafficStore";

interface IncidentFeedProps {
  incidents: IncidentState[];
}

type SortField = "createdAt" | "severity" | "type" | "status";
type SortOrder = "asc" | "desc";

export default function IncidentFeed({ incidents }: IncidentFeedProps) {
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  // Sort incidents
  const sortedIncidents = useMemo(() => {
    const sorted = [...incidents].sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case "createdAt":
          comparison =
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case "severity":
          comparison = a.severity - b.severity;
          break;
        case "type":
          comparison = a.type.localeCompare(b.type);
          break;
        case "status":
          comparison = a.status.localeCompare(b.status);
          break;
      }

      return sortOrder === "asc" ? comparison : -comparison;
    });

    return sorted;
  }, [incidents, sortField, sortOrder]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  // Compute elapsed time
  const getElapsedTime = (createdAt: string): string => {
    const now = Date.now();
    const created = new Date(createdAt).getTime();
    const diffMs = now - created;
    const diffMinutes = Math.floor(diffMs / 60000);

    if (diffMinutes < 60) {
      return `${diffMinutes}m ago`;
    }

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) {
      return `${diffHours}h ago`;
    }

    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  // Get badge variant for incident type
  const getTypeBadgeVariant = (
    type: string
  ): "default" | "success" | "warning" | "danger" | "accent" => {
    switch (type) {
      case "Accident":
        return "danger";
      case "Road_Closure":
        return "warning";
      case "Flooding":
        return "danger";
      case "Debris":
        return "warning";
      default:
        return "default";
    }
  };

  // Get badge variant for status
  const getStatusBadgeVariant = (
    status: string
  ): "default" | "success" | "warning" | "danger" | "accent" => {
    switch (status) {
      case "Active":
        return "warning";
      case "Resolved":
        return "success";
      case "Escalated":
        return "danger";
      default:
        return "default";
    }
  };

  return (
    <div className="space-y-4">
      {/* Sort Controls */}
      <div className="flex flex-wrap gap-2">
        <span className="text-sm text-[var(--clay-muted)]">Sort by:</span>
        {(["createdAt", "severity", "type", "status"] as SortField[]).map(
          (field) => (
            <button
              key={field}
              onClick={() => toggleSort(field)}
              className={`rounded-clay px-3 py-1 text-xs font-medium transition-all ${
                sortField === field
                  ? "bg-[var(--clay-accent)]/20 text-[var(--clay-accent)]"
                  : "bg-[var(--clay-surface)] text-[var(--clay-text)] hover:bg-[var(--clay-surface)]/80"
              }`}
            >
              {field === "createdAt" ? "Time" : field.charAt(0).toUpperCase() + field.slice(1)}
              {sortField === field && (sortOrder === "asc" ? " ↑" : " ↓")}
            </button>
          )
        )}
      </div>

      {/* Incident List */}
      {sortedIncidents.length === 0 ? (
        <ClayCard>
          <p className="text-center text-[var(--clay-muted)]">
            No incidents to display
          </p>
        </ClayCard>
      ) : (
        <AnimatePresence mode="popLayout">
          {sortedIncidents.map((incident) => (
            <motion.div
              key={incident.id}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
            >
              <ClayCard
                className={
                  incident.status === "Escalated"
                    ? "border-2 border-[var(--clay-danger)]"
                    : ""
                }
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold text-[var(--clay-text)]">
                        {incident.type.replace(/_/g, " ")}
                      </h3>
                      <ClayBadge variant={getTypeBadgeVariant(incident.type)}>
                        {incident.type.replace(/_/g, " ")}
                      </ClayBadge>
                    </div>
                    <p className="mt-1 text-sm text-[var(--clay-muted)]">
                      Segment ID: {incident.segmentId}
                    </p>
                    {incident.description && (
                      <p className="mt-2 text-sm text-[var(--clay-text)]">
                        {incident.description}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <ClayBadge variant={getStatusBadgeVariant(incident.status)}>
                      {incident.status}
                    </ClayBadge>
                    <span className="text-xs text-[var(--clay-muted)]">
                      Severity: {incident.severity}/5
                    </span>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between text-xs text-[var(--clay-muted)]">
                  <span>Created: {getElapsedTime(incident.createdAt)}</span>
                  {incident.resolvedAt && (
                    <span>
                      Resolved: {new Date(incident.resolvedAt).toLocaleString()}
                    </span>
                  )}
                </div>

                {/* Escalated indicator */}
                {incident.status === "Escalated" && (
                  <div className="mt-3 rounded-clay bg-[var(--clay-danger)]/10 px-3 py-2">
                    <p className="text-xs font-semibold text-[var(--clay-danger)]">
                      ⚠️ ESCALATED — Unresolved for more than 2 hours
                    </p>
                  </div>
                )}
              </ClayCard>
            </motion.div>
          ))}
        </AnimatePresence>
      )}
    </div>
  );
}

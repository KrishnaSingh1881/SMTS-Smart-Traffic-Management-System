/**
 * Typed wrappers for PostgreSQL stored procedures.
 * All functions use $queryRaw / $executeRaw to call DB-side logic directly.
 */

import { prisma } from "@/lib/db/prisma";
import type { CongestionLevel, IncidentType, IncidentStatus, AuditAction } from "@prisma/client";

// ─────────────────────────────────────────────
// Task 3.3 — escalate_overdue_incidents  (Req 4.6)
// ─────────────────────────────────────────────

/**
 * Calls the `escalate_overdue_incidents()` stored procedure.
 * Sets status = 'Escalated' for Active incidents older than 2 hours,
 * inserts INCIDENT_ESCALATE audit log rows, and returns the count escalated.
 */
export async function escalateOverdueIncidents(): Promise<number> {
  const result = await prisma.$queryRaw<[{ escalate_overdue_incidents: number }]>`
    SELECT escalate_overdue_incidents()
  `;
  return Number(result[0].escalate_overdue_incidents);
}

// ─────────────────────────────────────────────
// Task 3.4a — get_congestion_trend  (Req 7.2)
// ─────────────────────────────────────────────

export interface CongestionTrendRow {
  day: Date;
  avg_congestion: number;
  peak_vehicle_count: number;
  peak_hour: number;
}

export async function getCongestionTrend(
  segmentId: string,
  startDate: Date,
  endDate: Date
): Promise<CongestionTrendRow[]> {
  return prisma.$queryRaw<CongestionTrendRow[]>`
    SELECT
      day,
      avg_congestion::FLOAT,
      peak_vehicle_count,
      peak_hour
    FROM get_congestion_trend(
      ${segmentId}::UUID,
      ${startDate}::DATE,
      ${endDate}::DATE
    )
  `;
}

// ─────────────────────────────────────────────
// Task 3.4b — get_peak_hour_report  (Req 7.3)
// ─────────────────────────────────────────────

export interface PeakHourRow {
  segment_id: string;
  segment_name: string;
  avg_congestion: number;
  peak_vehicle_count: number;
  peak_hour: number;
}

export async function getPeakHourReport(weekStart: Date): Promise<PeakHourRow[]> {
  return prisma.$queryRaw<PeakHourRow[]>`
    SELECT
      segment_id::TEXT,
      segment_name,
      avg_congestion::FLOAT,
      peak_vehicle_count,
      peak_hour
    FROM get_peak_hour_report(${weekStart}::DATE)
  `;
}

// ─────────────────────────────────────────────
// Task 3.4c — get_intervention_report  (Req 7.4, 7.5)
// ─────────────────────────────────────────────

export interface InterventionRow {
  audit_id: string;
  action: AuditAction;
  signal_id: string | null;
  user_id: string;
  metadata: Record<string, unknown> | null;
  created_at: Date;
}

export async function getInterventionReport(
  intersectionId: string,
  startDate: Date,
  endDate: Date
): Promise<InterventionRow[]> {
  return prisma.$queryRaw<InterventionRow[]>`
    SELECT
      audit_id::TEXT,
      action,
      signal_id::TEXT,
      user_id::TEXT,
      metadata,
      created_at
    FROM get_intervention_report(
      ${intersectionId}::UUID,
      ${startDate}::DATE,
      ${endDate}::DATE
    )
  `;
}

// ─────────────────────────────────────────────
// Task 3.4d — get_incident_history  (Req 7.5, 7.6)
// ─────────────────────────────────────────────

export interface IncidentHistoryRow {
  incident_id: string;
  incident_type: IncidentType;
  status: IncidentStatus;
  severity: number;
  created_at: Date;
  resolved_at: Date | null;
  resolution_minutes: number | null;
  resolved_by_name: string | null;
}

export async function getIncidentHistory(
  segmentId: string,
  startDate: Date,
  endDate: Date
): Promise<IncidentHistoryRow[]> {
  return prisma.$queryRaw<IncidentHistoryRow[]>`
    SELECT
      incident_id::TEXT,
      incident_type,
      status,
      severity,
      created_at,
      resolved_at,
      resolution_minutes::FLOAT,
      resolved_by_name
    FROM get_incident_history(
      ${segmentId}::UUID,
      ${startDate}::DATE,
      ${endDate}::DATE
    )
  `;
}

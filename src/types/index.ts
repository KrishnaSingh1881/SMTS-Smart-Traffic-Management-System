/**
 * Shared TypeScript types for Smart Traffic Management System
 * Requirements: 9.1
 *
 * Exports string union types mirroring DB enums and interfaces
 * used across components and API routes.
 */

// ─────────────────────────────────────────────
// ENUM Types (mirroring Prisma/PostgreSQL enums)
// ─────────────────────────────────────────────

export type CongestionLevel = "Free" | "Moderate" | "Heavy" | "Gridlock";

export type IncidentType =
  | "Accident"
  | "Road_Closure"
  | "Debris"
  | "Flooding"
  | "Other";

export type SignalPhaseState = "Green" | "Yellow" | "Red" | "Off";

export type UserRole = "Traffic_Controller" | "Driver";

export type IncidentStatus = "Active" | "Resolved" | "Escalated";

export type AuditAction =
  | "SIGNAL_OVERRIDE_APPLY"
  | "SIGNAL_OVERRIDE_CANCEL"
  | "SIGNAL_AI_UPDATE"
  | "INCIDENT_CREATE"
  | "INCIDENT_RESOLVE"
  | "INCIDENT_ESCALATE"
  | "ACCOUNT_LOCKOUT"
  | "USER_LOGIN"
  | "USER_LOGOUT";

// ─────────────────────────────────────────────
// Core Entity Interfaces
// ─────────────────────────────────────────────

export interface Segment {
  id: string;
  name: string;
  geometry: string | null;
  lengthMeters: number;
  speedLimitKmh: number;
  currentCongestion: CongestionLevel;
  sensorOnline: boolean;
  lastObservationAt: string | null;
  createdAt: string;
}

export interface Signal {
  id: string;
  intersectionId: string;
  label: string;
  currentPhase: SignalPhaseState;
  isOnline: boolean;
  overrideActive: boolean;
  overrideExpiresAt: string | null;
  overrideByUserId: string | null;
  aiOptimized: boolean;
  lastAiUpdateAt: string | null;
  lastUpdatedAt: string;
  createdAt: string;
}

export interface Incident {
  id: string;
  segmentId: string;
  type: IncidentType;
  status: IncidentStatus;
  severity: number;
  description: string | null;
  reportedByUserId: string | null;
  resolvedByUserId: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Prediction {
  id: string;
  segmentId: string;
  predictedLevel: CongestionLevel;
  targetWindowMinutes: 60 | 120;
  modelConfidenceScore: number;
  predictedAt: string;
}

export interface Route {
  segments: string[]; // Array of segment IDs
  estimatedTravelTimeMinutes: number;
  affectedByIncident: boolean;
  incidentTypes?: IncidentType[];
}

export interface AuditEntry {
  id: string;
  action: AuditAction;
  userId: string;
  signalId: string | null;
  incidentId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

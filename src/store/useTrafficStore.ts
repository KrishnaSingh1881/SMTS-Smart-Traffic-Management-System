/**
 * Zustand store — global traffic state
 * Requirements: 1.3, 1.4
 *
 * Slices: segments, signals, incidents, predictions, system flags
 * Updated by SSEProvider when SSE events arrive from the server.
 */

import { create } from "zustand";
import type { CongestionLevel, IncidentStatus, IncidentType, SignalPhaseState } from "@prisma/client";

// ─────────────────────────────────────────────
// Slice types
// ─────────────────────────────────────────────

export interface SegmentState {
  id: string;
  name: string;
  currentCongestion: CongestionLevel;
  sensorOnline: boolean;
  lastObservationAt: string | null;
  vehicleCount?: number;
  avgSpeedKmh?: number;
}

export interface SignalState {
  id: string;
  label: string;
  intersectionId: string;
  currentPhase: SignalPhaseState;
  isOnline: boolean;
  overrideActive: boolean;
  overrideExpiresAt: string | null;
  aiOptimized: boolean;
  lastUpdatedAt: string;
}

export interface IncidentState {
  id: string;
  segmentId: string;
  type: IncidentType;
  status: IncidentStatus;
  severity: number;
  description: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export interface PredictionState {
  id: string;
  segmentId: string;
  predictedLevel: CongestionLevel;
  targetWindowMinutes: 60 | 120;
  modelConfidenceScore: number;
  predictedAt: string;
}

export interface SimulationState {
  optimizationScore: number;
  experiencePoints: number;
  activeWeather: 'Clear' | 'Rainy' | 'Foggy';
  lastEventTimestamp: string | null;
}

// ─────────────────────────────────────────────
// Store shape
// ─────────────────────────────────────────────

interface TrafficStore {
  // Data slices
  segments: Record<string, SegmentState>;
  signals: Record<string, SignalState>;
  incidents: Record<string, IncidentState>;
  predictions: Record<string, PredictionState[]>; // keyed by segmentId

  // Simulation state (for Simulator mode)
  simulation: SimulationState;

  // System flags
  aiDegraded: boolean;
  sseConnected: boolean;

  // Segment actions
  setSegments: (segments: SegmentState[]) => void;
  upsertSegment: (segment: SegmentState) => void;
  markSegmentOffline: (segmentId: string) => void;

  // Signal actions
  setSignals: (signals: SignalState[]) => void;
  upsertSignal: (signal: SignalState) => void;

  // Incident actions
  setIncidents: (incidents: IncidentState[]) => void;
  upsertIncident: (incident: IncidentState) => void;

  // Prediction actions
  setPredictions: (predictions: PredictionState[]) => void;
  upsertPredictions: (segmentId: string, predictions: PredictionState[]) => void;

  // Simulation actions
  updateOptimizationScore: (delta: number) => void;
  addXP: (amount: number) => void;
  setWeather: (weather: SimulationState['activeWeather']) => void;

  // System actions
  setAiDegraded: (degraded: boolean) => void;
  setSseConnected: (connected: boolean) => void;
}

// ─────────────────────────────────────────────
// Store implementation
// ─────────────────────────────────────────────

export const useTrafficStore = create<TrafficStore>((set) => ({
  segments: {},
  signals: {},
  incidents: {},
  predictions: {},
  simulation: {
    optimizationScore: 100,
    experiencePoints: 0,
    activeWeather: 'Clear',
    lastEventTimestamp: null,
  },
  aiDegraded: false,
  sseConnected: false,

  // Segment actions
  setSegments: (segments) =>
    set({
      segments: Object.fromEntries(segments.map((s) => [s.id, s])),
    }),

  upsertSegment: (segment) =>
    set((state) => ({
      segments: { ...state.segments, [segment.id]: segment },
    })),

  markSegmentOffline: (segmentId) =>
    set((state) => {
      const existing = state.segments[segmentId];
      if (!existing) return state;
      return {
        segments: {
          ...state.segments,
          [segmentId]: { ...existing, sensorOnline: false },
        },
      };
    }),

  // Signal actions
  setSignals: (signals) =>
    set({
      signals: Object.fromEntries(signals.map((s) => [s.id, s])),
    }),

  upsertSignal: (signal) =>
    set((state) => ({
      signals: { ...state.signals, [signal.id]: signal },
    })),

  // Incident actions
  setIncidents: (incidents) =>
    set({
      incidents: Object.fromEntries(incidents.map((i) => [i.id, i])),
    }),

  upsertIncident: (incident) =>
    set((state) => ({
      incidents: { ...state.incidents, [incident.id]: incident },
    })),

  // Prediction actions
  setPredictions: (predictions) => {
    const grouped: Record<string, PredictionState[]> = {};
    for (const p of predictions) {
      if (!grouped[p.segmentId]) grouped[p.segmentId] = [];
      grouped[p.segmentId].push(p);
    }
    set({ predictions: grouped });
  },

  upsertPredictions: (segmentId, predictions) =>
    set((state) => ({
      predictions: { ...state.predictions, [segmentId]: predictions },
    })),

  // Simulation actions
  updateOptimizationScore: (delta) =>
    set((state) => ({
      simulation: {
        ...state.simulation,
        optimizationScore: Math.max(0, Math.min(100, state.simulation.optimizationScore + delta)),
      },
    })),

  addXP: (amount) =>
    set((state) => ({
      simulation: {
        ...state.simulation,
        experiencePoints: state.simulation.experiencePoints + amount,
      },
    })),

  setWeather: (weather) =>
    set((state) => ({
      simulation: {
        ...state.simulation,
        activeWeather: weather,
      },
    })),

  // System actions
  setAiDegraded: (degraded) => set({ aiDegraded: degraded }),
  setSseConnected: (connected) => set({ sseConnected: connected }),
}));

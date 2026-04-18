/**
 * Zustand store — simulation state
 * Requirements: 8.7
 *
 * In-memory only (no persistence).
 */

import { create } from "zustand";
import type { SimulationState, SimulationStatus } from "@/lib/simulation/types";

// ─────────────────────────────────────────────
// Store shape
// ─────────────────────────────────────────────

interface SimulationStore {
  state: SimulationState;
  simulatedTime: string;
  speed: number;
  activeScenarios: string[];
  emergencyVehicleCount: number;

  setSimulationStatus: (status: SimulationStatus) => void;
  setSpeed: (speed: number) => void;
  setState: (state: SimulationState) => void;
}

// ─────────────────────────────────────────────
// Store implementation
// ─────────────────────────────────────────────

export const useSimulationStore = create<SimulationStore>((set) => ({
  state: "STOPPED",
  simulatedTime: "06:00",
  speed: 1,
  activeScenarios: [],
  emergencyVehicleCount: 0,

  setSimulationStatus: (status) =>
    set({
      state: status.state,
      simulatedTime: status.simulatedTime,
      speed: status.speed,
      activeScenarios: status.activeScenarios,
      emergencyVehicleCount: status.emergencyVehicleCount,
    }),

  setSpeed: (speed) => set({ speed }),

  setState: (state) => set({ state }),
}));

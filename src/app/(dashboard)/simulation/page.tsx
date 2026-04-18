"use client";

import { useEffect } from "react";
import { useTrafficStore, type SegmentState } from "@/store/useTrafficStore";
import { useSimulationStore } from "@/store/simulationStore";
import TrafficMap from "@/components/map/TrafficMap";
import SimulationControlPanel from "@/components/simulation/SimulationControlPanel";

export default function SimulationPage() {
  const segments = useTrafficStore((s) => Object.values(s.segments) as SegmentState[]);
  const simState = useSimulationStore((s) => s.state);
  const setSimulationStatus = useSimulationStore((s) => s.setSimulationStatus);

  // Auto-start the simulation at 2x speed for a smoother "game" experience
  useEffect(() => {
    if (simState === "STOPPED") {
      fetch("/api/simulation/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "play", speed: 2 }),
      })
        .then((r) => r.json())
        .then((data) => setSimulationStatus(data))
        .catch(() => {/* non-fatal */});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="absolute inset-x-0 bottom-0 top-0 overflow-hidden bg-black">
      <TrafficMap segments={segments} mode="simulation" />
      
      {/* Simulation-specific overlays could go here */}
      <div className="absolute bottom-20 left-6 z-[200]">
        <SimulationControlPanel />
      </div>
    </div>
  );
}

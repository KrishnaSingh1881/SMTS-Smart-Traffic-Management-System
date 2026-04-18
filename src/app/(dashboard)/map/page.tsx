"use client";

import { useEffect } from "react";
import { useTrafficStore, type SegmentState } from "@/store/useTrafficStore";
import { useSimulationStore } from "@/store/simulationStore";
import TrafficMap from "@/components/map/TrafficMap";
import SimulationControlPanel from "@/components/simulation/SimulationControlPanel";

export default function MapPage() {
  const segments = useTrafficStore((s) => Object.values(s.segments) as SegmentState[]);
  const simState = useSimulationStore((s) => s.state);
  const setSimulationStatus = useSimulationStore((s) => s.setSimulationStatus);

  // Auto-start the simulation at 5x speed when the map page first loads
  useEffect(() => {
    if (simState === "STOPPED") {
      fetch("/api/simulation/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "play", speed: 5 }),
      })
        .then((r) => r.json())
        .then((data) => setSimulationStatus(data))
        .catch(() => {/* non-fatal */});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // only on mount

  return (
    <div className="absolute inset-x-0 bottom-0 top-0 overflow-hidden bg-black">
      <TrafficMap segments={segments} />
      <SimulationControlPanel />
    </div>
  );
}

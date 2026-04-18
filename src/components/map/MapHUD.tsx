"use client";

/**
 * MapHUD — Top-left heads-up display overlay
 * Shows STMS logo, "Meridian City" label, and simulated clock.
 * Requirements: 19.6
 */

import { useSimulationStore } from "@/store/simulationStore";

export default function MapHUD() {
  const simulatedTime = useSimulationStore((s) => s.simulatedTime);

  return (
    <div
      className="absolute top-4 left-4 z-20 flex items-center gap-3 rounded-xl border border-white/10 px-4 py-2.5"
      style={{
        background: "rgba(0,0,0,0.72)",
        backdropFilter: "blur(14px)",
      }}
      aria-label="Map HUD"
    >
      {/* STMS logo mark */}
      <STMSLogo />

      {/* City + clock */}
      <div className="flex flex-col gap-0.5">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-white/40">
          Nashik
        </span>
        <span
          className="font-mono text-lg font-bold tracking-tight text-white tabular-nums leading-none"
          aria-label={`Simulated time ${simulatedTime}`}
        >
          {simulatedTime}
        </span>
      </div>
    </div>
  );
}

function STMSLogo() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 28 28"
      fill="none"
      aria-label="STMS logo"
      aria-hidden="false"
      role="img"
    >
      {/* Outer ring */}
      <circle cx="14" cy="14" r="13" stroke="#3b82f6" strokeWidth="1.5" opacity="0.6" />
      {/* Road cross */}
      <rect x="12.5" y="4" width="3" height="20" rx="1.5" fill="#3b82f6" opacity="0.8" />
      <rect x="4" y="12.5" width="20" height="3" rx="1.5" fill="#3b82f6" opacity="0.8" />
      {/* Centre dot */}
      <circle cx="14" cy="14" r="2.5" fill="#60a5fa" />
    </svg>
  );
}

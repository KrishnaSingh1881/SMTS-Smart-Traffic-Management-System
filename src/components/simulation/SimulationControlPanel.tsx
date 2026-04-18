"use client";

/**
 * SimulationControlPanel
 * Floating bottom-left panel for controlling the simulation.
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7
 */

import { useEffect, useState, useCallback } from "react";
import { cn } from "@/lib/utils/cn";
import { useSimulationStore } from "@/store/simulationStore";
import type { SimulationStatus } from "@/lib/simulation/types";
import EmergencyDispatchModal from "@/components/emergency/EmergencyDispatchModal";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type Speed = 1 | 5 | 10 | 30;

const SPEEDS: Speed[] = [1, 5, 10, 30];

type ScenarioOption = { label: string; value: string };

const SCENARIOS: ScenarioOption[] = [
  { label: "Rush Hour", value: "rush_hour" },
  { label: "Stadium Exodus", value: "stadium_exodus" },
  { label: "Major Accident", value: "major_accident" },
  { label: "Flash Flood", value: "flash_flood" },
];

// ─────────────────────────────────────────────
// API helpers
// ─────────────────────────────────────────────

async function postControl(body: {
  action: "play" | "pause" | "reset";
  speed?: number;
}): Promise<SimulationStatus | null> {
  try {
    const res = await fetch("/api/simulation/control", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    return (await res.json()) as SimulationStatus;
  } catch {
    return null;
  }
}

async function postScenario(scenario: string): Promise<boolean> {
  try {
    const res = await fetch("/api/simulation/scenario", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenario }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function postOptimizeAll(): Promise<{ optimized: number; total: number } | null> {
  try {
    const res = await fetch("/api/signals/optimize-all", { method: "POST" });
    if (!res.ok) return null;
    return (await res.json()) as { optimized: number; total: number };
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export default function SimulationControlPanel() {
  const { state, simulatedTime, speed, setSimulationStatus } =
    useSimulationStore();

  const [collapsed, setCollapsed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState("");
  const [scenarioLoading, setScenarioLoading] = useState(false);
  const [optimizeLoading, setOptimizeLoading] = useState(false);
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);

  // ── SSE subscription ──────────────────────────────────────────────────────
  useEffect(() => {
    const es = new EventSource("/api/simulation/stream");

    const handleMessage = (e: MessageEvent) => {
      try {
        const event = JSON.parse(e.data as string) as {
          type: string;
          data: SimulationStatus;
        };
        if (
          event.type === "simulation:tick" ||
          event.type === "simulation:state_change"
        ) {
          setSimulationStatus(event.data);
        }
      } catch {
        // ignore malformed events
      }
    };

    es.addEventListener("message", handleMessage);

    return () => {
      es.removeEventListener("message", handleMessage);
      es.close();
    };
  }, [setSimulationStatus]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handlePlayPause = useCallback(async () => {
    setLoading(true);
    const action = state === "RUNNING" ? "pause" : "play";
    const result = await postControl({ action });
    if (result) setSimulationStatus(result);
    setLoading(false);
  }, [state, setSimulationStatus]);

  const handleSpeedChange = useCallback(
    async (newSpeed: Speed) => {
      setLoading(true);
      const result = await postControl({ action: "play", speed: newSpeed });
      if (result) setSimulationStatus(result);
      setLoading(false);
    },
    [setSimulationStatus]
  );

  const handleReset = useCallback(async () => {
    setLoading(true);
    const result = await postControl({ action: "reset" });
    if (result) setSimulationStatus(result);
    setLoading(false);
  }, [setSimulationStatus]);

  const handleTriggerScenario = useCallback(async () => {
    if (!selectedScenario) return;
    setScenarioLoading(true);
    await postScenario(selectedScenario);
    setScenarioLoading(false);
    setSelectedScenario("");
  }, [selectedScenario]);

  const handleOptimizeAll = useCallback(async () => {
    setOptimizeLoading(true);
    await postOptimizeAll();
    setOptimizeLoading(false);
  }, []);

  // ── Derived UI state ──────────────────────────────────────────────────────

  const isRunning = state === "RUNNING";
  const stateColor =
    state === "RUNNING"
      ? "text-emerald-400"
      : state === "PAUSED"
      ? "text-amber-400"
      : "text-slate-400";

  return (
    <div
      className="absolute bottom-4 left-4 z-20 flex flex-col gap-0"
      aria-label="Simulation control panel"
    >
      {/* ── Expanded panel ─────────────────────────────────────────────────── */}
      {!collapsed && (
        <div
          className="rounded-xl border border-white/10 p-3 flex flex-col gap-3 min-w-[200px]"
          style={{
            background: "rgba(0,0,0,0.72)",
            backdropFilter: "blur(14px)",
          }}
        >
          {/* Header row */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-white/40">
              Simulation
            </span>
            <span className={cn("text-[10px] font-semibold uppercase", stateColor)}>
              {state}
            </span>
          </div>

          {/* Simulated clock */}
          <div className="flex items-center justify-center">
            <span
              className="font-mono text-3xl font-bold tracking-tight text-white tabular-nums"
              aria-label={`Simulated time ${simulatedTime}`}
            >
              {simulatedTime}
            </span>
          </div>

          {/* Play / Pause */}
          <button
            onClick={handlePlayPause}
            disabled={loading}
            aria-label={isRunning ? "Pause simulation" : "Play simulation"}
            className={cn(
              "flex items-center justify-center gap-2 w-full py-2 rounded-lg border text-sm font-semibold transition-all duration-150",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              isRunning
                ? "border-amber-500/50 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"
                : "border-emerald-500/50 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
            )}
          >
            {loading ? (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : isRunning ? (
              <>
                <PauseIcon />
                Pause
              </>
            ) : (
              <>
                <PlayIcon />
                Play
              </>
            )}
          </button>

          {/* Speed selector */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-white/40">
              Speed
            </span>
            <div className="grid grid-cols-4 gap-1">
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSpeedChange(s)}
                  disabled={loading}
                  aria-pressed={speed === s}
                  aria-label={`Set speed to ${s}x`}
                  className={cn(
                    "py-1.5 rounded-lg border text-xs font-semibold transition-all duration-150",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    speed === s
                      ? "border-blue-500/60 bg-blue-500/20 text-blue-300"
                      : "border-white/10 bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/70"
                  )}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>

          {/* Scenario selector */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-white/40">
              Scenario
            </span>
            <select
              value={selectedScenario}
              onChange={(e) => setSelectedScenario(e.target.value)}
              disabled={scenarioLoading}
              aria-label="Select scenario"
              className={cn(
                "w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white/70",
                "focus:outline-none focus:border-white/30 focus:bg-white/10",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "[&>option]:bg-[#0f1117] [&>option]:text-white"
              )}
            >
              <option value="">Select a scenario…</option>
              {SCENARIOS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            <button
              onClick={handleTriggerScenario}
              disabled={!selectedScenario || scenarioLoading}
              aria-label="Trigger selected scenario"
              className={cn(
                "flex items-center justify-center gap-2 w-full py-1.5 rounded-lg border text-xs font-semibold transition-all duration-150",
                "border-violet-500/50 bg-violet-500/10 text-violet-400 hover:bg-violet-500/20",
                "disabled:opacity-40 disabled:cursor-not-allowed"
              )}
            >
              {scenarioLoading ? (
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : null}
              Trigger
            </button>
          </div>

          {/* Reset button */}
          <button
            onClick={handleReset}
            disabled={loading}
            aria-label="Reset simulation"
            className={cn(
              "flex items-center justify-center gap-2 w-full py-1.5 rounded-lg border text-xs font-medium transition-all duration-150",
              "border-white/10 bg-white/5 text-white/50 hover:bg-red-500/10 hover:border-red-500/40 hover:text-red-400",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            <ResetIcon />
            Reset
          </button>

          {/* Optimise All Signals button */}
          <button
            onClick={handleOptimizeAll}
            disabled={optimizeLoading}
            aria-label="Optimise all signals"
            className={cn(
              "flex items-center justify-center gap-2 w-full py-1.5 rounded-lg border text-xs font-medium transition-all duration-150",
              "border-cyan-500/50 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            {optimizeLoading ? (
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <OptimizeIcon />
            )}
            Optimise All Signals
          </button>

          {/* Emergency button */}
          <button
            onClick={() => setShowEmergencyModal(true)}
            aria-label="Open emergency dispatch"
            className={cn(
              "flex items-center justify-center gap-2 w-full py-1.5 rounded-lg border text-xs font-medium transition-all duration-150",
              "border-red-500/50 bg-red-500/10 text-red-400 hover:bg-red-500/20"
            )}
          >
            🚨 Emergency
          </button>
        </div>
      )}

      {/* ── Collapse toggle ────────────────────────────────────────────────── */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        aria-label={collapsed ? "Expand simulation panel" : "Collapse simulation panel"}
        aria-expanded={!collapsed}
        className={cn(
          "self-start flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-all duration-150",
          "border border-white/10 bg-black/60 text-white/50 hover:text-white/80 hover:bg-black/80",
          collapsed ? "rounded-xl" : "rounded-b-xl border-t-0"
        )}
        style={{ backdropFilter: "blur(14px)" }}
      >
        {collapsed ? (
          <>
            <ChevronUpIcon />
            <span className="font-mono text-white/70">{simulatedTime}</span>
            <span className={cn("ml-1 text-[10px] font-semibold uppercase", stateColor)}>
              {state}
            </span>
          </>
        ) : (
          <>
            <ChevronDownIcon />
            <span>Collapse</span>
          </>
        )}
      </button>

      {/* ── Emergency Dispatch Modal ───────────────────────────────────────── */}
      <EmergencyDispatchModal
        isOpen={showEmergencyModal}
        onClose={() => setShowEmergencyModal(false)}
      />
    </div>
  );
}

// ─────────────────────────────────────────────
// Inline SVG icons (no external dependency)
// ─────────────────────────────────────────────

function PlayIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <polygon points="5,3 19,12 5,21" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <rect x="6" y="4" width="4" height="16" />
      <rect x="14" y="4" width="4" height="16" />
    </svg>
  );
}

function ResetIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 .49-4.95" />
    </svg>
  );
}

function ChevronUpIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="18 15 12 9 6 15" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function OptimizeIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
    </svg>
  );
}

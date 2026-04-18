"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils/cn";

export interface LayerVisibility {
  signals: boolean;
  incidents: boolean;
  predictions: boolean;
}

interface LayerTogglePanelProps {
  onVisibilityChange: (layers: LayerVisibility) => void;
}

interface ToggleConfig {
  key: keyof LayerVisibility;
  icon: string;
  label: string;
  activeColor: string;
}

const TOGGLES: ToggleConfig[] = [
  { key: "signals",     icon: "🚦", label: "Signals",     activeColor: "text-emerald-400 border-emerald-500/50 bg-emerald-500/10" },
  { key: "incidents",   icon: "⚠️", label: "Incidents",   activeColor: "text-amber-400 border-amber-500/50 bg-amber-500/10" },
  { key: "predictions", icon: "📊", label: "Predictions", activeColor: "text-blue-400 border-blue-500/50 bg-blue-500/10" },
];

export default function LayerTogglePanel({ onVisibilityChange }: LayerTogglePanelProps) {
  const [visibility, setVisibility] = useState<LayerVisibility>({
    signals: true,
    incidents: true,
    predictions: true,
  });

  useEffect(() => {
    onVisibilityChange(visibility);
  }, [visibility, onVisibilityChange]);

  function toggle(key: keyof LayerVisibility) {
    setVisibility(prev => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <div
      className="absolute top-4 right-4 z-10 flex flex-col gap-1.5 p-2.5 rounded-xl border border-white/10"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(12px)" }}
      aria-label="Layer toggles"
    >
      <p className="text-[10px] font-semibold uppercase tracking-widest text-white/40 px-1 pb-0.5">
        Layers
      </p>
      {TOGGLES.map(({ key, icon, label, activeColor }) => {
        const active = visibility[key];
        return (
          <button
            key={key}
            onClick={() => toggle(key)}
            aria-pressed={active}
            aria-label={`Toggle ${label} layer`}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all duration-150",
              active
                ? activeColor
                : "text-white/30 border-white/10 bg-white/5 hover:bg-white/10 hover:text-white/50"
            )}
          >
            <span className={cn("text-sm leading-none", !active && "grayscale opacity-40")}>
              {icon}
            </span>
            <span>{label}</span>
            <span
              className={cn(
                "ml-auto w-1.5 h-1.5 rounded-full transition-colors",
                active ? "bg-current" : "bg-white/20"
              )}
            />
          </button>
        );
      })}
    </div>
  );
}

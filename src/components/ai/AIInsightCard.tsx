"use client";

/**
 * AIInsightCard
 * Renders a single AI insight with trigger type badge and simulated time.
 * Requirements: 13.12
 */

import { cn } from "@/lib/utils/cn";
import type { AIInsight } from "@/lib/simulation/types";

// ─────────────────────────────────────────────
// TriggerBadge
// ─────────────────────────────────────────────

function TriggerBadge({ trigger }: { trigger: AIInsight["trigger"] }) {
  const styles: Record<AIInsight["trigger"], string> = {
    scheduled: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    scenario: "bg-violet-500/15 text-violet-400 border-violet-500/30",
    gridlock_alert: "bg-red-500/15 text-red-400 border-red-500/30",
    manual: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide border",
        styles[trigger]
      )}
    >
      {trigger.replace("_", " ")}
    </span>
  );
}

// ─────────────────────────────────────────────
// AIInsightCard
// ─────────────────────────────────────────────

export interface AIInsightCardProps {
  insight: AIInsight;
}

export default function AIInsightCard({ insight }: AIInsightCardProps) {
  return (
    <div className="rounded-lg border border-white/8 bg-white/4 p-3 flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <TriggerBadge trigger={insight.trigger} />
        <span className="font-mono text-[10px] text-white/30">{insight.simulatedTime}</span>
      </div>
      <p className="text-xs text-white/75 leading-relaxed">{insight.text}</p>
    </div>
  );
}

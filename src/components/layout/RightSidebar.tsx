"use client";

/**
 * RightSidebar — Collapsible right-edge panel
 * Contains AIAnalystPanel and EventFeed stacked vertically.
 * Requirements: 19.5
 */

import { useState } from "react";
import { cn } from "@/lib/utils/cn";
import AIAnalystPanel from "@/components/ai/AIAnalystPanel";
import EventFeed from "@/components/events/EventFeed";

export default function RightSidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div
      className="absolute top-0 right-0 h-full z-20 flex flex-row"
      aria-label="Right sidebar"
    >
      {/* Toggle button — sits on the left edge of the sidebar */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        aria-expanded={!collapsed}
        className={cn(
          "self-center flex items-center justify-center w-5 h-16 rounded-l-lg border border-r-0 border-white/10",
          "bg-black/60 text-white/40 hover:text-white/80 hover:bg-black/80 transition-all duration-150"
        )}
        style={{ backdropFilter: "blur(14px)" }}
      >
        {collapsed ? <ChevronLeftIcon /> : <ChevronRightIcon />}
      </button>

      {/* Sidebar panel */}
      {!collapsed && (
        <div
          className="flex flex-col w-72 h-full border-l border-white/10 overflow-hidden"
          style={{
            background: "rgba(0,0,0,0.72)",
            backdropFilter: "blur(14px)",
          }}
        >
          {/* AI Analyst — top half */}
          <div className="flex flex-col flex-1 min-h-0 border-b border-white/10 overflow-hidden">
            <AIAnalystPanel />
          </div>

          {/* Event Feed — bottom half */}
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <EventFeed />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function ChevronLeftIcon() {
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
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function ChevronRightIcon() {
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
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

"use client";

/**
 * Congestion Chart with GSAP ScrollTrigger animation
 * Requirements: 7.2
 */

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { CongestionTrendRow } from "@/lib/db/queries/storedProcedures";

// Register GSAP plugin
if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

interface CongestionChartProps {
  data: CongestionTrendRow[];
}

const congestionColors: Record<number, string> = {
  0: "var(--clay-success)", // Free
  1: "var(--clay-warning)", // Moderate
  2: "var(--clay-danger)",  // Heavy
  3: "#8B0000",             // Gridlock
};

export default function CongestionChart({ data }: CongestionChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const barsRef = useRef<HTMLDivElement[]>([]);

  useEffect(() => {
    if (!chartRef.current || data.length === 0) return;

    // Clear previous animations
    ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
    barsRef.current = [];

    // Animate bars as they enter viewport
    const bars = chartRef.current.querySelectorAll(".chart-bar");
    
    bars.forEach((bar, index) => {
      gsap.fromTo(
        bar,
        {
          scaleY: 0,
          opacity: 0,
        },
        {
          scaleY: 1,
          opacity: 1,
          duration: 0.6,
          ease: "power2.out",
          delay: index * 0.05,
          scrollTrigger: {
            trigger: chartRef.current,
            start: "top 80%",
            toggleActions: "play none none none",
          },
        }
      );
    });

    return () => {
      ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
    };
  }, [data]);

  if (data.length === 0) {
    return (
      <p className="text-center text-[var(--clay-muted)]">No data available</p>
    );
  }

  // Calculate max values for scaling
  const maxCongestion = Math.max(...data.map((d) => d.avg_congestion));
  const maxVehicles = Math.max(...data.map((d) => d.peak_vehicle_count));

  return (
    <div ref={chartRef} className="space-y-8">
      {/* Average Congestion Chart */}
      <div>
        <h3 className="mb-4 text-lg font-semibold text-[var(--clay-text)]">
          Average Congestion Level
        </h3>
        <div className="flex items-end gap-2 overflow-x-auto pb-4">
          {data.map((row, index) => {
            const height = maxCongestion > 0 ? (row.avg_congestion / maxCongestion) * 200 : 0;
            const congestionLevel = Math.round(row.avg_congestion);
            const color = congestionColors[congestionLevel] || congestionColors[0];

            return (
              <div key={index} className="flex flex-col items-center gap-2 min-w-[60px]">
                <div className="relative flex items-end h-[200px]">
                  <div
                    className="chart-bar w-12 rounded-t-lg origin-bottom"
                    style={{
                      height: `${height}px`,
                      backgroundColor: color,
                    }}
                  />
                </div>
                <div className="text-xs text-center text-[var(--clay-muted)]">
                  {new Date(row.day).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </div>
                <div className="text-xs font-semibold text-[var(--clay-text)]">
                  {row.avg_congestion.toFixed(1)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Peak Vehicle Count Chart */}
      <div>
        <h3 className="mb-4 text-lg font-semibold text-[var(--clay-text)]">
          Peak Vehicle Count
        </h3>
        <div className="flex items-end gap-2 overflow-x-auto pb-4">
          {data.map((row, index) => {
            const height = maxVehicles > 0 ? (row.peak_vehicle_count / maxVehicles) * 200 : 0;

            return (
              <div key={index} className="flex flex-col items-center gap-2 min-w-[60px]">
                <div className="relative flex items-end h-[200px]">
                  <div
                    className="chart-bar w-12 rounded-t-lg origin-bottom"
                    style={{
                      height: `${height}px`,
                      backgroundColor: "var(--clay-accent)",
                    }}
                  />
                </div>
                <div className="text-xs text-center text-[var(--clay-muted)]">
                  {new Date(row.day).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </div>
                <div className="text-xs font-semibold text-[var(--clay-text)]">
                  {row.peak_vehicle_count}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Peak Hours Summary */}
      <div>
        <h3 className="mb-4 text-lg font-semibold text-[var(--clay-text)]">
          Peak Hours
        </h3>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
          {data.map((row, index) => (
            <div
              key={index}
              className="rounded-clay bg-[var(--clay-surface)] p-3 shadow-clay-inset border border-[var(--clay-border)]"
            >
              <div className="text-xs text-[var(--clay-muted)]">
                {new Date(row.day).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </div>
              <div className="mt-1 text-lg font-bold text-[var(--clay-text)]">
                {row.peak_hour}:00
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

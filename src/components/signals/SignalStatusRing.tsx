"use client";

/**
 * SignalStatusRing — GSAP animated circular ring
 * Requirements: 2.1, 2.3
 */

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import type { SignalPhaseState } from "@prisma/client";

interface SignalStatusRingProps {
  phase: SignalPhaseState;
  size?: number;
}

const phaseConfig: Record<
  SignalPhaseState,
  { color: string; rotation: number }
> = {
  Green: { color: "#10b981", rotation: 0 },
  Yellow: { color: "#f59e0b", rotation: 90 },
  Red: { color: "#ef4444", rotation: 180 },
  Off: { color: "#6b7280", rotation: 270 },
};

export default function SignalStatusRing({
  phase,
  size = 64,
}: SignalStatusRingProps) {
  const ringRef = useRef<SVGCircleElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ringRef.current || !containerRef.current) return;

    const config = phaseConfig[phase];

    // Animate ring color and rotation with GSAP
    gsap.to(ringRef.current, {
      stroke: config.color,
      duration: 0.5,
      ease: "power2.out",
    });

    gsap.to(containerRef.current, {
      rotation: config.rotation,
      duration: 0.6,
      ease: "power2.inOut",
    });
  }, [phase]);

  const config = phaseConfig[phase];
  const strokeWidth = size / 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <div
      ref={containerRef}
      style={{ width: size, height: size }}
      className="relative flex items-center justify-center"
    >
      <svg width={size} height={size} className="absolute">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--clay-border)"
          strokeWidth={strokeWidth}
          opacity={0.2}
        />
        <circle
          ref={ringRef}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={config.color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * 0.25}
          strokeLinecap="round"
          style={{
            transformOrigin: "center",
            transform: "rotate(-90deg)",
          }}
        />
      </svg>
      <span
        className="relative text-xs font-bold"
        style={{ color: config.color }}
      >
        {phase[0]}
      </span>
    </div>
  );
}

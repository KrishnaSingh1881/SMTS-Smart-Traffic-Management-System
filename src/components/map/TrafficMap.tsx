"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { SegmentState } from "@/store/useTrafficStore";

interface TrafficMapProps {
  segments: SegmentState[];
}

const NODES: Record<string, { x: number; y: number }> = {
  A: { x: 120, y: 80  },
  B: { x: 320, y: 80  },
  C: { x: 520, y: 80  },
  D: { x: 80,  y: 230 },
  E: { x: 240, y: 230 },
  F: { x: 400, y: 230 },
  G: { x: 560, y: 230 },
  H: { x: 120, y: 370 },
  I: { x: 300, y: 370 },
  J: { x: 480, y: 370 },
  K: { x: 200, y: 470 },
  L: { x: 400, y: 470 },
};

const EDGES: { id: string; from: string; to: string; name: string }[] = [
  { id: "e0",  from: "A", to: "B", name: "North Corridor"   },
  { id: "e1",  from: "B", to: "C", name: "Airport Rd"       },
  { id: "e2",  from: "A", to: "D", name: "West Ave"         },
  { id: "e3",  from: "A", to: "E", name: "Central Link"     },
  { id: "e4",  from: "B", to: "E", name: "NE Connector"     },
  { id: "e5",  from: "B", to: "F", name: "Market Approach"  },
  { id: "e6",  from: "C", to: "G", name: "East Bypass"      },
  { id: "e7",  from: "D", to: "H", name: "South West Rd"    },
  { id: "e8",  from: "E", to: "F", name: "Main St"          },
  { id: "e9",  from: "E", to: "I", name: "Central South"    },
  { id: "e10", from: "F", to: "G", name: "Ring Rd East"     },
  { id: "e11", from: "F", to: "J", name: "Industrial Link"  },
  { id: "e12", from: "G", to: "J", name: "East Industrial"  },
  { id: "e13", from: "H", to: "I", name: "South Corridor"   },
  { id: "e14", from: "I", to: "J", name: "South East"       },
  { id: "e15", from: "H", to: "K", name: "Suburb West"      },
  { id: "e16", from: "I", to: "K", name: "Suburb Central"   },
  { id: "e17", from: "I", to: "L", name: "Suburb East"      },
  { id: "e18", from: "J", to: "L", name: "Suburb Industrial"},
];

type CongestionLevel = "free" | "moderate" | "heavy" | "gridlock";

interface EdgeState {
  congestion: CongestionLevel;
  vehicles: number;
  speed: number;
  online: boolean;
}

const COLORS: Record<CongestionLevel, string> = {
  free:     "#22c55e",
  moderate: "#f59e0b",
  heavy:    "#ef4444",
  gridlock: "#dc2626",
};
const OFFLINE_COLOR = "#64748b";

const STROKE_WIDTH: Record<CongestionLevel, number> = {
  free: 4, moderate: 5, heavy: 6, gridlock: 7,
};

// Node color = worst congestion of connected edges
function getNodeColor(nodeId: string, edgeStates: Record<string, EdgeState>): string {
  const connected = EDGES.filter(e => e.from === nodeId || e.to === nodeId);
  const levels: CongestionLevel[] = ["free", "moderate", "heavy", "gridlock"];
  let worst: CongestionLevel = "free";
  for (const e of connected) {
    const state = edgeStates[e.id];
    if (!state || !state.online) continue;
    if (levels.indexOf(state.congestion) > levels.indexOf(worst)) {
      worst = state.congestion;
    }
  }
  return COLORS[worst];
}

function randomEdgeState(hour: number): EdgeState {
  const isRush = (hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19);
  const isNight = hour >= 23 || hour <= 5;
  const weights = isNight ? [70,20,8,2] : isRush ? [5,20,45,30] : [30,40,20,10];
  const r = Math.random() * 100;
  let congestion: CongestionLevel;
  if (r < weights[0]) congestion = "free";
  else if (r < weights[0]+weights[1]) congestion = "moderate";
  else if (r < weights[0]+weights[1]+weights[2]) congestion = "heavy";
  else congestion = "gridlock";

  let vehicles: number, speed: number;
  switch (congestion) {
    case "free":     vehicles = Math.floor(Math.random()*18)+1;  speed = Math.floor(Math.random()*20)+50; break;
    case "moderate": vehicles = Math.floor(Math.random()*29)+20; speed = Math.floor(Math.random()*20)+30; break;
    case "heavy":    vehicles = Math.floor(Math.random()*29)+50; speed = Math.floor(Math.random()*15)+15; break;
    case "gridlock": vehicles = Math.floor(Math.random()*20)+80; speed = Math.floor(Math.random()*10)+3;  break;
  }
  return { congestion, vehicles, speed, online: Math.random() > 0.05 };
}

function initEdgeStates(): Record<string, EdgeState> {
  const hour = new Date().getHours();
  return Object.fromEntries(EDGES.map(e => [e.id, randomEdgeState(hour)]));
}

export default function TrafficMap({ segments }: TrafficMapProps) {
  const [edgeStates, setEdgeStates] = useState<Record<string, EdgeState>>(initEdgeStates);
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Merge real segment data into edge states when available
  useEffect(() => {
    if (segments.length === 0) return;
    setEdgeStates(prev => {
      const next = { ...prev };
      EDGES.forEach((edge, i) => {
        const seg = segments[i % segments.length];
        if (!seg) return;
        next[edge.id] = {
          congestion: seg.currentCongestion as CongestionLevel,
          vehicles: seg.vehicleCount ?? prev[edge.id]?.vehicles ?? 0,
          speed: seg.avgSpeedKmh ?? prev[edge.id]?.speed ?? 0,
          online: seg.sensorOnline,
        };
      });
      return next;
    });
  }, [segments]);

  // Simulate updates every 30s
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      const hour = new Date().getHours();
      setEdgeStates(prev => {
        const next = { ...prev };
        // Only update ~40% of edges per cycle for realistic gradual change
        EDGES.forEach(e => {
          if (Math.random() < 0.4) next[e.id] = randomEdgeState(hour);
        });
        return next;
      });
      setTick(t => t + 1);
    }, 30_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  const selectedEdge = EDGES.find(e => e.id === selected);
  const selectedState = selected ? edgeStates[selected] : null;

  return (
    <div className="flex gap-4 flex-1" style={{ minHeight: 500 }}>
      {/* SVG Map */}
      <div className="flex-1 relative rounded-[var(--clay-border-radius-lg)] border border-[var(--clay-border)] shadow-clay-lg overflow-hidden"
        style={{ background: "linear-gradient(135deg, var(--clay-surface-raised) 0%, var(--clay-surface) 100%)" }}>

        {/* Dot grid bg */}
        <svg className="absolute inset-0 w-full h-full" style={{ opacity: 0.06 }}>
          <defs>
            <pattern id="dots" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1.5" fill="currentColor" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dots)" />
        </svg>

        {/* Tick indicator */}
        <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium"
          style={{ background: "var(--clay-surface)", border: "1px solid var(--clay-border)", color: "var(--clay-text-muted)" }}>
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          Live · cycle {tick}
        </div>

        <svg viewBox="0 0 660 540" className="w-full h-full" style={{ minHeight: 420 }}>
          <defs>
            {/* Glow filters per color */}
            {Object.entries(COLORS).map(([level, color]) => (
              <filter key={level} id={`glow-${level}`} x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feFlood floodColor={color} floodOpacity="0.6" result="color" />
                <feComposite in="color" in2="blur" operator="in" result="glow" />
                <feMerge><feMergeNode in="glow" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            ))}
          </defs>

          {/* Edges */}
          {EDGES.map(edge => {
            const from = NODES[edge.from];
            const to = NODES[edge.to];
            const state = edgeStates[edge.id];
            const color = state?.online ? COLORS[state.congestion] : OFFLINE_COLOR;
            const sw = state?.online ? STROKE_WIDTH[state.congestion] : 3;
            const isHov = hovered === edge.id;
            const isSel = selected === edge.id;
            const isGridlock = state?.congestion === "gridlock" && state.online;

            return (
              <g key={edge.id}>
                {/* Road casing */}
                <line x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                  stroke="rgba(0,0,0,0.2)" strokeWidth={sw + 4} strokeLinecap="round" />
                {/* Road surface */}
                <line x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                  stroke="rgba(100,116,139,0.3)" strokeWidth={sw + 1} strokeLinecap="round" />
                {/* Congestion color */}
                <motion.line
                  x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                  stroke={color}
                  strokeWidth={isHov || isSel ? sw + 2.5 : sw}
                  strokeLinecap="round"
                  animate={{ stroke: color }}
                  transition={{ duration: 0.6 }}
                  style={{
                    cursor: "pointer",
                    filter: isSel ? `url(#glow-${state?.congestion ?? "free"})` : undefined,
                    opacity: state?.online === false ? 0.4 : 1,
                  }}
                  onMouseEnter={() => setHovered(edge.id)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => setSelected(selected === edge.id ? null : edge.id)}
                />
                {/* Gridlock animated dash */}
                {isGridlock && (
                  <motion.line
                    x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                    stroke="#fff" strokeWidth={1.5} strokeLinecap="round"
                    strokeDasharray="6 14"
                    animate={{ strokeDashoffset: [0, -40] }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    style={{ opacity: 0.35, pointerEvents: "none" }}
                  />
                )}
                {/* Hover label */}
                {isHov && (() => {
                  const mx = (from.x + to.x) / 2;
                  const my = (from.y + to.y) / 2 - 14;
                  return (
                    <g style={{ pointerEvents: "none" }}>
                      <rect x={mx - 48} y={my - 11} width={96} height={18} rx={5}
                        fill="#1e2433" stroke={color} strokeWidth={1} opacity={0.92} />
                      <text x={mx} y={my + 3} textAnchor="middle" fontSize={8.5}
                        fontWeight="600" fill={color}>{edge.name}</text>
                    </g>
                  );
                })()}
              </g>
            );
          })}

          {/* Nodes */}
          {Object.entries(NODES).map(([id, node]) => {
            const nodeColor = getNodeColor(id, edgeStates);
            return (
              <g key={id}>
                <circle cx={node.x+1} cy={node.y+1} r={12} fill="rgba(0,0,0,0.25)" />
                <circle cx={node.x} cy={node.y} r={12}
                  fill="#1e2433" stroke={nodeColor} strokeWidth={2.5} />
                <circle cx={node.x} cy={node.y} r={8}
                  fill={nodeColor} opacity={0.2} />
                <text x={node.x} y={node.y + 4} textAnchor="middle"
                  fontSize={8} fontWeight="800" fill={nodeColor}>{id}</text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Side panel */}
      <div className="w-72 flex flex-col gap-3 overflow-hidden">
        <AnimatePresence mode="wait">
          {selected && selectedEdge && selectedState ? (
            <motion.div key={selected}
              initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }} transition={{ duration: 0.18 }}
              className="rounded-[var(--clay-border-radius)] shadow-clay border border-[var(--clay-border)] p-5 flex flex-col gap-4"
              style={{ background: "linear-gradient(135deg, var(--clay-surface-raised), var(--clay-surface))" }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-sm" style={{ color: "var(--clay-text)" }}>{selectedEdge.name}</h3>
                  <p className="text-[10px] mt-0.5" style={{ color: "var(--clay-text-muted)" }}>
                    {selectedEdge.from} → {selectedEdge.to}
                  </p>
                </div>
                <button onClick={() => setSelected(null)}
                  className="text-lg leading-none" style={{ color: "var(--clay-text-muted)" }}>×</button>
              </div>

              {/* Congestion pill */}
              <div className="flex items-center gap-2 px-3 py-2 rounded-[var(--clay-border-radius-sm)]"
                style={{ background: `${COLORS[selectedState.congestion]}18`, border: `1px solid ${COLORS[selectedState.congestion]}40` }}>
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[selectedState.congestion] }} />
                <span className="text-xs font-bold capitalize" style={{ color: COLORS[selectedState.congestion] }}>
                  {selectedState.congestion}
                </span>
                {!selectedState.online && (
                  <span className="ml-auto text-[10px] font-medium" style={{ color: "var(--clay-danger)" }}>⚠ Offline</span>
                )}
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Vehicles", value: selectedState.vehicles },
                  { label: "Avg Speed", value: `${selectedState.speed} km/h` },
                  { label: "Sensor", value: selectedState.online ? "Online" : "Offline" },
                  { label: "Flow", value: selectedState.vehicles > 60 ? "Congested" : "Normal" },
                ].map(stat => (
                  <div key={stat.label} className="px-3 py-2 rounded-[var(--clay-border-radius-sm)]"
                    style={{ boxShadow: "var(--clay-shadow-inset)", border: "1px solid var(--clay-border)" }}>
                    <p className="text-[10px]" style={{ color: "var(--clay-text-muted)" }}>{stat.label}</p>
                    <p className="text-sm font-bold" style={{ color: "var(--clay-text)" }}>{String(stat.value)}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          ) : (
            <motion.div key="hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="rounded-[var(--clay-border-radius)] shadow-clay-sm border border-[var(--clay-border)] p-4 text-center"
              style={{ background: "var(--clay-surface)" }}>
              <p className="text-xs" style={{ color: "var(--clay-text-muted)" }}>Click a road to see details</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Road list */}
        <div className="flex-1 overflow-y-auto flex flex-col gap-1.5 pr-0.5">
          {EDGES.map(edge => {
            const state = edgeStates[edge.id];
            const color = state?.online ? COLORS[state.congestion] : OFFLINE_COLOR;
            const isSel = selected === edge.id;
            return (
              <button key={edge.id} onClick={() => setSelected(isSel ? null : edge.id)}
                className="w-full text-left px-3 py-2 rounded-[var(--clay-border-radius-sm)] border flex items-center gap-2 transition-all duration-150 text-xs font-medium"
                style={{
                  background: isSel ? `${color}15` : "var(--clay-surface)",
                  borderColor: isSel ? `${color}60` : "var(--clay-border)",
                  boxShadow: isSel ? "var(--clay-shadow-inset)" : "var(--clay-shadow-sm)",
                  color: isSel ? color : "var(--clay-text)",
                }}>
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
                <span className="truncate">{edge.name}</span>
                <span className="ml-auto text-[10px] capitalize" style={{ color: "var(--clay-text-muted)", opacity: 0.8 }}>
                  {state?.online ? state.congestion : "offline"}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

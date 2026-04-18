# Implementation Plan: STMS Simulation Refactor

## Overview

Transform the existing STMS into a live city traffic simulation platform for Meridian City. The implementation is split into 6 phases with hard dependencies: Phase 1 (Map Infrastructure) must complete before Phase 2 (Simulation Engine) begins. Phase 5 (Emergency Priority) depends on both Phase 1 and Phase 2. All 113 existing tests must continue to pass throughout.


---

## Tasks

### Phase 1: Map Infrastructure Upgrade

> **Hard dependency:** All Phase 1 tasks must be complete before any Phase 2 task begins.

- [x] T1.1 Install MapLibre GL JS and mapbox-gl packages
  - Add `maplibre-gl` and `mapbox-gl` (and their `@types/*`) to `package.json`
  - Verify both packages resolve without peer-dependency conflicts
  - _Requirements: 1.1, 1.2, 1.6_
  - _Complexity: S_

- [x] T1.2 Create `IMapProvider` interface
  - File: `src/lib/map/IMapProvider.ts`
  - Define interface with methods: `addSource()`, `removeSource()`, `addLayer()`, `removeLayer()`, `setFeatureState()`, `flyTo()`, `on()` (click + contextmenu overloads), `off()`, `getCanvas()`, `resize()`, `remove()`
  - Export `MapInitOptions` type (center, zoom, style)
  - _Requirements: 1.3, 1.4_
  - _Complexity: S_
  - _Dependencies: T1.1_

- [x] T1.3 Create `MapLibreAdapter`
  - File: `src/lib/map/MapLibreAdapter.ts`
  - Implements `IMapProvider`; wraps `maplibre-gl` Map instance
  - Default style: `https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json`
  - Wrap all method calls in try/catch; log errors, do not propagate
  - _Requirements: 1.1, 1.3, 1.4, 1.5_
  - _Complexity: M_
  - _Dependencies: T1.2_

- [x] T1.4 Create `MapboxAdapter`
  - File: `src/lib/map/MapboxAdapter.ts`
  - Implements `IMapProvider`; wraps `mapbox-gl` Map instance
  - Style: `mapbox://styles/mapbox/dark-v11`
  - On Mapbox `error` event (invalid token), catch and fall back to MapLibre silently
  - Wrap all method calls in try/catch; log errors, do not propagate
  - _Requirements: 1.2, 1.3, 1.4_
  - _Complexity: M_
  - _Dependencies: T1.2_

- [x] T1.5 Create `MapProviderFactory`
  - File: `src/lib/map/MapProviderFactory.ts`
  - Export `createMapProvider(container, options)` — checks `process.env.NEXT_PUBLIC_MAPBOX_TOKEN` at call time; returns `MapboxAdapter` if token present, else `MapLibreAdapter`
  - This is the ONLY file that imports either adapter
  - _Requirements: 1.1, 1.2, 1.4, 1.5_
  - _Complexity: S_
  - _Dependencies: T1.3, T1.4_

- [x] T1.6 Create `MapProviderContext`
  - File: `src/contexts/MapProviderContext.tsx`
  - `createContext<IMapProvider | null>(null)` with `MapProviderContext.Provider`
  - Export `useMapProvider()` hook
  - _Requirements: 1.3_
  - _Complexity: S_
  - _Dependencies: T1.2_

- [x] T1.7 Prisma migration: add `zone_type` and `flood_risk` columns to `road_segments`
  - Create migration file under `prisma/migrations/` (timestamp-prefixed directory)
  - SQL: `ALTER TABLE road_segments ADD COLUMN zone_type TEXT[] NOT NULL DEFAULT '{}', ADD COLUMN flood_risk BOOLEAN NOT NULL DEFAULT false`
  - Update `prisma/schema.prisma`: add `zoneType String[] @default([]) @map("zone_type")` and `floodRisk Boolean @default(false) @map("flood_risk")` to `RoadSegment` model
  - Verify `geometry` column is present (already in schema)
  - _Requirements: 2.1, 2.2, 2.4, 2.11_
  - _Complexity: S_

- [x] T1.8 Create Meridian City seed data
  - File: `scripts/seed-meridian-city.mjs` (or extend `prisma/seed.ts`)
  - Seed exactly 18 named road segments with GeoJSON LineString geometry centred at ~18.5°N, 73.8°E
  - Required names: Central Boulevard, North Ring Road, Station Avenue, Market Street, Harbour Link, Industrial Bypass, Airport Expressway, University Road, Old Town Lane, Tech Park Drive, Stadium Road, Riverside Drive, Commerce Way, Port Access Road, Eastern Connector, Southern Loop, Civic Centre Road, Waterfront Promenade
  - Assign `zone_type` arrays per design spec; flag exactly 3 segments with `flood_risk = true` (Harbour Link, Riverside Drive, Waterfront Promenade)
  - Seed 11 intersections with lat/lng, 4 traffic signals, 2 Active incidents, congestion predictions for all segments, route_edges forming a connected graph
  - Do NOT include segments named "AI Test Segment" or "Prediction Test Segment"
  - _Requirements: 2.5, 2.6, 2.7, 2.8, 2.9, 2.10_
  - _Complexity: L_
  - _Dependencies: T1.7_

- [x] T1.9 Create `MapCanvas` component
  - File: `src/components/map/MapCanvas.tsx`
  - Use `next/dynamic` with `{ ssr: false }` to load the map
  - On mount: call `createMapProvider(containerRef.current, options)`, store instance in ref, wrap children in `MapProviderContext.Provider`
  - On unmount: call `provider.remove()`
  - Accept `className` and `children` props
  - _Requirements: 1.6, 3.1_
  - _Complexity: M_
  - _Dependencies: T1.5, T1.6_

- [x] T1.10 Create `SegmentLayer` component
  - File: `src/components/map/SegmentLayer.tsx`
  - Consumes `useMapProvider()`; adds a GeoJSON source + LineString layer for all road segments
  - Colour mapping: Free=`#22c55e`, Moderate=`#eab308`, Heavy=`#f97316`, Gridlock=`#ef4444`
  - Line width: linear scale 3px (0 vehicles) → 10px (100+ vehicles)
  - Gridlock segments: apply CSS pulse animation via `setFeatureState`
  - On click: call `onSegmentClick(segmentId)` prop
  - On contextmenu: call `onSegmentContextMenu(segmentId, position)` prop
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 5.1, 5.3_
  - _Complexity: M_
  - _Dependencies: T1.9_

- [x] T1.11 Create `SignalLayer` component
  - File: `src/components/map/SignalLayer.tsx`
  - Renders circle markers at intersection lat/lng; colour by signal phase (Green=`#22c55e`, Yellow=`#eab308`, Red=`#ef4444`, Off=`#64748b`)
  - Active phase: apply pulsing dot animation
  - On click: call `onIntersectionClick(intersectionId)` prop
  - Visibility controlled by `visible` prop (from LayerTogglePanel)
  - _Requirements: 4.2, 4.3, 5.2_
  - _Complexity: M_
  - _Dependencies: T1.9_

- [x] T1.12 Create `IncidentLayer` component
  - File: `src/components/map/IncidentLayer.tsx`
  - Renders pin markers at segment midpoints for active incidents
  - On pin click: show popup with incident type, severity, description, time elapsed
  - Visibility controlled by `visible` prop
  - _Requirements: 4.4, 4.5_
  - _Complexity: M_
  - _Dependencies: T1.9_

- [x] T1.13 Create `PredictionLayer` component
  - File: `src/components/map/PredictionLayer.tsx`
  - Renders road segments as translucent dashed lines at 50% opacity showing predicted congestion for next 60 minutes
  - Visibility controlled by `visible` prop
  - _Requirements: 4.6_
  - _Complexity: S_
  - _Dependencies: T1.9_

- [x] T1.14 Create `LayerTogglePanel` component
  - File: `src/components/map/LayerTogglePanel.tsx`
  - Floating panel, positioned top-right (absolute)
  - Three independent toggle controls: Signal Overlay, Incident Overlay, Prediction Overlay
  - Stores toggle state in local React state (not Zustand — UI-only preference)
  - Passes visibility booleans down to layer components via props/context
  - _Requirements: 4.1, 4.7, 19.4_
  - _Complexity: S_
  - _Dependencies: T1.11, T1.12, T1.13_

- [x] T1.15 Create `SegmentDetailPanel` component
  - File: `src/components/map/SegmentDetailPanel.tsx`
  - Slide-in panel triggered by segment click
  - Displays: segment name, current vehicle count, avg speed, congestion level, active incidents, AI prediction
  - Fetches data from existing `/api/monitoring/segments` and `/api/predictions` endpoints
  - _Requirements: 5.1_
  - _Complexity: M_
  - _Dependencies: T1.10_

- [x] T1.16 Create `IntersectionPopup` component
  - File: `src/components/map/IntersectionPopup.tsx`
  - Map popup triggered by intersection click
  - Displays: signal phase, last override timestamp, AI recommended timing
  - Fetches from existing `/api/signals/[signalId]` endpoint
  - _Requirements: 5.2_
  - _Complexity: S_
  - _Dependencies: T1.11_

- [x] T1.17 Create `ContextMenu` component
  - File: `src/components/map/ContextMenu.tsx`
  - Right-click context menu on road segments
  - Contains "Inject Event" option with event type sub-selector (Accident, Road Closure, Debris, Flooding, Other)
  - On confirm: calls `POST /api/incidents` with segmentId and selected type
  - _Requirements: 5.3, 10.1, 10.2, 10.3_
  - _Complexity: M_
  - _Dependencies: T1.10_

- [x] T1.18 Wire SSE updates to `SegmentLayer`
  - In `SegmentLayer`, subscribe to the existing `/api/monitoring/sse` SSE stream
  - On `segment:update` event: call `provider.setFeatureState()` to update colour/width within 5 seconds
  - Use `useEffect` cleanup to close `EventSource` on unmount
  - _Requirements: 3.8_
  - _Complexity: M_
  - _Dependencies: T1.10_

- [x] T1.19 Replace `TrafficMap.tsx` SVG implementation with `MapCanvas`
  - Modify `src/components/map/TrafficMap.tsx` to render `<MapCanvas>` with all layer components as children
  - Remove SVG node/edge rendering code; preserve the component's public props interface (`segments: SegmentState[]`) for backward compatibility
  - Update `src/app/(dashboard)/map/page.tsx` to pass segments to the new implementation
  - _Requirements: 3.1, 19.2_
  - _Complexity: M_
  - _Dependencies: T1.9, T1.10, T1.11, T1.12, T1.13, T1.14, T1.15, T1.16, T1.17, T1.18_

- [x] T1.20 Phase 1 verification checkpoint
  - Run `npm test` (vitest --run) — all 113 existing tests must pass
  - Smoke test: map page loads with MapLibre GL JS, Meridian City segments are visible, overlay toggles work, segment click opens detail panel, right-click shows context menu
  - _Requirements: 1.1, 3.1, 4.1, 5.1, 5.3_
  - _Complexity: S_
  - _Dependencies: T1.1–T1.19_


---

### Phase 2: Simulation Engine

> **Hard dependency:** All Phase 1 tasks (T1.1–T1.20) must be complete before starting Phase 2.

- [x] T2.1 Create simulation types
  - File: `src/lib/simulation/types.ts`
  - Export: `ScenarioType`, `TriggerType`, `ActiveScenario`, `EmergencyVehicle`, `SimulationStatus`, `AIInsight`, `SimulationState`
  - Match type definitions exactly as specified in design.md Data Models section
  - _Requirements: 6.7, 6.9, 9.1_
  - _Complexity: S_

- [x] T2.2 Create zone profile functions
  - File: `src/lib/simulation/zoneProfiles.ts`
  - Export `ZoneType`, `ZoneOutput`, and `getZoneProfile(hour: number, zone: ZoneType): ZoneOutput`
  - Implement pure functions for all 5 zone types with time-of-day patterns per Requirements 7.1–7.5
  - Export `getTickIntervalMs(speed: number): number` — returns `30000 / speed`
  - Vehicle count thresholds consistent with `compute_congestion_level` stored procedure: Free <20, Moderate 20–49, Heavy 50–79, Gridlock ≥80
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.7_
  - _Complexity: M_
  - _Dependencies: T2.1_

- [x] T2.3 Create `SimulationEngine` class and singleton
  - File: `src/lib/simulation/engine.ts`
  - Implement class with state machine (`STOPPED`/`RUNNING`/`PAUSED`), tick loop, speed multipliers
  - Methods: `play(speed?)`, `pause()`, `reset()`, `triggerScenario(type)`, `dispatchEmergency(originId, destinationId)`, `cancelEmergency(vehicleId)`, `getState()`, private `tick()`, `generateObservations()`, `applyCascade()`, `advanceEmergencyVehicles()`
  - Singleton pattern: `globalThis.__simulationEngine` (identical to existing `sseEmitter` pattern)
  - `generateObservations()`: calls `getZoneProfile()`, applies ±15% variance, writes `traffic_observations` via Prisma, emits `segment:update` SSE events
  - On tick error: log, skip tick, remain `RUNNING`
  - Simulated clock starts at 06:00 (360 minutes), advances each tick
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.10, 7.6_
  - _Complexity: XL_
  - _Dependencies: T2.1, T2.2_

- [x] T2.4 Create `POST /api/simulation/control` route
  - File: `src/app/api/simulation/control/route.ts`
  - Accepts `{ action: 'play' | 'pause' | 'reset', speed?: 1 | 5 | 10 | 30 }`
  - Returns `{ state, simulatedTime, speed }`
  - Invalid action → 400; already-in-requested-state → 200 (idempotent)
  - _Requirements: 6.8_
  - _Complexity: S_
  - _Dependencies: T2.3_

- [x] T2.5 Create `GET /api/simulation/stream` SSE route
  - File: `src/app/api/simulation/stream/route.ts`
  - SSE stream that forwards `simulation:tick`, `simulation:state_change`, `simulation:scenario_update`, `simulation:emergency_update`, `simulation:signal_preemption` events from `sseEmitter`
  - Pattern mirrors existing `src/app/api/monitoring/sse/route.ts`
  - _Requirements: 6.9_
  - _Complexity: S_
  - _Dependencies: T2.3, T2.6_

- [x] T2.6 Extend SSE event types in `src/lib/sse/emitter.ts`
  - Add to `SSEEventType` union: `'simulation:tick'`, `'simulation:state_change'`, `'simulation:scenario_update'`, `'simulation:emergency_update'`, `'simulation:signal_preemption'`, `'ai:token'`, `'ai:insight_complete'`, `'ai:insight_error'`
  - No other changes to `emitter.ts`
  - _Requirements: 6.9_
  - _Complexity: S_

- [x] T2.7 Create `SimulationControlPanel` component
  - File: `src/components/simulation/SimulationControlPanel.tsx`
  - Floating panel, bottom-left (absolute positioning)
  - Contains: Play/Pause toggle, speed selector (1x/5x/10x/30x), Reset button, simulated clock display (HH:MM), collapsible toggle
  - Reads simulation state from `useSimulation` Zustand store; dispatches actions via `POST /api/simulation/control`
  - Subscribes to `/api/simulation/stream` SSE to update clock in real time
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_
  - _Complexity: M_
  - _Dependencies: T2.4, T2.5, T2.8_

- [x] T2.8 Create `useSimulation` Zustand store
  - File: `src/store/simulationStore.ts`
  - State: `{ state: SimulationState, simulatedTime: string, speed: number, activeScenarios: string[], emergencyVehicleCount: number }`
  - Actions: `setSimulationStatus(status: SimulationStatus)`, `setSpeed(speed)`, `setState(state)`
  - No persistence (no localStorage) — in-memory only
  - _Requirements: 8.7_
  - _Complexity: S_
  - _Dependencies: T2.1_

- [x] T2.9 Write unit tests for `zoneProfiles.ts`
  - File: `src/test/zoneProfiles.test.ts`
  - Concrete examples for each of the 5 zone types at peak, off-peak, and night hours (15 example cases minimum)
  - Verify `vehicleCount >= 0` and `avgSpeedKmh >= 0` for all cases
  - Verify residential zone at 03:00 does NOT produce Gridlock-level vehicle counts (≥80)
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_
  - _Complexity: S_
  - _Dependencies: T2.2_

- [x] T2.10 Write property-based tests for simulation engine
  - File: `src/test/simulation.test.ts`
  - Use `fast-check` (already in devDependencies)
  - **Property 1: Zone profile output is within congestion thresholds**
    - `// Feature: stms-simulation-refactor, Property 1: zone profile output is within congestion thresholds`
    - `fc.property(fc.integer({ min: 0, max: 23 }), fc.constantFrom('residential', 'commercial', 'industrial', 'transit', 'highway'), (hour, zone) => { const out = getZoneProfile(hour, zone); return out.vehicleCount >= 0 && out.avgSpeedKmh >= 0; })`
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5**
  - **Property 4: Zone profile variance is within ±15%**
    - `// Feature: stms-simulation-refactor, Property 4: zone profile variance is within ±15%`
    - Run `getZoneProfile` 100 times for same inputs; all results within `[base*0.85, base*1.15]`
    - **Validates: Requirements 7.6**
  - **Property 5: Simulated clock advances monotonically**
    - `// Feature: stms-simulation-refactor, Property 5: simulated clock advances monotonically`
    - Tick N times; collect `simulatedMinutes` after each tick; verify strictly increasing sequence
    - **Validates: Requirements 6.10**
  - **Property 6: Speed multiplier tick interval is correct**
    - `// Feature: stms-simulation-refactor, Property 6: speed multiplier tick interval is correct`
    - `fc.property(fc.constantFrom(1, 5, 10, 30), (speed) => getTickIntervalMs(speed) === 30000 / speed)`
    - **Validates: Requirements 6.3, 6.4, 6.5, 6.6**
  - _Requirements: 6.3–6.6, 6.10, 7.1–7.6_
  - _Complexity: M_
  - _Dependencies: T2.2, T2.3_

- [x] T2.11 Phase 2 verification checkpoint
  - Run `npm test` (vitest --run) — all 113+ tests must pass (including new T2.9 tests)
  - Smoke test: play/pause/speed controls call the API and update the panel, map segments update colour on each tick, simulated clock advances
  - _Requirements: 6.1–6.10, 7.1–7.7, 8.1–8.7_
  - _Complexity: S_
  - _Dependencies: T2.1–T2.10_


---

### Phase 3: Event Engine

- [x] T3.1 Implement cascade/ripple logic in `SimulationEngine`
  - Add `applyCascade()` method to `src/lib/simulation/engine.ts`
  - On each tick: find all Gridlock segments; increase vehicle counts on directly adjacent segments by 20% (hop 1); if hop-1 segment also reaches Gridlock, increase its adjacent segments by 20% (hop 2 max)
  - Store overrides in `cascadeOverrides: Map<string, number>` (segmentId → vehicle count override)
  - Cap cascade vehicle count at 80 (Gridlock threshold) — do not exceed
  - When incident on Gridlock segment is resolved: remove from `cascadeOverrides`; next tick uses zone profile
  - Cascade logic runs entirely in-memory; no database triggers
  - _Requirements: 11.1, 11.2, 11.3, 11.4_
  - _Complexity: M_
  - _Dependencies: T2.3_

- [x] T3.2 Create scenario preset handlers in `SimulationEngine`
  - Add `triggerScenario(type: ScenarioType)` implementation to `src/lib/simulation/engine.ts`
  - Rush Hour: set all `commercial` and `transit` segments to Heavy/Gridlock for 15 simulated minutes
  - Stadium Exodus: set 5 segments nearest Stadium Road to Gridlock for 20 simulated minutes; 3 adjacent to Heavy
  - Major Accident: pick one highway segment at random; create `Accident` incident; set to Gridlock; set 2 adjacent to Heavy; emit AI anomaly alert
  - Flash Flood: create `Flooding` incidents on all 3 `flood_risk` segments; set to Gridlock; re-route active routes away from those segments
  - Persist scenario-triggered incidents via `POST /api/incidents`; retry once after 2s on failure
  - Broadcast `simulation:scenario_update` SSE event
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7_
  - _Complexity: L_
  - _Dependencies: T3.1_

- [x] T3.3 Create `POST /api/simulation/scenario` route
  - File: `src/app/api/simulation/scenario/route.ts`
  - Accepts `{ scenario: ScenarioType }`
  - Calls `simulationEngine.triggerScenario(scenario)`
  - Returns `{ scenarioId, affectedSegments: string[] }`
  - _Requirements: 9.1_
  - _Complexity: S_
  - _Dependencies: T3.2_

- [x] T3.4 Add scenario dropdown to `SimulationControlPanel`
  - Modify `src/components/simulation/SimulationControlPanel.tsx`
  - Add dropdown with options: Rush Hour, Stadium Exodus, Major Accident, Flash Flood
  - On selection: call `POST /api/simulation/scenario`
  - _Requirements: 9.1_
  - _Complexity: S_
  - _Dependencies: T2.7, T3.3_

- [x] T3.5 Create `EventFeed` component
  - File: `src/components/events/EventFeed.tsx`
  - Right sidebar list of active incidents
  - Each entry: type icon, segment name, time elapsed since creation, severity badge, Resolve button
  - Subscribes to `incident:new`, `incident:update`, `incident:escalated` SSE events from `/api/monitoring/sse`
  - When incident has been Active for >2 simulated hours without resolution: show red "ESCALATED" badge
  - Resolve button calls existing incident resolution endpoint
  - _Requirements: 12.1, 12.2, 12.3, 12.4_
  - _Complexity: M_
  - _Dependencies: T2.5_

- [x] T3.6 Create `EventFeedItem` component
  - File: `src/components/events/EventFeedItem.tsx`
  - Renders a single incident entry with all fields from Requirement 12.2
  - Accepts `incident` prop and `onResolve` callback
  - _Requirements: 12.2, 12.4_
  - _Complexity: S_
  - _Dependencies: T3.5_

- [x] T3.7 Wire `ContextMenu` "Inject Event" to `POST /api/incidents`
  - Modify `src/components/map/ContextMenu.tsx`
  - On event type confirmed: call `POST /api/incidents` with `{ segmentId, type, severity: 3, description: "Manually injected event" }`
  - On success: show `ToastNotification`; simulation engine will update congestion on next tick
  - On error: show error toast
  - _Requirements: 10.3, 10.4, 10.5_
  - _Complexity: S_
  - _Dependencies: T1.17, T3.8_

- [x] T3.8 Create `ToastNotification` component
  - File: `src/components/ui/ToastNotification.tsx`
  - Portal-based toast rendered outside the component tree
  - Accepts `message`, `type` ('success' | 'error' | 'info'), and optional `action` (label + callback)
  - Auto-dismisses after 4 seconds
  - _Requirements: 10.5, 18.2_
  - _Complexity: S_

- [x] T3.9 Write property-based tests for cascade logic
  - File: `src/test/cascade.test.ts`
  - **Property 2: Cascade depth is bounded at 2 hops**
    - `// Feature: stms-simulation-refactor, Property 2: cascade depth is bounded at 2 hops`
    - Generate random adjacency graphs and gridlock sets; verify no segment >2 hops from a Gridlock segment has its vehicle count increased by cascade
    - **Validates: Requirements 11.1, 11.2**
  - **Property 3: Cascade increase is bounded at Gridlock threshold**
    - `// Feature: stms-simulation-refactor, Property 3: cascade increase is bounded at Gridlock threshold`
    - For any segment vehicleCount and 20% cascade increase, result ≤ 80
    - **Validates: Requirements 11.1, 11.2**
  - **Property 8: Cascade resolution restores zone-based generation**
    - `// Feature: stms-simulation-refactor, Property 8: cascade resolution restores zone-based generation`
    - Add segment to `cascadeOverrides`; resolve triggering incident; verify next tick uses `getZoneProfile()` output, not cascade override
    - **Validates: Requirements 11.3**
  - _Requirements: 11.1, 11.2, 11.3_
  - _Complexity: M_
  - _Dependencies: T3.1_

- [x] T3.10 Phase 3 verification checkpoint
  - Run `npm test` (vitest --run) — all tests must pass
  - Smoke test: trigger Rush Hour scenario → commercial/transit segments turn Heavy/Gridlock on map; right-click segment → inject Accident → incident appears in EventFeed; Resolve button clears it
  - _Requirements: 9.1–9.7, 10.1–10.5, 11.1–11.4, 12.1–12.4_
  - _Complexity: S_
  - _Dependencies: T3.1–T3.9_


---

### Phase 4: AI Insight Layer

- [x] T4.1 Create AI insight prompt builder
  - File: `src/lib/ai/insightPrompt.ts`
  - Export `buildInsightPrompt(params: InsightPromptParams): string`
  - `InsightPromptParams`: `{ simulatedTime: string, topSegments: Array<{name, congestion}>, incidentCount: number, worstPredictedSegment: string, trigger: TriggerType }`
  - Prompt must include: simulated time, top 3 segment names with congestion levels, active incident count, worst predicted segment name
  - Cap prompt at 400 tokens; cap response instruction at 200 tokens
  - _Requirements: 13.3, 13.4_
  - _Complexity: S_

- [x] T4.2 Create `POST /api/ai/insight` route
  - File: `src/app/api/ai/insight/route.ts`
  - Accepts `{ trigger: TriggerType }`
  - Fetches top 3 congested segments and worst prediction from DB
  - Builds prompt via `buildInsightPrompt()`; triggers Ollama generation asynchronously
  - Streams tokens via `emitSSE('ai:token', { token, insightId })`
  - On completion: emits `ai:insight_complete`; on error: emits `ai:insight_error`
  - Returns `{ insightId }` immediately (generation is async)
  - If Ollama unavailable: emits `ai:insight_error` with offline message; returns `{ insightId, offline: true }`
  - _Requirements: 13.2, 13.3, 13.5, 13.6, 13.7_
  - _Complexity: M_
  - _Dependencies: T4.1, T2.6_

- [x] T4.3 Create `GET /api/ai/insight/stream` SSE route
  - File: `src/app/api/ai/insight/stream/route.ts`
  - SSE stream forwarding `ai:token`, `ai:insight_complete`, `ai:insight_error` events from `sseEmitter`
  - Pattern mirrors `src/app/api/simulation/stream/route.ts`
  - _Requirements: 13.5_
  - _Complexity: S_
  - _Dependencies: T2.6_

- [x] T4.4 Create `AIAnalystPanel` component
  - File: `src/components/ai/AIAnalystPanel.tsx`
  - Collapsible panel titled "AI Analyst"
  - Subscribes to `/api/ai/insight/stream` SSE; renders tokens with typing effect as they arrive
  - Retains last 5 insights in scrollable history (in-memory array, no persistence)
  - "Ask AI" button: calls `POST /api/ai/insight` with `{ trigger: 'manual' }`
  - Offline state: shows "AI Analyst offline — operating in manual mode" when `ai:insight_error` with offline flag received
  - Truncates streaming response client-side after 200 tokens; appends "…" if truncated
  - If SSE stream interrupted mid-response: shows partial text with "…" suffix
  - _Requirements: 13.1, 13.2, 13.5, 13.7, 13.8, 13.11, 13.12_
  - _Complexity: M_
  - _Dependencies: T4.2, T4.3_

- [x] T4.5 Create `AIInsightCard` component
  - File: `src/components/ai/AIInsightCard.tsx`
  - Renders a single insight with: text content, trigger type badge (`scheduled`/`scenario`/`gridlock_alert`/`manual`), simulated time
  - _Requirements: 13.12_
  - _Complexity: S_
  - _Dependencies: T4.4_

- [x] T4.6 Wire AI panel auto-open triggers
  - Modify `src/components/ai/AIAnalystPanel.tsx`
  - Subscribe to `simulation:scenario_update` SSE event → auto-open panel, call `POST /api/ai/insight` with `{ trigger: 'scenario' }`
  - Subscribe to `segment:update` SSE event → if any segment reaches Gridlock → auto-open panel, call `POST /api/ai/insight` with `{ trigger: 'gridlock_alert' }`
  - Debounce gridlock trigger: max once per 30 seconds
  - _Requirements: 13.9, 13.10_
  - _Complexity: S_
  - _Dependencies: T4.4_

- [x] T4.7 Surface signal optimisation reasoning in AI panel
  - Modify `src/lib/ai/signalOptimizer.ts`: after successful optimisation, emit `ai:token` SSE events with message in format "Optimised [Intersection Name]: N→S green extended from Xs to Ys (confidence: Z%)"
  - The `AIAnalystPanel` already subscribes to `ai:token` events and will display these automatically
  - _Requirements: 14.1_
  - _Complexity: S_
  - _Dependencies: T4.4_

- [x] T4.8 Add "Optimise All Signals" button to `SimulationControlPanel`
  - Modify `src/components/simulation/SimulationControlPanel.tsx`
  - Add button that calls `POST /api/signals` (or a new dedicated endpoint) to trigger optimisation for all online signals
  - Create `POST /api/signals/optimize-all/route.ts` if no existing bulk endpoint exists
  - _Requirements: 14.2, 14.3_
  - _Complexity: S_
  - _Dependencies: T2.7, T4.7_

- [x] T4.9 Write unit tests and property-based test for `insightPrompt.ts`
  - File: `src/test/insightPrompt.test.ts`
  - Unit tests: given known segment data, verify prompt contains simulated time, segment names, incident count, worst predicted segment name
  - **Property 7: AI insight prompt contains required context fields**
    - `// Feature: stms-simulation-refactor, Property 7: AI insight prompt contains required context fields`
    - Generate random segment arrays (min 3) and incident counts; verify `buildInsightPrompt()` output contains all required fields
    - **Validates: Requirements 13.3**
  - _Requirements: 13.3, 13.4_
  - _Complexity: S_
  - _Dependencies: T4.1_

- [x] T4.10 Phase 4 verification checkpoint
  - Run `npm test` (vitest --run) — all tests must pass
  - Smoke test: click "Ask AI" → panel opens and streams response with typing effect; trigger Rush Hour scenario → AI panel auto-opens with scenario-tagged insight; disconnect Ollama → panel shows offline state; all other features continue working
  - _Requirements: 13.1–13.12, 14.1–14.3_
  - _Complexity: S_
  - _Dependencies: T4.1–T4.9_


---

### Phase 5: Emergency Priority Mode

> **Hard dependency:** Phase 1 (T1.1–T1.20) AND Phase 2 (T2.1–T2.11) must both be complete before starting Phase 5.

- [x] T5.1 Implement `dispatchEmergency()` in `SimulationEngine`
  - Add to `src/lib/simulation/engine.ts`
  - Use Dijkstra routing (existing `src/lib/utils/routing.ts`) to compute fastest path between `originId` and `destinationId` intersections, ignoring congestion weights
  - Create `EmergencyVehicle` object: `{ id: uuid, route: string[], currentIndex: 0, speedKmh: 80, state: 'DISPATCHED', preemptedSignalIds: [] }`
  - Store in `emergencyVehicles: Map<string, EmergencyVehicle>`
  - Apply signal preemption at first intersection: set phase to Green, duration 60s, `emergency_override: true`
  - Write `AuditLog` entry: action `SIGNAL_OVERRIDE_APPLY`, metadata `{ intersectionId, userId: 'SYSTEM_EMERGENCY' }`
  - Emit `simulation:emergency_update` SSE event
  - If no path found: throw error (caller returns 422)
  - _Requirements: 15.3, 15.4, 15.5, 16.1, 16.2, 16.3, 16.4_
  - _Complexity: L_
  - _Dependencies: T2.3_

- [x] T5.2 Implement `advanceEmergencyVehicles()` in `SimulationEngine`
  - Add to `src/lib/simulation/engine.ts`; called on each tick
  - Advance each active `EmergencyVehicle` by one intersection per tick
  - Preempt signal at next intersection (Green, 60s, audit log entry)
  - Release (revert to AI-optimised timing) signal at previous intersection
  - Emit `simulation:signal_preemption` SSE event for each preemption
  - Emit `simulation:emergency_update` SSE event with current vehicle position
  - _Requirements: 16.1, 16.2, 16.4, 16.5_
  - _Complexity: M_
  - _Dependencies: T5.1_

- [x] T5.3 Implement emergency completion logic in `SimulationEngine`
  - When `EmergencyVehicle.currentIndex` reaches end of route:
    - Set vehicle state to `COMPLETED`
    - Release all remaining signal overrides (revert to AI-optimised timing)
    - Create `Incident` record: type `Other`, description "Emergency vehicle dispatch completed", severity 1, status `Resolved`
    - Emit `simulation:emergency_update` with `{ completed: true, vehicleId }`
    - Trigger AI narration: call `POST /api/ai/insight` with `{ trigger: 'manual' }` (completion narration)
  - _Requirements: 18.1, 18.3, 18.4_
  - _Complexity: M_
  - _Dependencies: T5.2_

- [x] T5.4 Create `POST /api/emergency/dispatch` route
  - File: `src/app/api/emergency/dispatch/route.ts`
  - Accepts `{ originId: string, destinationId: string }`
  - Calls `simulationEngine.dispatchEmergency(originId, destinationId)`
  - Returns `{ vehicleId, route: string[] }`
  - If no path: returns `422 { error: "No route found" }`
  - _Requirements: 15.3_
  - _Complexity: S_
  - _Dependencies: T5.1_

- [x] T5.5 Create `DELETE /api/emergency/[vehicleId]` route
  - File: `src/app/api/emergency/[vehicleId]/route.ts`
  - Calls `simulationEngine.cancelEmergency(vehicleId)`
  - Releases all signal overrides for that vehicle
  - Returns `{ success: true }`
  - _Requirements: 15.5_
  - _Complexity: S_
  - _Dependencies: T5.1_

- [x] T5.6 Create `EmergencyDispatchModal` component
  - File: `src/components/emergency/EmergencyDispatchModal.tsx`
  - Modal with two intersection pickers (Origin, Destination) populated from DB intersections
  - On confirm: calls `POST /api/emergency/dispatch`; on success closes modal and shows toast
  - On 422 error: shows "No route found between selected intersections" inline error
  - _Requirements: 15.2, 15.3_
  - _Complexity: M_
  - _Dependencies: T5.4_

- [x] T5.7 Create `EmergencyVehicleMarker` component
  - File: `src/components/emergency/EmergencyVehicleMarker.tsx`
  - Renders SVG ambulance/vehicle icon marker on the map at current intersection position
  - Subscribes to `simulation:emergency_update` SSE events to update position
  - Moves marker to next intersection on each update
  - _Requirements: 17.2_
  - _Complexity: M_
  - _Dependencies: T5.2, T1.9_

- [x] T5.8 Create `RouteOverlay` component
  - File: `src/components/map/RouteOverlay.tsx`
  - Renders emergency route as bright blue/white animated dashed polyline
  - Travelling pulse effect: animated moving dash offset
  - Dims all non-route intersections to 50% opacity via `setFeatureState`
  - Subscribes to `simulation:emergency_update` to update route state; clears on completion
  - _Requirements: 17.1, 17.5, 17.6_
  - _Complexity: M_
  - _Dependencies: T5.2, T1.9_

- [x] T5.9 Add Emergency button to `SimulationControlPanel`
  - Modify `src/components/simulation/SimulationControlPanel.tsx`
  - Add "Emergency" button with red/blue styling
  - On click: opens `EmergencyDispatchModal`
  - _Requirements: 15.1_
  - _Complexity: S_
  - _Dependencies: T2.7, T5.6_

- [x] T5.10 Wire AI panel emergency narration
  - Modify `src/lib/simulation/engine.ts` `dispatchEmergency()`: after dispatch, call `POST /api/ai/insight` with `{ trigger: 'manual' }` to generate dispatch narration
  - The AI prompt (via `buildInsightPrompt`) should include route intersection names and estimated clearance time
  - Completion narration is already triggered in T5.3
  - _Requirements: 22.1, 22.3_
  - _Complexity: S_
  - _Dependencies: T5.1, T5.3, T4.2_

- [x] T5.11 Write unit tests for emergency dispatch
  - File: `src/test/emergency.test.ts`
  - Test: valid origin/destination returns vehicle with non-empty route
  - Test: origin == destination or no path between them returns error (caller maps to 422)
  - Test: after dispatch, signal at first intersection has `emergency_override: true`
  - Test: after vehicle advances past intersection, that intersection's override is released
  - Test: audit log entries are written for each preemption
  - _Requirements: 15.3, 15.4, 16.1, 16.4, 16.5_
  - _Complexity: M_
  - _Dependencies: T5.1, T5.2_

- [x] T5.12 Phase 5 verification checkpoint
  - Run `npm test` (vitest --run) — all tests must pass
  - Smoke test: click Emergency → select origin/destination → dispatch → animated route appears on map → signals pulse green as vehicle advances → AI panel narrates dispatch → vehicle reaches destination → "Route Cleared" toast → AI narrates completion
  - _Requirements: 15.1–15.5, 16.1–16.5, 17.1–17.6, 18.1–18.4, 22.1–22.3_
  - _Complexity: S_
  - _Dependencies: T5.1–T5.11_


---

### Phase 6: UI/UX Refactor

- [x] T6.1 Refactor `/map` page to full-viewport command centre
  - Modify `src/app/(dashboard)/map/page.tsx`
  - Remove all padding, headings, and content below the fold
  - Map fills full viewport height; all panels are absolutely positioned floating overlays
  - Render `<MapCanvas>` as the base layer with `SimulationControlPanel`, `LayerTogglePanel`, `MapHUD`, `RightSidebar`, `SegmentDetailPanel`, `ContextMenu`, `ToastNotification` as floating children
  - _Requirements: 19.2, 19.3, 19.4, 19.5, 19.6_
  - _Complexity: M_
  - _Dependencies: T1.19, T2.7, T1.14_

- [x] T6.2 Create `MapHUD` component
  - File: `src/components/map/MapHUD.tsx`
  - Top-left absolute panel: STMS logo, "Meridian City" label, simulated clock (HH:MM) from `useSimulation` store
  - _Requirements: 19.6_
  - _Complexity: S_
  - _Dependencies: T2.8_

- [x] T6.3 Create `RightSidebar` component
  - File: `src/components/layout/RightSidebar.tsx`
  - Collapsible right-edge panel containing `AIAnalystPanel` and `EventFeed` stacked vertically
  - Collapse/expand toggle button on the left edge of the sidebar
  - _Requirements: 19.5_
  - _Complexity: S_
  - _Dependencies: T4.4, T3.5_

- [x] T6.4 Update auth redirect for `Traffic_Controller` role
  - Modify `src/lib/auth/options.ts`
  - In the `signIn` callback (or `redirect` callback): if user role is `Traffic_Controller`, redirect to `/map` after login
  - _Requirements: 19.1_
  - _Complexity: S_

- [x] T6.5 Upgrade monitoring page to sortable table default view
  - Modify `src/app/(dashboard)/monitoring/page.tsx`
  - Default view: `SegmentTable` component (sortable)
  - Toggle button to switch to existing `SegmentGrid` card view
  - Add `MonitoringStatsBar` at top
  - _Requirements: 20.1, 20.2, 20.3_
  - _Complexity: M_
  - _Dependencies: T6.6, T6.7_

- [x] T6.6 Create `MonitoringStatsBar` component
  - File: `src/components/monitoring/MonitoringStatsBar.tsx`
  - Displays: Total Segments, % Free, % Moderate, % Heavy, % Gridlock, Active Incidents count
  - Reads from `useTrafficStore` (already populated by existing hydration logic)
  - _Requirements: 20.3_
  - _Complexity: S_

- [x] T6.7 Create `SegmentTable` component
  - File: `src/components/monitoring/SegmentTable.tsx`
  - Sortable table with columns: Segment Name, Zone, Congestion (coloured badge), Vehicles, Avg Speed, Last Update, Trend (sparkline), Actions
  - On SSE `segment:update` event: briefly flash the updated row (CSS transition)
  - Sparkline trend: last 5 vehicle count observations rendered as a mini SVG line
  - _Requirements: 20.1, 20.4_
  - _Complexity: M_

- [x] T6.8 Add Grid/Table view toggle to monitoring page
  - Modify `src/app/(dashboard)/monitoring/page.tsx`
  - Toggle button (Grid icon / Table icon) switches between `SegmentGrid` and `SegmentTable`
  - Store preference in local React state (not persisted)
  - _Requirements: 20.2_
  - _Complexity: S_
  - _Dependencies: T6.5, T6.7_

- [x] T6.9 Implement SSE reconnection with exponential backoff
  - File: `src/lib/sse/useSSE.ts` (new hook)
  - Custom React hook wrapping `EventSource` with reconnection logic: 1s → 2s → 4s (max 3 retries)
  - After 3 failed attempts: show "Connection lost" toast with manual "Reconnect" button
  - On successful reconnect: re-hydrate state from REST endpoints before resuming SSE
  - Replace raw `EventSource` usage in `SegmentLayer`, `SimulationControlPanel`, `AIAnalystPanel`, `EventFeed` with this hook
  - _Requirements: 21.4, 21.5_
  - _Complexity: M_

- [x] T6.10 Add "Simulation Paused" overlay badge to map page
  - Modify `src/app/(dashboard)/map/page.tsx`
  - When `useSimulation` store state is `STOPPED` or `PAUSED`: render a non-blocking overlay badge "Simulation Paused" (top-center, semi-transparent)
  - _Requirements: 21.1_
  - _Complexity: S_
  - _Dependencies: T2.8, T6.1_

- [x] T6.11 Add environment variable documentation to `.env.example`
  - Add entries: `NEXT_PUBLIC_MAPBOX_TOKEN=`, `SIMULATION_TICK_BASE_MS=30000`, `SIMULATION_START_HOUR=6`
  - Add inline comments explaining each variable's purpose and valid values
  - _Requirements: 1.1, 1.2, 6.3_
  - _Complexity: S_

- [x] T6.12 Phase 6 verification checkpoint
  - Run `npm test` (vitest --run) — all tests must pass
  - Smoke test: Traffic_Controller login redirects to `/map`; full command centre layout renders correctly; monitoring page shows sortable table with stats bar; grid/table toggle works; disconnect SSE → reconnection attempts → "Connection lost" toast; simulation paused badge appears when engine stopped
  - _Requirements: 19.1–19.7, 20.1–20.4, 21.1–21.5_
  - _Complexity: S_
  - _Dependencies: T6.1–T6.11_

- [x] T6.99 Full integration smoke test
  - Verify all 113+ tests pass: `npm test`
  - End-to-end scenario: start simulation → trigger Rush Hour → observe map congestion changes → dispatch ambulance → verify signals pulse green along route → verify vehicle icon moves → verify AI panel narrates dispatch and completion → verify audit log entries exist in DB → resolve all incidents → verify EventFeed clears
  - Confirm degraded mode: stop Ollama → AI panel shows offline state → all other features continue
  - _Requirements: All_
  - _Complexity: M_
  - _Dependencies: T6.12_

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- **Phase dependency order:** Phase 1 → Phase 2 → Phase 3 → Phase 4; Phase 5 requires Phase 1 + Phase 2; Phase 6 can begin after Phase 2
- Each phase ends with a verification checkpoint that runs the full test suite
- Property tests validate universal correctness properties; unit tests validate specific examples and edge cases
- All simulation state is in-memory; only `traffic_observations` and `incidents` are persisted to PostgreSQL
- The `fast-check` library is already present in `devDependencies` — no additional install needed for PBT tasks

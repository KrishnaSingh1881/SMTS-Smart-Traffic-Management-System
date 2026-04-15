# Implementation Plan: Smart Traffic Management System (STMS)

## Overview

Incremental implementation from project foundation through all features. Each task builds on the previous, ending with a fully wired, production-ready STMS dashboard. Tech stack: Next.js 14 App Router, TypeScript, **PostgreSQL** (selected over SQLite — required for ENUMs, stored procedures, triggers, and connection pooling), Prisma ORM (`provider = "postgresql"`), NextAuth.js, Ollama AI, Zustand, Framer Motion, GSAP, Lenis, Tailwind CSS, Claymorphism design system, SSE for real-time updates.

## Tasks

- [x] 1. Project setup and dependency installation
  - Scaffold Next.js 14 App Router project with TypeScript and Tailwind CSS
  - Install and configure Prisma ORM with **PostgreSQL** provider (`provider = "postgresql"` in `prisma/schema.prisma`)
  - Install NextAuth.js, Zustand, Framer Motion, GSAP, Lenis, and `@studio-freight/lenis`
  - Install `fast-check` for property-based testing and `vitest` + `@testing-library/react` for unit tests
  - Configure `tsconfig.json` with strict mode and path aliases (`@/`)
  - Create `.env.example` with `DATABASE_URL` (PostgreSQL connection string), `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `OLLAMA_BASE_URL`
  - _Requirements: 10.1, 10.4_

- [x] 2. Database schema and migrations
  - [x] 2.1 Create Prisma schema with all ENUM types
    - Define `congestion_level`, `incident_type`, `signal_phase_state`, `user_role`, `incident_status`, `audit_action` enums in `prisma/schema.prisma`
    - _Requirements: 9.1, 9.2_

  - [x] 2.2 Define all core Prisma models
    - Add `User`, `RoadSegment`, `Intersection`, `IntersectionSegment`, `TrafficSignal`, `SignalPhase` models with all fields, constraints, and relations
    - Add `TrafficObservation`, `Incident`, `CongestionPrediction`, `AuditLog`, `RouteEdge` models
    - Enforce `CHECK` constraints via `@db` attributes and `@@check` where supported; document raw SQL constraints for migration
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

  - [x] 2.3 Write and run initial Prisma migration
    - Run `prisma migrate dev --name init` to generate SQL migration
    - Verify all tables, indexes (`idx_users_email`, `idx_road_segments_congestion`, `idx_traffic_signals_override`, `idx_signal_phases_active`, `idx_signal_phases_applied`), and foreign keys are created
    - _Requirements: 7.1, 9.3, 10.4_

  - [x] 2.4 Write unit tests for Prisma schema constraints
    - Test that inserting a `signal_phases` row with `duration_seconds < 10` or `> 180` throws a constraint error
    - Test that inserting an `audit_log` row with a missing required field throws a NOT NULL error
    - _Requirements: 9.2, 9.4_

- [x] 3. Stored procedures, triggers, and raw SQL extensions
  - [x] 3.1 Implement append-only audit log trigger
    - Write a PostgreSQL trigger function `prevent_audit_log_mutation` that raises an exception on `UPDATE` or `DELETE` on `audit_logs`
    - Apply trigger via a Prisma custom migration SQL file
    - _Requirements: 9.6, 8.4_

  - [x] 3.2 Implement congestion update trigger
    - Write trigger `after_observation_insert` that calls a stored procedure to recompute `current_congestion` on `road_segments` after each `traffic_observations` insert
    - Implement `compute_congestion_level(vehicle_count, avg_speed, speed_limit)` stored procedure returning `congestion_level`
    - _Requirements: 1.2, 9.5_

  - [x] 3.3 Implement incident escalation trigger
    - Write a stored procedure `escalate_overdue_incidents()` that sets `status = 'Escalated'` for incidents unresolved for > 2 hours and inserts an `INCIDENT_ESCALATE` audit log row
    - Wire this procedure to be callable from the Next.js API layer (scheduled via `setInterval` or cron)
    - _Requirements: 4.6_

  - [x] 3.4 Implement analytics stored procedures
    - Write `get_congestion_trend(segment_id, start_date, end_date)` returning daily avg congestion, peak vehicle count, and peak hours
    - Write `get_peak_hour_report(week_start)` returning top 5 most congested segments
    - Write `get_intervention_report(intersection_id, start_date, end_date)` sourced from `audit_logs`
    - Write `get_incident_history(segment_id, start_date, end_date)` with resolution time and resolving user
    - Apply all via custom migration SQL
    - _Requirements: 7.2, 7.3, 7.4, 7.5, 7.6_

  - [x] 3.5 Write unit tests for stored procedures
    - Test `compute_congestion_level` with boundary vehicle counts for each congestion tier
    - Test `escalate_overdue_incidents` promotes only incidents older than 2 hours
    - _Requirements: 4.6, 1.2_

- [x] 4. Design system and global styles
  - [x] 4.1 Create CSS custom properties and clay tokens
    - Write `src/styles/globals.css` with Claymorphism tokens: `--clay-bg`, `--clay-shadow`, `--clay-border-radius`, `--clay-blur`, color palette variables
    - Write `src/styles/themes.css` with `:root` (light) and `[data-theme="dark"]` variable overrides
    - Configure Tailwind `tailwind.config.ts` to extend theme with clay token references
    - _Requirements: (design system foundation)_

  - [x] 4.2 Configure Lenis smooth scroll and Framer Motion
    - Create `src/app/layout.tsx` root layout initialising `Lenis` via a `LenisProvider` client component
    - Add `<AnimatePresence>` wrapper for page transitions in root layout
    - Export reusable Framer Motion `fadeInUp` and `staggerChildren` variants from `src/lib/utils/motion.ts`
    - _Requirements: (design system foundation)_

  - [x] 4.3 Build Clay UI primitives
    - Implement `ClayCard`, `ClayBadge`, `ClayButton`, `ClayInput` in `src/components/ui/`
    - Each component accepts `className` override and uses Tailwind clay token classes
    - _Requirements: (design system foundation)_

- [x] 5. Authentication and role-based access
  - [x] 5.1 Configure NextAuth.js with credentials provider
    - Create `src/lib/auth/options.ts` with `CredentialsProvider` that queries `users` table, verifies `bcrypt` password hash, checks `locked_until`, and increments `failed_login_count`
    - Set session `maxAge` to 28800 (8 h) for `Traffic_Controller` and 86400 (24 h) for `Driver`
    - On 5 consecutive failures, set `locked_until = NOW() + 15 min` and insert `ACCOUNT_LOCKOUT` audit log row
    - Create `src/app/api/auth/[...nextauth]/route.ts`
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [x] 5.2 Implement role-based middleware
    - Create `src/middleware.ts` using NextAuth `withAuth` to protect all `/(dashboard)` routes
    - Redirect unauthenticated users to `/login`
    - Block `Driver` role from accessing `/signals`, `/incidents`, `/predictions`, `/analytics` routes; return 403
    - _Requirements: 8.1, 8.5_

  - [x] 5.3 Build login page UI
    - Create `src/app/(auth)/login/page.tsx` with `ClayInput` email/password fields and `ClayButton` submit
    - Show inline error for invalid credentials and account-locked state
    - Animate form entry with Framer Motion `fadeInUp`
    - _Requirements: 8.2, 8.3_

  - [x] 5.4 Write unit tests for auth logic
    - Test that 5 failed logins trigger lockout and audit log insertion
    - Test that a locked account rejects login before `locked_until` expires
    - _Requirements: 8.3, 8.4_

- [x] 6. Core dashboard layout
  - [x] 6.1 Build Sidebar and TopBar components
    - Create `src/components/layout/Sidebar.tsx` with nav links for Monitoring, Signals, Incidents, Predictions, Analytics, Routes (Routes hidden for `Traffic_Controller`)
    - Create `src/components/layout/TopBar.tsx` with user avatar, role badge, theme toggle button, and sign-out
    - Theme toggle writes `data-theme` attribute to `<html>` and persists to `localStorage`
    - _Requirements: 8.1, 8.5_

  - [x] 6.2 Implement SSE provider and Zustand store
    - Create `src/lib/sse/emitter.ts` as a Node.js `EventEmitter` singleton exported for use across API routes
    - Create `src/components/layout/SSEProvider.tsx` client component that opens `EventSource` to `/api/monitoring/sse` and dispatches events into Zustand store
    - Create `src/store/useTrafficStore.ts` with slices: `segments`, `signals`, `incidents`, `predictions`
    - _Requirements: 1.3, 1.4_

  - [x] 6.3 Wire dashboard shell layout
    - Create `src/app/(dashboard)/layout.tsx` rendering `<Sidebar>`, `<TopBar>`, `<SSEProvider>`, and `{children}`
    - Wrap content area with Framer Motion `<AnimatePresence>` for route transitions
    - _Requirements: 1.3_

- [x] 7. Real-time traffic monitoring
  - [x] 7.1 Implement traffic observation ingestion API
    - Create `src/app/api/monitoring/observations/route.ts` POST handler
    - Validate body: `segment_id`, `vehicle_count`, `avg_speed_kmh` (all required, non-null per Req 9.4)
    - Insert `traffic_observations` row via Prisma; DB trigger recomputes `current_congestion`
    - Emit SSE event `segment:update` via `emitter` after insert
    - _Requirements: 1.1, 1.2, 9.4, 9.5_

  - [x] 7.2 Implement segments and SSE stream API routes
    - Create `src/app/api/monitoring/segments/route.ts` GET returning all segments with current state
    - Create `src/app/api/monitoring/sse/route.ts` GET that registers a listener on `emitter` and streams `text/event-stream` responses; cleans up on client disconnect
    - _Requirements: 1.3, 1.4_

  - [x] 7.3 Implement sensor-offline detection
    - Add a `lib/utils/sensorWatchdog.ts` module that runs every 30 s, queries segments where `last_observation_at < NOW() - 120s`, sets `sensor_online = false`, and emits `segment:offline` SSE event
    - Start watchdog in `src/app/api/monitoring/sse/route.ts` on first SSE connection
    - _Requirements: 1.5_

  - [x] 7.4 Build monitoring dashboard page
    - Create `src/app/(dashboard)/monitoring/page.tsx` that reads segments from Zustand store
    - Implement `src/components/monitoring/SegmentGrid.tsx` rendering a card per segment with `CongestionBadge` and vehicle count
    - Implement `src/components/monitoring/CongestionBadge.tsx` with colour-coded clay badge per level (Free/Moderate/Heavy/Gridlock)
    - Implement `src/components/monitoring/SensorOfflineAlert.tsx` shown when `sensor_online = false`
    - Animate badge colour transitions with Framer Motion `layout` prop
    - _Requirements: 1.3, 1.4, 1.5_

  - [x] 7.5 Write unit tests for congestion computation
    - Test `src/lib/utils/congestion.ts` `computeCongestionLevel()` for all four tier boundaries
    - Test SSE emitter emits correct event type after observation insert
    - _Requirements: 1.2, 1.4_

- [x] 8. Traffic signal management
  - [x] 8.1 Implement signal API routes
    - Create `src/app/api/signals/route.ts` GET returning all signals with current phase and override status
    - Create `src/app/api/signals/[signalId]/route.ts` GET (single signal detail) and PATCH (update `current_phase`)
    - Create `src/app/api/signals/[signalId]/override/route.ts` POST (apply override) and DELETE (cancel override)
    - POST override: validate duration 10–180 s, set `override_active = true`, insert `SIGNAL_OVERRIDE_APPLY` audit log row, emit `signal:update` SSE event
    - DELETE override: set `override_active = false`, resume `ai_optimized = true`, insert `SIGNAL_OVERRIDE_CANCEL` audit log, emit SSE event
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 8.4_

  - [x] 8.2 Build signal list page
    - Create `src/app/(dashboard)/signals/page.tsx` listing all signals from Zustand store
    - Implement `src/components/signals/SignalStatusRing.tsx` using GSAP `gsap.to()` to animate a circular ring whose colour and rotation reflect the current phase (Green/Yellow/Red/Off)
    - Show override badge on signals with `override_active = true`
    - _Requirements: 2.1, 2.3_

  - [x] 8.3 Build signal detail and override panel
    - Create `src/app/(dashboard)/signals/[signalId]/page.tsx` showing phase history and current state
    - Implement `src/components/signals/SignalOverridePanel.tsx` with phase selector, duration input (validated 10–180 s client-side), and submit/cancel buttons using `ClayButton`
    - Show offline alert when `is_online = false`
    - _Requirements: 2.2, 2.4, 2.5, 2.6_

  - [x] 8.4 Write unit tests for signal override logic
    - Test that override with `duration_seconds = 9` is rejected at API layer
    - Test that cancelling an override sets `ai_optimized = true` and inserts correct audit log action
    - _Requirements: 2.2, 2.4, 2.5_

- [x] 9. Checkpoint — Ensure all tests pass
  - Run `vitest --run` and confirm all unit tests from tasks 2–8 pass. Ask the user if questions arise.

- [x] 10. AI signal optimization
  - [x] 10.1 Implement Ollama REST client and prompt templates
    - Create `src/lib/ai/ollama.ts` with `ollamaGenerate(prompt: string): Promise<string>` using `fetch` to `OLLAMA_BASE_URL/api/generate`
    - Handle network errors gracefully; return `null` on failure (graceful degradation per Req 10.3)
    - Create `src/lib/ai/prompts.ts` with `buildSignalOptimizationPrompt(signalId, segments, currentPhases)` template
    - Create `src/lib/ai/parser.ts` with `parseSignalTimingResponse(raw: string): SignalTimingUpdate[]`
    - _Requirements: 3.1, 10.3_

  - [x] 10.2 Implement AI signal optimization service
    - Create `src/lib/ai/signalOptimizer.ts` with `optimizeSignal(signalId)` function
    - Skip signals with `override_active = true` (Req 2.3)
    - Call Ollama, parse response, validate durations (10–180 s), upsert `signal_phases` rows with `source = 'ai_optimized'`
    - Insert `SIGNAL_AI_UPDATE` audit log row with previous timing, new timing, and `ai_confidence_score`
    - Emit `signal:update` SSE event
    - Schedule optimization loop: standard intersections every 5 min, `is_high_priority` every 2 min
    - _Requirements: 3.1, 3.2, 3.3, 3.5_

  - [x] 10.3 Build AI timing preview component
    - Implement `src/components/signals/AITimingPreview.tsx` showing recommended phase durations alongside current durations before application
    - Add "Apply AI Timing" button that calls the optimization API
    - _Requirements: 3.4_

  - [x] 10.4 Write unit tests for AI optimizer
    - Test that `optimizeSignal` skips signals with `override_active = true`
    - Test that `parseSignalTimingResponse` rejects durations outside 10–180 s range
    - Test graceful degradation: when `ollamaGenerate` returns `null`, signal retains current timing
    - _Requirements: 3.1, 3.3, 10.3_

- [x] 11. Incident management
  - [x] 11.1 Implement incident API routes
    - Create `src/app/api/incidents/route.ts` GET (list with filters) and POST (create incident)
    - POST: validate `type` is one of `Accident | Road_Closure | Debris | Flooding | Other`, insert incident row, set segment `current_congestion` to at least `Heavy` in same transaction, insert `INCIDENT_CREATE` audit log, emit `incident:new` SSE event
    - Create `src/app/api/incidents/[incidentId]/route.ts` GET and PATCH (resolve)
    - PATCH resolve: update `status = 'Resolved'`, record `resolved_at` and `resolved_by_user_id`, insert `INCIDENT_RESOLVE` audit log, emit `incident:update` SSE event
    - _Requirements: 4.2, 4.3, 4.4, 4.5, 8.4, 9.5_

  - [x] 11.2 Wire incident escalation scheduler
    - Call `escalate_overdue_incidents()` stored procedure every 5 minutes via `setInterval` in a Next.js route handler initialised on first SSE connection
    - Emit `incident:escalated` SSE event for each escalated incident
    - _Requirements: 4.6_

  - [x] 11.3 Build incident feed page
    - Create `src/app/(dashboard)/incidents/page.tsx` reading incidents from Zustand store
    - Implement `src/components/incidents/IncidentFeed.tsx` with sortable list of incident cards showing type, segment, severity, status, and elapsed time
    - Highlight escalated incidents with a distinct clay badge colour
    - Animate new incidents entering the list with Framer Motion `AnimatePresence`
    - _Requirements: 4.1, 4.6_

  - [x] 11.4 Build incident report form
    - Create `src/app/(dashboard)/incidents/new/page.tsx`
    - Implement `src/components/incidents/IncidentForm.tsx` with `ClayInput` / select fields for type, segment, severity, and description
    - Submit calls POST `/api/incidents`; show success toast and redirect to feed on success
    - _Requirements: 4.2, 4.3_

  - [x] 11.5 Write unit tests for incident logic
    - Test that creating an incident sets segment congestion to at least `Heavy`
    - Test that resolving an incident inserts correct audit log row with `resolved_by_user_id`
    - Test that escalation only affects incidents older than 2 hours with `status = 'Active'`
    - _Requirements: 4.4, 4.5, 4.6_

- [x] 12. Congestion prediction
  - [x] 12.1 Implement prediction API routes
    - Create `src/app/api/predictions/route.ts` GET (latest predictions per segment) and POST (trigger prediction run)
    - GET returns predictions with `confidence_score`, `predicted_at`, and `target_window_minutes` (60 or 120)
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 12.2 Implement AI congestion prediction service
    - Create `src/lib/ai/congestionPredictor.ts` with `predictCongestion(segmentId)` function
    - Build prompt from last 60 min of `traffic_observations` for the segment
    - Parse Ollama response into `{ level: CongestionLevel, confidence: number, window: 60 | 120 }`
    - Insert two `congestion_predictions` rows (60 min and 120 min windows) with `model_confidence_score`
    - If predicted level is `Heavy` or `Gridlock` for 60-min window, emit `prediction:alert` SSE event
    - Schedule prediction loop every 15 min per segment
    - _Requirements: 5.1, 5.2, 5.4, 5.5_

  - [x] 12.3 Build prediction forecast cards page
    - Create `src/app/(dashboard)/predictions/page.tsx`
    - Implement `src/components/predictions/PredictionCard.tsx` showing segment name, 60-min and 120-min predicted levels, confidence score, and last-updated time
    - Highlight `Heavy`/`Gridlock` predictions with animated Framer Motion pulse border
    - _Requirements: 5.3, 5.4_

  - [x] 12.4 Write unit tests for prediction service
    - Test that predictions with `Heavy`/`Gridlock` at 60 min emit `prediction:alert` SSE event
    - Test that prediction rows are stored with correct `target_window_minutes` values
    - _Requirements: 5.1, 5.4_

- [x] 13. Route recommendations
  - [x] 13.1 Implement Dijkstra routing service
    - Create `src/lib/utils/routing.ts` with `findRoutes(originSegmentId, destinationSegmentId, segments): Route[]`
    - Build adjacency graph from `route_edges` table (or `intersection_segments` join)
    - Compute edge weights from `current_congestion` level and `avg_speed_kmh`; incorporate AI predictions < 15 min old
    - Return up to 3 ranked routes ordered by estimated travel time
    - Label routes passing through segments with active incidents as `affected_by_incident`
    - Return descriptive message when no route exists
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x] 13.2 Implement route query API route
    - Create `src/app/api/routes/route.ts` POST handler
    - Validate `origin_segment_id` and `destination_segment_id` are present
    - Call `findRoutes`, respond within 3 s (add timeout guard)
    - Gate endpoint to `Driver` role only via middleware check
    - _Requirements: 6.1, 6.5, 8.5_

  - [x] 13.3 Build route query UI
    - Create `src/app/(dashboard)/routes/page.tsx` (role-gated to `Driver`)
    - Render origin/destination segment selectors using `ClayInput` with autocomplete
    - Display up to 3 route result cards with estimated travel time, segment list, and incident warning badge
    - Animate results in with Framer Motion `staggerChildren`
    - _Requirements: 6.1, 6.2, 6.3_

  - [x] 13.4 Write unit tests for routing service
    - Test `findRoutes` returns routes ordered by ascending estimated travel time
    - Test that a route through a segment with an active incident is labelled `affected_by_incident`
    - Test that `findRoutes` returns empty array (with message) when no path exists
    - _Requirements: 6.1, 6.3, 6.5_

- [x] 14. Analytics
  - [x] 14.1 Implement analytics API routes
    - Create `src/app/api/analytics/congestion-trend/route.ts` GET calling `get_congestion_trend` stored procedure; enforce 5 s response for ≤ 90-day ranges
    - Create `src/app/api/analytics/peak-hours/route.ts` GET calling `get_peak_hour_report`
    - Create `src/app/api/analytics/interventions/route.ts` GET calling `get_intervention_report`
    - Create `src/app/api/analytics/incidents/route.ts` GET calling `get_incident_history`
    - _Requirements: 7.2, 7.3, 7.4, 7.5, 7.6_

  - [x] 14.2 Build congestion trend chart
    - Create `src/app/(dashboard)/analytics/congestion-trend/page.tsx` with date-range picker and segment selector
    - Implement `src/components/analytics/CongestionChart.tsx` using GSAP `ScrollTrigger` to animate bars/lines as they enter the viewport
    - _Requirements: 7.2_

  - [x] 14.3 Build peak hours table
    - Create `src/app/(dashboard)/analytics/peak-hours/page.tsx` with week selector
    - Implement `src/components/analytics/PeakHoursTable.tsx` showing top 5 segments with clay row styling
    - _Requirements: 7.3_

  - [x] 14.4 Build interventions and incidents analytics pages
    - Create `src/app/(dashboard)/analytics/interventions/page.tsx` showing signal override and AI update history from audit log
    - Create `src/app/(dashboard)/analytics/page.tsx` as analytics hub with navigation cards to sub-pages
    - _Requirements: 7.4, 7.5_

  - [x] 14.5 Write unit tests for analytics query wrappers
    - Test that `get_congestion_trend` returns one row per day in the requested range
    - Test that `get_peak_hour_report` returns exactly 5 rows
    - _Requirements: 7.2, 7.3_

- [x] 15. Checkpoint — Ensure all tests pass
  - Run `vitest --run` and confirm all unit tests pass end-to-end. Ask the user if questions arise.

- [x] 16. Shared types, Prisma client singleton, and final wiring
  - [x] 16.1 Define shared TypeScript types
    - Create `src/types/index.ts` exporting `CongestionLevel`, `IncidentType`, `SignalPhaseState`, `UserRole`, `IncidentStatus`, `AuditAction` string union types mirroring DB enums
    - Export `Segment`, `Signal`, `Incident`, `Prediction`, `Route`, `AuditEntry` interfaces used across components and API routes
    - _Requirements: 9.1_

  - [x] 16.2 Create Prisma client singleton
    - Create `src/lib/db/prisma.ts` exporting a singleton `PrismaClient` instance safe for Next.js hot-reload (global cache pattern)
    - Create typed query wrapper stubs in `src/lib/db/queries/` for segments, signals, incidents, predictions, and audit log
    - _Requirements: 10.4_

  - [x] 16.3 Wire AI degraded-mode alert
    - In `src/lib/ai/ollama.ts`, on fetch failure emit a `system:ai-unavailable` SSE event
    - In `SSEProvider.tsx`, handle `system:ai-unavailable` by setting a Zustand `aiDegraded` flag
    - In `TopBar.tsx`, show a dismissible `ClayBadge` warning when `aiDegraded = true`
    - _Requirements: 10.3_

  - [x] 16.4 Implement startup state reconciliation
    - In `src/app/(dashboard)/layout.tsx`, on mount fetch `/api/monitoring/segments` and `/api/signals` to hydrate Zustand store before rendering children
    - Ensures signal states and active incidents are reconciled from DB after any outage
    - _Requirements: 10.5_

- [x] 17. Final checkpoint — Ensure all tests pass
  - Run `vitest --run` and confirm the full test suite passes. Ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Checkpoints at tasks 9, 15, and 17 ensure incremental validation
- **Database**: PostgreSQL is used throughout — SQLite is not compatible with this project's use of custom ENUMs, stored procedures, triggers, and connection pooling
- Unit tests validate specific examples and edge cases; no property-based tests are included as the design document does not define Correctness Properties
- The design document's stored procedures (tasks 3.1–3.4) must be applied via Prisma custom migration SQL files since Prisma does not natively manage triggers and stored procedures

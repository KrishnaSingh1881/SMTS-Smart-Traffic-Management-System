# Design Document — Smart Traffic Management System (STMS)

## Overview

The Smart Traffic Management System (STMS) is a full-stack web platform built on Next.js 14 App Router and PostgreSQL. It provides real-time traffic monitoring, AI-driven signal optimization, incident management, congestion prediction, and route recommendations. The database layer — schema, constraints, stored procedures, and triggers — is the authoritative source of truth for all system state. An Ollama-hosted local LLM provides congestion prediction and signal optimization recommendations. Traffic Controllers interact via a rich Claymorphism dashboard; Drivers access a lightweight route-query interface.

### Database Choice: PostgreSQL

**PostgreSQL** is the selected database for STMS. SQLite was considered but ruled out for the following reasons:

| Requirement | PostgreSQL | SQLite |
|---|---|---|
| Custom ENUM types (`congestion_level`, `user_role`, etc.) | ✅ Native | ❌ Not supported |
| Stored procedures & triggers | ✅ Full support | ❌ No stored procedures |
| Append-only audit log trigger | ✅ `BEFORE UPDATE/DELETE` triggers | ❌ Limited trigger support |
| Connection pooling (100 concurrent) | ✅ Via PgBouncer / Prisma pool | ❌ Single-writer only |
| `gen_random_uuid()` | ✅ Built-in | ❌ Requires extension |
| `CHECK` constraints on ENUMs | ✅ Native ENUM type | ❌ Stored as text |
| Multi-step atomic transactions | ✅ Full ACID | ⚠️ Limited in concurrent scenarios |

Prisma ORM is used as the query layer with `provider = "postgresql"` in `prisma/schema.prisma`. Connection pooling is configured via the `DATABASE_URL` connection string (supports PgBouncer pool mode).

### Key Design Principles

- **Database as the source of truth**: all business rules enforced at the DB layer via constraints, triggers, and stored procedures
- **Append-only audit trail**: every state-changing action is immutably logged
- **AI as advisor, not authority**: AI recommendations are always recorded and can be overridden
- **Graceful degradation**: system operates in manual mode when AI is unavailable
- **Real-time via SSE**: live dashboard updates without WebSocket complexity

---

## Architecture

### Next.js App Router Folder Structure

```
src/
├── app/
│   ├── layout.tsx                    # Root layout — Lenis init, ThemeProvider, Framer Motion
│   ├── page.tsx                      # Landing / login redirect
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── layout.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx                # Dashboard shell — sidebar, SSE connection
│   │   ├── monitoring/
│   │   │   └── page.tsx              # Real-time road segment map + congestion grid
│   │   ├── signals/
│   │   │   ├── page.tsx              # Signal list + status rings
│   │   │   └── [signalId]/page.tsx   # Signal detail + override panel
│   │   ├── incidents/
│   │   │   ├── page.tsx              # Incident feed
│   │   │   └── new/page.tsx          # Report incident form
│   │   ├── predictions/
│   │   │   └── page.tsx              # Congestion forecast cards
│   │   ├── analytics/
│   │   │   ├── page.tsx              # Analytics hub
│   │   │   ├── congestion-trend/page.tsx
│   │   │   ├── peak-hours/page.tsx
│   │   │   └── interventions/page.tsx
│   │   └── routes/
│   │       └── page.tsx              # Driver route query (role-gated)
│   └── api/
│       ├── auth/[...nextauth]/route.ts
│       ├── monitoring/
│       │   ├── observations/route.ts          # POST ingest, GET list
│       │   ├── segments/route.ts              # GET all segments + live state
│       │   └── sse/route.ts                   # GET — SSE stream
│       ├── signals/
│       │   ├── route.ts                       # GET all signals
│       │   ├── [signalId]/route.ts            # GET/PATCH signal
│       │   └── [signalId]/override/route.ts   # POST/DELETE override
│       ├── incidents/
│       │   ├── route.ts                       # GET list, POST create
│       │   └── [incidentId]/route.ts          # GET, PATCH (resolve)
│       ├── predictions/
│       │   └── route.ts                       # GET predictions, POST trigger
│       ├── routes/
│       │   └── route.ts                       # POST route query
│       └── analytics/
│           ├── congestion-trend/route.ts
│           ├── peak-hours/route.ts
│           ├── interventions/route.ts
│           └── incidents/route.ts
├── components/
│   ├── ui/                           # Clay design system primitives
│   │   ├── ClayCard.tsx
│   │   ├── ClayBadge.tsx
│   │   ├── ClayButton.tsx
│   │   └── ClayInput.tsx
│   ├── monitoring/
│   │   ├── SegmentGrid.tsx
│   │   ├── CongestionBadge.tsx
│   │   └── SensorOfflineAlert.tsx
│   ├── signals/
│   │   ├── SignalStatusRing.tsx      # GSAP animated ring
│   │   ├── SignalOverridePanel.tsx
│   │   └── AITimingPreview.tsx
│   ├── incidents/
│   │   ├── IncidentFeed.tsx
│   │   └── IncidentForm.tsx
│   ├── predictions/
│   │   └── PredictionCard.tsx
│   ├── analytics/
│   │   ├── CongestionChart.tsx       # GSAP timeline chart
│   │   └── PeakHoursTable.tsx
│   └── layout/
│       ├── Sidebar.tsx
│       ├── TopBar.tsx
│       └── SSEProvider.tsx
├── lib/
│   ├── db/
│   │   ├── prisma.ts                 # Prisma client singleton
│   │   └── queries/                  # Typed query wrappers
│   ├── ai/
│   │   ├── ollama.ts                 # Ollama REST client
│   │   ├── prompts.ts                # Prompt templates
│   │   └── parser.ts                 # Response parsing
│   ├── auth/
│   │   └── options.ts                # NextAuth config
│   ├── sse/
│   │   └── emitter.ts                # SSE event emitter (Node EventEmitter)
│   └── utils/
│       ├── congestion.ts             # Congestion level computation
│       └── routing.ts                # Dijkstra / route ranking
├── store/
│   └── useTrafficStore.ts            # Zustand store
├── types/
│   └── index.ts                      # Shared TypeScript types
└── styles/
    ├── globals.css                   # CSS custom properties, clay tokens
    └── themes.css                    # Dark/light variable overrides
```

### Service Layer

```
API Route Handler
      │
      ▼
Service Function (lib/*)
      │
      ├──► Prisma ORM ──► PostgreSQL (constraints, triggers, stored procs)
      │
      └──► Ollama AI Service (lib/ai/ollama.ts)
```

All business logic lives in `lib/` service modules. API routes are thin — they validate input, call a service function, and return the result. This keeps routes testable and the AI/DB layers independently swappable.

---

## Full PostgreSQL Schema

### ENUM Types

```sql
-- Congestion level categories
CREATE TYPE congestion_level AS ENUM ('Free', 'Moderate', 'Heavy', 'Gridlock');

-- Incident classification
CREATE TYPE incident_type AS ENUM ('Accident', 'Road_Closure', 'Debris', 'Flooding', 'Other');

-- Traffic signal phase states
CREATE TYPE signal_phase_state AS ENUM ('Green', 'Yellow', 'Red', 'Off');

-- User roles
CREATE TYPE user_role AS ENUM ('Traffic_Controller', 'Driver');

-- Incident status
CREATE TYPE incident_status AS ENUM ('Active', 'Resolved', 'Escalated');

-- Audit action categories
CREATE TYPE audit_action AS ENUM (
  'SIGNAL_OVERRIDE_APPLY',
  'SIGNAL_OVERRIDE_CANCEL',
  'SIGNAL_AI_UPDATE',
  'INCIDENT_CREATE',
  'INCIDENT_RESOLVE',
  'INCIDENT_ESCALATE',
  'ACCOUNT_LOCKOUT',
  'USER_LOGIN',
  'USER_LOGOUT'
);
```

### Core Tables

```sql
-- ─────────────────────────────────────────────
-- USERS
-- ─────────────────────────────────────────────
CREATE TABLE users (
  id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  email               VARCHAR(255)    NOT NULL UNIQUE,
  password_hash       TEXT            NOT NULL,
  full_name           VARCHAR(255)    NOT NULL,
  role                user_role       NOT NULL,
  is_active           BOOLEAN         NOT NULL DEFAULT TRUE,
  failed_login_count  SMALLINT        NOT NULL DEFAULT 0
                        CHECK (failed_login_count >= 0),
  locked_until        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users (email);
CREATE INDEX idx_users_role  ON users (role);


-- ─────────────────────────────────────────────
-- ROAD SEGMENTS
-- ─────────────────────────────────────────────
CREATE TABLE road_segments (
  id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  name                VARCHAR(255)    NOT NULL,
  -- GeoJSON LineString stored as text; use PostGIS geography in production
  geometry            TEXT,
  length_meters       NUMERIC(10, 2)  NOT NULL CHECK (length_meters > 0),
  speed_limit_kmh     SMALLINT        NOT NULL CHECK (speed_limit_kmh > 0),
  -- Derived/cached current state (updated by trigger / service)
  current_congestion  congestion_level NOT NULL DEFAULT 'Free',
  sensor_online       BOOLEAN         NOT NULL DEFAULT TRUE,
  last_observation_at TIMESTAMPTZ,
  created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_road_segments_congestion ON road_segments (current_congestion);


-- ─────────────────────────────────────────────
-- INTERSECTIONS
-- ─────────────────────────────────────────────
CREATE TABLE intersections (
  id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  name                VARCHAR(255)    NOT NULL,
  latitude            NUMERIC(9, 6)   NOT NULL,
  longitude           NUMERIC(9, 6)   NOT NULL,
  is_high_priority    BOOLEAN         NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- Junction table: which segments meet at which intersection
CREATE TABLE intersection_segments (
  intersection_id     UUID            NOT NULL REFERENCES intersections(id) ON DELETE CASCADE,
  segment_id          UUID            NOT NULL REFERENCES road_segments(id) ON DELETE CASCADE,
  PRIMARY KEY (intersection_id, segment_id)
);


-- ─────────────────────────────────────────────
-- TRAFFIC SIGNALS
-- ─────────────────────────────────────────────
CREATE TABLE traffic_signals (
  id                    UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  intersection_id       UUID              NOT NULL REFERENCES intersections(id) ON DELETE RESTRICT,
  label                 VARCHAR(100)      NOT NULL,
  current_phase         signal_phase_state NOT NULL DEFAULT 'Red',
  is_online             BOOLEAN           NOT NULL DEFAULT TRUE,
  -- Manual override state
  override_active       BOOLEAN           NOT NULL DEFAULT FALSE,
  override_expires_at   TIMESTAMPTZ,
  override_by_user_id   UUID              REFERENCES users(id) ON DELETE SET NULL,
  -- AI optimization state
  ai_optimized          BOOLEAN           NOT NULL DEFAULT TRUE,
  last_ai_update_at     TIMESTAMPTZ,
  last_updated_at       TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  created_at            TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_traffic_signals_intersection ON traffic_signals (intersection_id);
CREATE INDEX idx_traffic_signals_override     ON traffic_signals (override_active) WHERE override_active = TRUE;


-- ─────────────────────────────────────────────
-- SIGNAL PHASES
-- ─────────────────────────────────────────────
CREATE TABLE signal_phases (
  id                  UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_id           UUID              NOT NULL REFERENCES traffic_signals(id) ON DELETE CASCADE,
  phase_state         signal_phase_state NOT NULL,
  duration_seconds    SMALLINT          NOT NULL
                        CHECK (duration_seconds >= 10 AND duration_seconds <= 180),
  sequence_order      SMALLINT          NOT NULL CHECK (sequence_order >= 0),
  is_active           BOOLEAN           NOT NULL DEFAULT FALSE,
  applied_at          TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  -- Source: 'manual_override' | 'ai_optimized' | 'default'
  source              VARCHAR(20)       NOT NULL DEFAULT 'default'
                        CHECK (source IN ('manual_override', 'ai_optimized', 'default')),
  ai_confidence_score NUMERIC(4, 3)     CHECK (ai_confidence_score BETWEEN 0 AND 1),
  UNIQUE (signal_id, sequence_order, applied_at)
);

CREATE INDEX idx_signal_phases_signal    ON signal_phases (signal_id);
CREATE INDEX idx_signal_phases_active    ON signal_phases (signal_id, is_active) WHERE is_active = TRUE;
CREATE INDEX idx_signal_phases_applied   ON signal_phases (applied_at DESC);

# Smart Traffic Management System (STMS)

A comprehensive, AI-powered web platform for real-time urban traffic monitoring, signal optimization, incident management, and route recommendations.

![Next.js](https://img.shields.io/badge/Next.js-14.2-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-blue?logo=postgresql)
![Prisma](https://img.shields.io/badge/Prisma-5.13-2D3748?logo=prisma)
![Tests](https://img.shields.io/badge/Tests-113%20Passing-success)

## 🚀 Overview

STMS is a production-ready traffic management platform that combines real-time sensor data, AI-driven optimization, and an intuitive dashboard to help traffic controllers and drivers navigate urban congestion efficiently.

### Key Features

- **Real-Time Traffic Monitoring** — Live vehicle counts, speeds, and congestion levels across all road segments
- **AI Signal Optimization** — Automated traffic signal timing using local LLM (Ollama)
- **Incident Management** — Detect, report, and resolve traffic incidents with automatic escalation
- **Congestion Prediction** — 60 and 120-minute forecasts with confidence scores
- **Route Recommendations** — Dijkstra-based routing with real-time and predicted congestion
- **Analytics & Reporting** — Historical trends, peak hours, intervention reports
- **Role-Based Access** — Separate interfaces for Traffic Controllers and Drivers
- **Audit Trail** — Immutable append-only log of all system actions

## 🏗️ Architecture

### Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 14 App Router, React 18, TypeScript |
| **Styling** | Tailwind CSS, Claymorphism Design System |
| **Animation** | Framer Motion, GSAP, Lenis Smooth Scroll |
| **Backend** | Next.js API Routes, Server Actions |
| **Database** | PostgreSQL 15+ with Prisma ORM |
| **Authentication** | NextAuth.js with Credentials Provider |
| **AI Engine** | Ollama (local LLM) for predictions & optimization |
| **State Management** | Zustand |
| **Real-Time** | Server-Sent Events (SSE) |
| **Testing** | Vitest, Testing Library, Fast-Check |

### Why PostgreSQL?

PostgreSQL was chosen over SQLite for:
- ✅ Native ENUM types for type safety
- ✅ Stored procedures and triggers for business logic
- ✅ Append-only audit log enforcement via triggers
- ✅ Connection pooling for 100+ concurrent users
- ✅ Advanced indexing and query optimization
- ✅ Full ACID compliance for multi-step transactions

## 📋 Prerequisites

- **Node.js** 18+ and npm
- **PostgreSQL** 15+ (running locally or remote)
- **Ollama** (for AI features) — [Install Guide](https://ollama.ai)
- **Git**

## 🛠️ Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd smart-traffic-management-system
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/stms_db?schema=public"

# NextAuth
NEXTAUTH_SECRET="your-secret-key-here"  # Generate with: openssl rand -base64 32
NEXTAUTH_URL="http://localhost:3000"

# Ollama AI
OLLAMA_BASE_URL="http://localhost:11434"
OLLAMA_MODEL="gemma4:e4b"
OLLAMA_TIMEOUT_MS="60000"
```

### 4. Set Up the Database

```bash
# Create the database
createdb stms_db

# Run migrations
npx prisma migrate deploy

# Generate Prisma Client
npx prisma generate
```

### 5. Seed Initial Data (Optional)

Create test users and sample road segments:

```bash
# Create a seed script or use Prisma Studio
npx prisma studio
```

See `CREDENTIALS.md` for default test accounts.

### 6. Start Ollama (for AI features)

```bash
# Pull the model
ollama pull gemma4:e4b

# Ollama runs automatically on port 11434
```

### 7. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 🧪 Testing

Run the full test suite:

```bash
npm test
```

Run tests in watch mode:

```bash
npm run test:watch
```

**Test Coverage:**
- ✅ 113 tests passing
- ✅ Database schema constraints
- ✅ Stored procedures and triggers
- ✅ Authentication and authorization
- ✅ Signal override logic
- ✅ Incident management
- ✅ AI optimization
- ✅ Congestion prediction
- ✅ Routing algorithms
- ✅ Analytics queries

## 📖 Features in Detail

### 1. Real-Time Traffic Monitoring

**Traffic Controllers** see a live dashboard with:
- Current congestion level (Free, Moderate, Heavy, Gridlock) for every road segment
- Vehicle counts and average speeds updated every 60 seconds
- Sensor status indicators (online/offline)
- Automatic alerts when sensors go offline (>120s without data)

**Technical Implementation:**
- Server-Sent Events (SSE) for real-time updates
- Database trigger recomputes congestion on every observation insert
- Zustand store for client-side state management
- Framer Motion animations for smooth transitions

### 2. Traffic Signal Management

**Features:**
- View all traffic signals with current phase (Green, Yellow, Red, Off)
- Manual override with custom phase and duration (10-180 seconds)
- AI-optimized timing (auto-updates every 5 minutes, 2 minutes for high-priority)
- Override suspension of AI optimization
- Signal status rings animated with GSAP

**Database Constraints:**
- Phase duration enforced: 10-180 seconds (CHECK constraint)
- All overrides logged in audit trail
- Automatic resume of AI optimization when override expires

### 3. AI Signal Optimization

**How It Works:**
1. System queries current congestion and vehicle counts for adjacent segments
2. Builds a prompt with context and sends to Ollama LLM
3. Parses AI response for recommended phase durations
4. Validates recommendations (10-180s range)
5. Applies timing and logs confidence score in audit trail

**Graceful Degradation:**
- If Ollama is unavailable, system continues with manual control
- Dashboard shows "AI Degraded Mode" alert
- No disruption to core monitoring and manual override features

### 4. Incident Management

**Incident Types:**
- Accident
- Road Closure
- Debris
- Flooding
- Other

**Workflow:**
1. **Detection:** AI anomaly detection or manual report by Traffic Controller
2. **Impact:** Segment congestion automatically set to "Heavy" or higher
3. **Resolution:** Traffic Controller marks incident as resolved
4. **Escalation:** Unresolved incidents >2 hours automatically escalated
5. **Audit:** All actions logged with user ID and timestamp

**Stored Procedure:**
```sql
escalate_overdue_incidents()
```
Runs every 5 minutes via scheduled task.

### 5. Congestion Prediction

**AI-Powered Forecasting:**
- Predicts congestion for next 60 and 120 minutes
- Updated every 15 minutes per segment
- Confidence scores stored with each prediction
- Proactive alerts for predicted Heavy/Gridlock conditions

**Model Training:**
- Historical observations retained for 2+ years
- Predictions vs. actuals tracked for accuracy evaluation
- Supports model retraining and improvement

### 6. Route Recommendations (Driver Feature)

**Algorithm:**
- Dijkstra shortest path with congestion-weighted edges
- Returns up to 3 ranked routes by estimated travel time
- Incorporates real-time congestion and AI predictions (<15 min old)
- Labels routes affected by active incidents
- Response time: <3 seconds

**Access Control:**
- Available only to Driver role
- Traffic Controllers can view but typically use monitoring dashboard

### 7. Analytics & Reporting

**Available Reports:**

| Report | Description | Data Source |
|--------|-------------|-------------|
| **Congestion Trend** | Daily avg congestion, peak counts, peak hours | `traffic_observations` |
| **Peak Hours** | Top 5 most congested segments per week | Stored procedure |
| **Interventions** | Signal overrides and AI updates | `audit_logs` |
| **Incident History** | All incidents with resolution times | `incidents` + `audit_logs` |

**Performance:**
- Queries optimized with indexes
- Stored procedures for consistent, reusable logic
- <5 second response for 90-day ranges

### 8. Security & Audit

**Authentication:**
- NextAuth.js with bcrypt password hashing
- Session tokens: 8h (Traffic Controller), 24h (Driver)
- Account lockout: 5 failed attempts → 15 min lockout

**Authorization:**
- Role-based access control (RBAC)
- Middleware enforces route permissions
- Database row-level security (future enhancement)

**Audit Trail:**
- Append-only `audit_logs` table
- Database trigger prevents UPDATE/DELETE
- Logs all state-changing actions:
  - Signal overrides (apply/cancel)
  - AI timing updates
  - Incident creation/resolution/escalation
  - Account lockouts
  - User login/logout

## 🗂️ Database Schema

### Core Tables

- **users** — Authentication and role management
- **road_segments** — Road stretches with current congestion state
- **intersections** — Junction points controlled by signals
- **traffic_signals** — Signal devices with phase and override state
- **signal_phases** — Historical and active phase configurations
- **traffic_observations** — Time-series sensor data
- **incidents** — Traffic disruptions and resolutions
- **congestion_predictions** — AI forecasts with confidence scores
- **audit_logs** — Immutable action trail
- **route_edges** — Graph edges for routing algorithm

### Key Constraints

```sql
-- Congestion level enum
CHECK (current_congestion IN ('Free', 'Moderate', 'Heavy', 'Gridlock'))

-- Signal phase duration
CHECK (duration_seconds >= 10 AND duration_seconds <= 180)

-- Append-only audit log
CREATE TRIGGER prevent_audit_log_mutation
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION raise_exception();
```

### Stored Procedures

- `compute_congestion_level(vehicle_count, avg_speed, speed_limit)` → congestion_level
- `escalate_overdue_incidents()` → void
- `get_congestion_trend(segment_id, start_date, end_date)` → table
- `get_peak_hour_report(week_start)` → table
- `get_intervention_report(intersection_id, start_date, end_date)` → table
- `get_incident_history(segment_id, start_date, end_date)` → table

## 🎨 Design System

**Claymorphism UI:**
- Soft, tactile card designs with subtle shadows
- Smooth animations with Framer Motion and GSAP
- Lenis smooth scroll for fluid navigation
- Dark/light theme toggle with CSS custom properties
- Accessible color contrast ratios (WCAG AA)

**Components:**
- `ClayCard`, `ClayBadge`, `ClayButton`, `ClayInput`
- `SignalStatusRing` (GSAP animated)
- `CongestionBadge` (color-coded by level)
- `SegmentGrid`, `IncidentFeed`, `PredictionCard`

## 📁 Project Structure

```
├── prisma/
│   ├── schema.prisma          # Database schema
│   └── migrations/            # SQL migrations
├── src/
│   ├── app/                   # Next.js App Router
│   │   ├── (auth)/           # Login pages
│   │   ├── (dashboard)/      # Protected dashboard routes
│   │   └── api/              # API endpoints
│   ├── components/           # React components
│   │   ├── ui/              # Design system primitives
│   │   ├── monitoring/      # Traffic monitoring UI
│   │   ├── signals/         # Signal management UI
│   │   ├── incidents/       # Incident management UI
│   │   ├── predictions/     # Forecast UI
│   │   └── analytics/       # Reporting UI
│   ├── lib/                  # Business logic
│   │   ├── ai/              # Ollama integration
│   │   ├── auth/            # NextAuth config
│   │   ├── db/              # Prisma client & queries
│   │   ├── sse/             # Server-Sent Events
│   │   └── utils/           # Helpers (routing, congestion)
│   ├── store/               # Zustand state management
│   ├── types/               # TypeScript definitions
│   └── styles/              # Global CSS & themes
├── src/test/                # Vitest test suites
├── CREDENTIALS.md           # Test account credentials
├── TESTING.md               # Manual testing guide
└── README.md                # This file
```

## 🚀 Deployment

### Production Checklist

- [ ] Change all default passwords (see `CREDENTIALS.md`)
- [ ] Set strong `NEXTAUTH_SECRET` (32+ random bytes)
- [ ] Configure production PostgreSQL with connection pooling (PgBouncer)
- [ ] Set up Ollama on a dedicated server or GPU instance
- [ ] Enable HTTPS with valid SSL certificate
- [ ] Configure CORS and CSP headers
- [ ] Set up database backups (daily recommended)
- [ ] Enable monitoring and alerting (Sentry, DataDog, etc.)
- [ ] Review and harden database permissions
- [ ] Set `NODE_ENV=production`

### Build for Production

```bash
npm run build
npm start
```

### Environment Variables (Production)

```env
NODE_ENV=production
DATABASE_URL="postgresql://user:password@prod-db:5432/stms_db?schema=public&pgbouncer=true"
NEXTAUTH_SECRET="<strong-random-secret>"
NEXTAUTH_URL="https://stms.yourdomain.com"
OLLAMA_BASE_URL="https://ollama.yourdomain.com"
```

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Write tests for new features
4. Ensure all tests pass (`npm test`)
5. Commit with clear messages (`git commit -m 'Add amazing feature'`)
6. Push to your branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## 📄 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

- **Next.js** — React framework
- **Prisma** — Database ORM
- **Ollama** — Local LLM runtime
- **Tailwind CSS** — Utility-first CSS
- **Framer Motion** — Animation library
- **GSAP** — Professional animation platform

## 📞 Support

For issues, questions, or feature requests:
- Open an issue on GitHub
- Check `TESTING.md` for manual testing procedures
- Review `CREDENTIALS.md` for access information

---

**Built with ❤️ for smarter cities**

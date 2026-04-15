# STMS Testing Guide

Complete manual testing procedures for the Smart Traffic Management System.

## 🎯 Testing Overview

This guide covers end-to-end manual testing of all STMS features. Follow these procedures to validate the system is working correctly.

**Estimated Time:** 45-60 minutes for complete testing

## 📋 Prerequisites

Before starting, ensure:
- [x] Development server is running (`npm run dev`)
- [x] PostgreSQL database is running and migrated
- [x] Ollama is running (for AI features)
- [x] Test users are created (see `CREDENTIALS.md`)
- [x] Browser DevTools open (for monitoring network/console)

## 🧪 Test Suites

### Suite 1: Authentication & Authorization (10 min)

#### Test 1.1: Successful Login (Traffic Controller)

**Steps:**
1. Navigate to `http://localhost:3000`
2. Enter credentials:
   - Email: `controller@stms.io`
   - Password: `Controller123!`
3. Click "Sign In"

**Expected Results:**
- ✅ Redirected to `/monitoring` dashboard
- ✅ Sidebar shows all menu items: Monitoring, Signals, Incidents, Predictions, Analytics, Routes
- ✅ TopBar shows user email and "Traffic_Controller" badge
- ✅ No console errors

#### Test 1.2: Successful Login (Driver)

**Steps:**
1. Sign out from Traffic Controller account
2. Navigate to `http://localhost:3000/login`
3. Enter credentials:
   - Email: `driver@stms.io`
   - Password: `Driver123!`
4. Click "Sign In"

**Expected Results:**
- ✅ Redirected to `/monitoring` dashboard
- ✅ Sidebar shows limited menu: Monitoring, Routes, Predictions
- ✅ TopBar shows "Driver" badge
- ✅ Signals, Incidents, and Analytics are hidden

#### Test 1.3: Failed Login (Invalid Credentials)

**Steps:**
1. Sign out
2. Enter invalid credentials:
   - Email: `controller@stms.io`
   - Password: `WrongPassword123`
3. Click "Sign In"

**Expected Results:**
- ✅ Error message: "Invalid credentials"
- ✅ Remain on login page
- ✅ Failed login count incremented in database

#### Test 1.4: Account Lockout

**Steps:**
1. Attempt login with wrong password 5 times consecutively
2. Check database: `SELECT locked_until FROM users WHERE email = 'controller@stms.io';`
3. Attempt login with correct password

**Expected Results:**
- ✅ After 5th failed attempt: "Account locked" message
- ✅ `locked_until` set to 15 minutes from now
- ✅ Audit log entry created with action `ACCOUNT_LOCKOUT`
- ✅ Correct password rejected until lockout expires

#### Test 1.5: Role-Based Access Control

**Steps:**
1. Login as Driver
2. Manually navigate to `http://localhost:3000/signals`
3. Try to access `http://localhost:3000/incidents`
4. Try to access `http://localhost:3000/analytics`

**Expected Results:**
- ✅ All attempts return 403 Forbidden or redirect
- ✅ Console shows authorization error
- ✅ Driver can only access `/monitoring`, `/routes`, `/predictions`

---

### Suite 2: Real-Time Traffic Monitoring (10 min)

#### Test 2.1: View Road Segments

**Steps:**
1. Login as Traffic Controller
2. Navigate to `/monitoring`
3. Observe the segment grid

**Expected Results:**
- ✅ All road segments displayed in grid layout
- ✅ Each segment shows:
  - Segment name
  - Current congestion level (badge with color)
  - Vehicle count
  - Average speed
  - Sensor status (online/offline indicator)
- ✅ Congestion badges color-coded:
  - Free: Green
  - Moderate: Yellow
  - Heavy: Orange
  - Gridlock: Red

#### Test 2.2: Real-Time Updates via SSE

**Steps:**
1. Open browser DevTools → Network tab
2. Filter for "sse" or "monitoring/sse"
3. Verify SSE connection is established (status: pending, type: eventsource)
4. Insert a test observation via Prisma Studio or SQL:
   ```sql
   INSERT INTO traffic_observations (id, segment_id, vehicle_count, avg_speed_kmh, observed_at)
   VALUES (gen_random_uuid(), '<segment-id>', 45, 35.5, NOW());
   ```
5. Watch the monitoring dashboard

**Expected Results:**
- ✅ SSE connection shows in Network tab
- ✅ Dashboard updates within 5 seconds without page refresh
- ✅ Congestion badge changes color if level changed
- ✅ Vehicle count and speed update
- ✅ Smooth animation on update (Framer Motion)

#### Test 2.3: Sensor Offline Detection

**Steps:**
1. Identify a segment with recent observations
2. Wait 2+ minutes without new observations for that segment
3. Observe the dashboard

**Expected Results:**
- ✅ After 120 seconds, segment shows "Sensor Offline" alert
- ✅ Alert badge appears with warning color
- ✅ `sensor_online` field in database set to `false`
- ✅ SSE event `segment:offline` emitted

#### Test 2.4: Congestion Level Computation

**Steps:**
1. Insert observations with varying vehicle counts:
   ```sql
   -- Free flow (low count, high speed)
   INSERT INTO traffic_observations (id, segment_id, vehicle_count, avg_speed_kmh, observed_at)
   VALUES (gen_random_uuid(), '<segment-id>', 5, 55.0, NOW());
   
   -- Heavy congestion (high count, low speed)
   INSERT INTO traffic_observations (id, segment_id, vehicle_count, avg_speed_kmh, observed_at)
   VALUES (gen_random_uuid(), '<segment-id>', 85, 15.0, NOW() + INTERVAL '1 minute');
   ```
2. Check segment congestion level after each insert

**Expected Results:**
- ✅ Low vehicle count + high speed → "Free"
- ✅ High vehicle count + low speed → "Heavy" or "Gridlock"
- ✅ Database trigger `after_observation_insert` fires
- ✅ `current_congestion` updated in `road_segments` table

---

### Suite 3: Traffic Signal Management (10 min)

#### Test 3.1: View All Signals

**Steps:**
1. Login as Traffic Controller
2. Navigate to `/signals`

**Expected Results:**
- ✅ List of all traffic signals displayed
- ✅ Each signal shows:
  - Signal label/name
  - Intersection name
  - Current phase (Green/Yellow/Red/Off)
  - Animated status ring (GSAP animation)
  - Override status badge (if active)
  - Online/offline indicator

#### Test 3.2: View Signal Detail

**Steps:**
1. Click on any signal from the list
2. Navigate to `/signals/[signalId]`

**Expected Results:**
- ✅ Signal detail page loads
- ✅ Shows current phase and duration
- ✅ Phase history table visible
- ✅ Override panel visible (if no override active)
- ✅ AI timing preview visible (if AI optimization enabled)

#### Test 3.3: Apply Manual Override

**Steps:**
1. On signal detail page, locate "Override Panel"
2. Select a phase: "Green"
3. Enter duration: 60 seconds
4. Click "Apply Override"
5. Check database: `SELECT override_active, override_expires_at FROM traffic_signals WHERE id = '<signal-id>';`

**Expected Results:**
- ✅ Success message displayed
- ✅ Signal shows "Override Active" badge
- ✅ `override_active` set to `true` in database
- ✅ `override_expires_at` set to NOW() + 60 seconds
- ✅ `ai_optimized` set to `false`
- ✅ Audit log entry created: `SIGNAL_OVERRIDE_APPLY`
- ✅ SSE event `signal:update` emitted
- ✅ Dashboard updates in real-time

#### Test 3.4: Cancel Manual Override

**Steps:**
1. With an active override, click "Cancel Override"
2. Confirm cancellation

**Expected Results:**
- ✅ Override badge removed
- ✅ `override_active` set to `false`
- ✅ `ai_optimized` set to `true` (AI resumes)
- ✅ Audit log entry: `SIGNAL_OVERRIDE_CANCEL`
- ✅ SSE event emitted

#### Test 3.5: Override Duration Validation

**Steps:**
1. Try to apply override with duration: 5 seconds
2. Try to apply override with duration: 200 seconds
3. Try to apply override with duration: 30 seconds

**Expected Results:**
- ✅ 5 seconds: Rejected (below 10s minimum)
- ✅ 200 seconds: Rejected (above 180s maximum)
- ✅ 30 seconds: Accepted
- ✅ Client-side validation shows error before submission
- ✅ Server-side validation enforces constraint

#### Test 3.6: AI Timing Preview

**Steps:**
1. Navigate to a signal without active override
2. Locate "AI Timing Preview" section
3. Click "Apply AI Timing" (if available)

**Expected Results:**
- ✅ Shows recommended phase durations from AI
- ✅ Shows current durations for comparison
- ✅ Shows confidence score
- ✅ Applying AI timing updates signal phases
- ✅ Audit log entry: `SIGNAL_AI_UPDATE`

---

### Suite 4: Incident Management (10 min)

#### Test 4.1: View Incident Feed

**Steps:**
1. Login as Traffic Controller
2. Navigate to `/incidents`

**Expected Results:**
- ✅ List of all incidents displayed
- ✅ Each incident shows:
  - Type (Accident, Road_Closure, Debris, Flooding, Other)
  - Segment name
  - Severity (1-5)
  - Status (Active, Resolved, Escalated)
  - Elapsed time since creation
  - Escalated badge (if escalated)
- ✅ Incidents sorted by creation time (newest first)

#### Test 4.2: Create New Incident

**Steps:**
1. Click "Report Incident" or navigate to `/incidents/new`
2. Fill out form:
   - Type: "Accident"
   - Segment: Select from dropdown
   - Severity: 4
   - Description: "Multi-vehicle collision blocking 2 lanes"
3. Submit form
4. Check database: `SELECT * FROM incidents ORDER BY created_at DESC LIMIT 1;`

**Expected Results:**
- ✅ Success message displayed
- ✅ Redirected to incident feed
- ✅ New incident appears at top of list
- ✅ Incident record created in database
- ✅ Segment `current_congestion` set to at least "Heavy"
- ✅ Audit log entry: `INCIDENT_CREATE`
- ✅ SSE event `incident:new` emitted
- ✅ All connected clients see new incident

#### Test 4.3: Resolve Incident

**Steps:**
1. From incident feed, click "Resolve" on an active incident
2. Confirm resolution
3. Check database: `SELECT status, resolved_at, resolved_by_user_id FROM incidents WHERE id = '<incident-id>';`

**Expected Results:**
- ✅ Incident status changes to "Resolved"
- ✅ `resolved_at` timestamp recorded
- ✅ `resolved_by_user_id` set to current user
- ✅ Audit log entry: `INCIDENT_RESOLVE`
- ✅ SSE event `incident:update` emitted
- ✅ Segment congestion can return to sensor-computed value

#### Test 4.4: Incident Escalation

**Steps:**
1. Create a test incident with `created_at` set to 3 hours ago:
   ```sql
   INSERT INTO incidents (id, segment_id, type, severity, status, reported_by_user_id, created_at)
   VALUES (
     gen_random_uuid(),
     '<segment-id>',
     'Road_Closure',
     5,
     'Active',
     '<user-id>',
     NOW() - INTERVAL '3 hours'
   );
   ```
2. Wait for escalation scheduler to run (every 5 minutes) or manually call:
   ```sql
   SELECT escalate_overdue_incidents();
   ```
3. Check incident status

**Expected Results:**
- ✅ Incident status changed to "Escalated"
- ✅ Escalated badge appears on incident card
- ✅ Audit log entry: `INCIDENT_ESCALATE`
- ✅ SSE event `incident:escalated` emitted
- ✅ Only incidents >2 hours old and status "Active" are escalated

#### Test 4.5: Incident Impact on Congestion

**Steps:**
1. Note current congestion of a segment (e.g., "Moderate")
2. Create an incident on that segment
3. Check segment congestion immediately after

**Expected Results:**
- ✅ Segment congestion set to at least "Heavy"
- ✅ If already "Heavy", remains "Heavy"
- ✅ If "Gridlock", remains "Gridlock"
- ✅ Transaction ensures atomicity (incident + congestion update)

---

### Suite 5: Congestion Prediction (8 min)

#### Test 5.1: View Predictions

**Steps:**
1. Login as Traffic Controller or Driver
2. Navigate to `/predictions`

**Expected Results:**
- ✅ Prediction cards displayed for all segments
- ✅ Each card shows:
  - Segment name
  - 60-minute prediction (level + confidence)
  - 120-minute prediction (level + confidence)
  - Last updated timestamp
- ✅ Heavy/Gridlock predictions highlighted with animated border

#### Test 5.2: Trigger Prediction Run

**Steps:**
1. Call prediction API manually:
   ```bash
   curl -X POST http://localhost:3000/api/predictions \
     -H "Content-Type: application/json" \
     -d '{"segmentId": "<segment-id>"}'
   ```
2. Check database: `SELECT * FROM congestion_predictions WHERE segment_id = '<segment-id>' ORDER BY predicted_at DESC LIMIT 2;`

**Expected Results:**
- ✅ Two prediction records created (60 min and 120 min windows)
- ✅ Each has `predicted_level`, `model_confidence_score`, `target_window_minutes`
- ✅ Predictions visible on dashboard within 5 seconds
- ✅ If Heavy/Gridlock predicted for 60 min, SSE event `prediction:alert` emitted

#### Test 5.3: Prediction Accuracy Tracking

**Steps:**
1. Create predictions for a segment
2. Wait for target time window to pass
3. Compare predicted level with actual observed level

**Expected Results:**
- ✅ Historical predictions retained in database
- ✅ Actual outcomes can be queried for accuracy evaluation
- ✅ Data available for model retraining

#### Test 5.4: AI Degraded Mode (Prediction)

**Steps:**
1. Stop Ollama service: `ollama stop` or kill the process
2. Trigger a prediction run
3. Check dashboard

**Expected Results:**
- ✅ Prediction fails gracefully (no crash)
- ✅ Dashboard shows "AI Unavailable" alert in TopBar
- ✅ Existing predictions remain visible
- ✅ System continues operating in manual mode

---

### Suite 6: Route Recommendations (8 min)

#### Test 6.1: Query Route (Driver)

**Steps:**
1. Login as Driver
2. Navigate to `/routes`
3. Select origin segment from dropdown
4. Select destination segment from dropdown
5. Click "Find Routes"

**Expected Results:**
- ✅ Up to 3 route options displayed within 3 seconds
- ✅ Routes ranked by estimated travel time (ascending)
- ✅ Each route shows:
  - Estimated travel time
  - List of segments in route
  - Total distance
  - Incident warning badge (if route passes through incident)
- ✅ Routes animated in with stagger effect (Framer Motion)

#### Test 6.2: Route with Incident

**Steps:**
1. Create an incident on a segment
2. Query a route that passes through that segment
3. Observe route results

**Expected Results:**
- ✅ Route labeled "Affected by Incident"
- ✅ Incident type shown (e.g., "Accident")
- ✅ Warning badge displayed
- ✅ Route still included in results (user can decide)

#### Test 6.3: Route with Predictions

**Steps:**
1. Create predictions for segments (some Heavy/Gridlock)
2. Query a route
3. Verify route ranking considers predictions

**Expected Results:**
- ✅ Routes avoid predicted congestion when possible
- ✅ Only predictions <15 minutes old are used
- ✅ Estimated travel time reflects predicted conditions

#### Test 6.4: No Route Available

**Steps:**
1. Query route between two disconnected segments (if any)
2. Or query route where no path exists in `route_edges` table

**Expected Results:**
- ✅ Message: "No route available between selected segments"
- ✅ No error or crash
- ✅ User can try different origin/destination

#### Test 6.5: Route Performance

**Steps:**
1. Query multiple routes in succession
2. Measure response time (DevTools Network tab)

**Expected Results:**
- ✅ All responses within 3 seconds
- ✅ No timeout errors
- ✅ Dijkstra algorithm performs efficiently

---

### Suite 7: Analytics & Reporting (8 min)

#### Test 7.1: Congestion Trend Report

**Steps:**
1. Login as Traffic Controller
2. Navigate to `/analytics/congestion-trend`
3. Select a segment
4. Select date range (e.g., last 7 days)
5. Click "Generate Report"

**Expected Results:**
- ✅ Chart displays within 5 seconds
- ✅ Shows daily average congestion level
- ✅ Shows peak vehicle count per day
- ✅ Shows peak hours per day
- ✅ Chart animated with GSAP ScrollTrigger
- ✅ Data sourced from `get_congestion_trend()` stored procedure

#### Test 7.2: Peak Hours Report

**Steps:**
1. Navigate to `/analytics/peak-hours`
2. Select a week (e.g., current week)
3. Click "Generate Report"

**Expected Results:**
- ✅ Table displays top 5 most congested segments
- ✅ Shows segment name, avg congestion, peak count, peak hours
- ✅ Sorted by congestion severity
- ✅ Data sourced from `get_peak_hour_report()` stored procedure

#### Test 7.3: Intervention Report

**Steps:**
1. Navigate to `/analytics/interventions`
2. Select an intersection
3. Select date range
4. Click "Generate Report"

**Expected Results:**
- ✅ Table shows all signal overrides and AI updates
- ✅ Each row shows:
  - Timestamp
  - Action (SIGNAL_OVERRIDE_APPLY, SIGNAL_OVERRIDE_CANCEL, SIGNAL_AI_UPDATE)
  - User (for manual overrides)
  - Previous timing
  - New timing
  - Confidence score (for AI updates)
- ✅ Data sourced from `audit_logs` table

#### Test 7.4: Incident History Report

**Steps:**
1. Navigate to `/analytics` (hub page)
2. Click "Incident History" or navigate to incidents analytics
3. Select a segment or date range
4. Generate report

**Expected Results:**
- ✅ Table shows all incidents for selected criteria
- ✅ Shows type, severity, status, resolution time, resolving user
- ✅ Data sourced from `get_incident_history()` stored procedure

#### Test 7.5: Analytics Performance

**Steps:**
1. Request congestion trend for 90-day range
2. Measure response time

**Expected Results:**
- ✅ Response within 5 seconds
- ✅ No timeout or performance degradation
- ✅ Database indexes optimize query performance

---

### Suite 8: System Reliability & Edge Cases (6 min)

#### Test 8.1: SSE Reconnection

**Steps:**
1. Open monitoring dashboard
2. Open DevTools → Network tab
3. Simulate network interruption (DevTools → Network → Offline)
4. Wait 5 seconds
5. Restore network (Online)

**Expected Results:**
- ✅ SSE connection drops
- ✅ Client attempts reconnection automatically
- ✅ Connection re-established within 5 seconds
- ✅ Dashboard resumes real-time updates
- ✅ No data loss or corruption

#### Test 8.2: Concurrent User Sessions

**Steps:**
1. Open STMS in two different browsers (or incognito)
2. Login as Traffic Controller in both
3. Apply signal override in Browser 1
4. Observe Browser 2

**Expected Results:**
- ✅ Browser 2 receives SSE update
- ✅ Signal override visible in Browser 2 within 5 seconds
- ✅ Both sessions remain synchronized
- ✅ No race conditions or conflicts

#### Test 8.3: Database Transaction Rollback

**Steps:**
1. Attempt to create an incident with invalid data (e.g., missing required field)
2. Check database state

**Expected Results:**
- ✅ Incident creation fails
- ✅ Segment congestion NOT updated (transaction rolled back)
- ✅ No partial state in database
- ✅ Error message returned to client

#### Test 8.4: Audit Log Immutability

**Steps:**
1. Attempt to update an audit log entry:
   ```sql
   UPDATE audit_logs SET action = 'MODIFIED' WHERE id = '<log-id>';
   ```
2. Attempt to delete an audit log entry:
   ```sql
   DELETE FROM audit_logs WHERE id = '<log-id>';
   ```

**Expected Results:**
- ✅ UPDATE query fails with trigger exception
- ✅ DELETE query fails with trigger exception
- ✅ Audit log remains unchanged
- ✅ Append-only constraint enforced

#### Test 8.5: Session Expiration

**Steps:**
1. Login as Traffic Controller
2. Wait 8+ hours (or manually expire session in database)
3. Attempt to access protected route

**Expected Results:**
- ✅ Session expired
- ✅ Redirected to login page
- ✅ Message: "Session expired, please login again"

#### Test 8.6: AI Service Unavailable

**Steps:**
1. Stop Ollama service
2. Attempt signal optimization
3. Attempt congestion prediction
4. Check dashboard

**Expected Results:**
- ✅ AI operations fail gracefully
- ✅ TopBar shows "AI Degraded Mode" alert
- ✅ Manual signal control still works
- ✅ Monitoring and incidents still functional
- ✅ No system crash or data corruption

---

## 🐛 Bug Reporting

If you encounter issues during testing:

1. **Document the bug:**
   - Steps to reproduce
   - Expected behavior
   - Actual behavior
   - Screenshots/videos
   - Browser console errors
   - Network tab errors

2. **Check logs:**
   - Browser console (F12)
   - Server logs (terminal running `npm run dev`)
   - Database logs (PostgreSQL logs)

3. **Verify environment:**
   - Node.js version: `node --version`
   - PostgreSQL version: `psql --version`
   - Ollama status: `ollama list`
   - Environment variables: Check `.env` file

4. **Create issue:**
   - Open GitHub issue with bug report template
   - Include all documentation from step 1
   - Tag with `bug` label

---

## ✅ Testing Checklist

Use this checklist to track your testing progress:

### Authentication & Authorization
- [ ] Traffic Controller login
- [ ] Driver login
- [ ] Failed login
- [ ] Account lockout
- [ ] Role-based access control

### Real-Time Monitoring
- [ ] View road segments
- [ ] Real-time SSE updates
- [ ] Sensor offline detection
- [ ] Congestion level computation

### Traffic Signals
- [ ] View all signals
- [ ] View signal detail
- [ ] Apply manual override
- [ ] Cancel manual override
- [ ] Override duration validation
- [ ] AI timing preview

### Incident Management
- [ ] View incident feed
- [ ] Create new incident
- [ ] Resolve incident
- [ ] Incident escalation
- [ ] Incident impact on congestion

### Congestion Prediction
- [ ] View predictions
- [ ] Trigger prediction run
- [ ] Prediction accuracy tracking
- [ ] AI degraded mode

### Route Recommendations
- [ ] Query route (Driver)
- [ ] Route with incident
- [ ] Route with predictions
- [ ] No route available
- [ ] Route performance

### Analytics & Reporting
- [ ] Congestion trend report
- [ ] Peak hours report
- [ ] Intervention report
- [ ] Incident history report
- [ ] Analytics performance

### System Reliability
- [ ] SSE reconnection
- [ ] Concurrent user sessions
- [ ] Database transaction rollback
- [ ] Audit log immutability
- [ ] Session expiration
- [ ] AI service unavailable

---

## 📊 Test Results Template

After completing testing, document your results:

```markdown
## Test Results — [Date]

**Tester:** [Your Name]
**Environment:** Development / Staging / Production
**Browser:** Chrome 120 / Firefox 121 / Safari 17
**Duration:** [Total testing time]

### Summary
- Total Tests: 50
- Passed: 48
- Failed: 2
- Skipped: 0

### Failed Tests
1. **Test 3.5: Override Duration Validation**
   - Issue: Client-side validation not working
   - Severity: Medium
   - Status: Bug reported #123

2. **Test 6.5: Route Performance**
   - Issue: Response time 4.2s (exceeds 3s requirement)
   - Severity: Low
   - Status: Performance optimization needed

### Notes
- All critical features working correctly
- AI features tested with Ollama llama2 model
- Database performance excellent
- SSE real-time updates working flawlessly

### Recommendations
- Fix client-side validation for signal overrides
- Optimize Dijkstra algorithm for large graphs
- Add loading indicators for analytics reports
```

---

## 🚀 Next Steps

After completing manual testing:

1. **Run automated tests:** `npm test`
2. **Review test coverage:** Check Vitest coverage report
3. **Performance testing:** Use tools like Lighthouse, WebPageTest
4. **Security testing:** Run OWASP ZAP or similar
5. **Load testing:** Use k6, Artillery, or JMeter
6. **Accessibility testing:** Use axe DevTools, WAVE
7. **Cross-browser testing:** Test on Chrome, Firefox, Safari, Edge
8. **Mobile testing:** Test responsive design on mobile devices

---

**Happy Testing! 🎉**

# Requirements Document

## Introduction

The Smart Traffic Management System (STMS) is a web-based platform built with Next.js and PostgreSQL that enables real-time monitoring, control, and analysis of urban road traffic. It provides Traffic Controllers with tools to monitor road segments, manage traffic signals, respond to incidents, and generate analytics reports. Drivers can access route recommendations and live traffic conditions. An AI layer provides congestion predictions, signal timing optimization, and anomaly detection. The database design — including schema, constraints, stored procedures, triggers, and audit logs — is central to the system's correctness and reliability.

## Glossary

- **STMS**: Smart Traffic Management System — the overall platform described in this document
- **Traffic_Controller**: An operator role responsible for monitoring road conditions and managing signals and incidents
- **Driver**: An end user who queries traffic conditions and receives route recommendations
- **Road_Segment**: A defined stretch of road between two intersections, identified by a unique ID and name
- **Intersection**: A junction where two or more Road_Segments meet, potentially controlled by a Traffic_Signal
- **Traffic_Signal**: A signal device at an Intersection that cycles through phases (green, yellow, red) to control vehicle flow
- **Signal_Phase**: A single timed state of a Traffic_Signal (e.g., north-south green, east-west red)
- **Vehicle_Count**: The number of vehicles detected on a Road_Segment within a given time window
- **Congestion_Level**: A categorical measure of traffic density on a Road_Segment: Free, Moderate, Heavy, or Gridlock
- **Incident**: An event on a Road_Segment that disrupts normal traffic flow (e.g., accident, road closure, debris)
- **Anomaly**: A statistically significant deviation from expected traffic patterns on a Road_Segment
- **AI_Engine**: The system component responsible for congestion prediction, signal optimization, and anomaly detection
- **Audit_Log**: An append-only database record of all state-changing operations performed in the STMS
- **Route**: An ordered sequence of Road_Segments connecting an origin to a destination

---

## Requirements

### Requirement 1: Real-Time Traffic Monitoring

**User Story:** As a Traffic_Controller, I want to monitor vehicle counts, speeds, and congestion levels on all Road_Segments in real time, so that I can make informed decisions about signal timing and incident response.

#### Acceptance Criteria

1. THE STMS SHALL store a traffic observation record for each Road_Segment at intervals no greater than 60 seconds, including vehicle count, average speed, and computed Congestion_Level.
2. WHEN a new traffic observation is recorded, THE STMS SHALL recompute the Congestion_Level for the affected Road_Segment using the thresholds defined in the system configuration.
3. THE STMS SHALL display a live dashboard to the Traffic_Controller showing the current Congestion_Level, vehicle count, and average speed for every Road_Segment.
4. WHEN the Congestion_Level of a Road_Segment changes, THE STMS SHALL update the dashboard within 5 seconds of the change being recorded.
5. IF a Road_Segment receives no traffic observation for more than 120 seconds, THEN THE STMS SHALL mark that Road_Segment as "sensor offline" and alert the Traffic_Controller.

---

### Requirement 2: Traffic Signal Management

**User Story:** As a Traffic_Controller, I want to view and control traffic signal timing at intersections, so that I can optimize vehicle flow and respond to incidents.

#### Acceptance Criteria

1. THE STMS SHALL store the current Signal_Phase, phase duration, and last-updated timestamp for every Traffic_Signal.
2. WHEN a Traffic_Controller submits a manual override for a Traffic_Signal, THE STMS SHALL apply the new Signal_Phase and duration within 3 seconds and record the override in the Audit_Log.
3. WHILE a manual override is active on a Traffic_Signal, THE STMS SHALL suspend AI-optimized timing for that signal and display the override status on the dashboard.
4. WHEN a manual override expires or is cancelled by a Traffic_Controller, THE STMS SHALL resume AI-optimized timing for the affected Traffic_Signal.
5. THE STMS SHALL prevent a Signal_Phase duration from being set below 10 seconds or above 180 seconds, enforced as a database constraint.
6. IF a Traffic_Signal becomes unreachable, THEN THE STMS SHALL alert the Traffic_Controller and retain the last known Signal_Phase in the database until connectivity is restored.

---

### Requirement 3: AI-Optimized Signal Timing

**User Story:** As a Traffic_Controller, I want the system to automatically optimize signal timing using AI, so that congestion is reduced without requiring constant manual intervention.

#### Acceptance Criteria

1. WHEN no manual override is active, THE AI_Engine SHALL compute optimized Signal_Phase durations for each Traffic_Signal based on current Vehicle_Count and Congestion_Level data from adjacent Road_Segments.
2. THE STMS SHALL apply AI-recommended signal timing updates at intervals no greater than 5 minutes per Intersection.
3. WHEN the AI_Engine updates signal timing, THE STMS SHALL record the previous timing, the new timing, and the AI confidence score in the Audit_Log.
4. THE STMS SHALL allow a Traffic_Controller to view the AI-recommended timing alongside the current timing before it is applied.
5. WHERE an Intersection is flagged as high-priority by the Traffic_Controller, THE AI_Engine SHALL recompute signal timing for that Intersection at intervals no greater than 2 minutes.

---

### Requirement 4: Incident Detection and Alerting

**User Story:** As a Traffic_Controller, I want the system to detect and alert me to traffic incidents and anomalies, so that I can respond quickly and minimize disruption.

#### Acceptance Criteria

1. WHEN the AI_Engine detects an Anomaly on a Road_Segment (vehicle count or speed deviating more than 2 standard deviations from the historical mean for that time window), THE STMS SHALL create an Incident record and send an alert to the Traffic_Controller within 30 seconds.
2. WHEN a Traffic_Controller manually reports an Incident, THE STMS SHALL create an Incident record with type, location (Road_Segment), severity, and timestamp, and record the action in the Audit_Log.
3. THE STMS SHALL support Incident types: Accident, Road_Closure, Debris, Flooding, and Other.
4. WHEN an Incident is created on a Road_Segment, THE STMS SHALL automatically set the Congestion_Level of that Road_Segment to at least "Heavy" until the Incident is resolved.
5. WHEN a Traffic_Controller marks an Incident as resolved, THE STMS SHALL update the Incident status, record the resolution timestamp and resolving user in the Audit_Log, and allow the Congestion_Level to return to sensor-computed values.
6. IF an Incident remains unresolved for more than 2 hours, THEN THE STMS SHALL escalate the alert and re-notify the Traffic_Controller.

---

### Requirement 5: Congestion Prediction

**User Story:** As a Traffic_Controller, I want the system to forecast congestion levels for the next 1–2 hours, so that I can proactively adjust signal timing before congestion develops.

#### Acceptance Criteria

1. THE AI_Engine SHALL generate Congestion_Level predictions for each Road_Segment for the next 60 minutes and 120 minutes, updated at intervals no greater than 15 minutes.
2. WHEN a prediction is generated, THE STMS SHALL store the predicted Congestion_Level, prediction timestamp, target time window, and model confidence score in the database.
3. THE STMS SHALL display current predictions alongside historical accuracy metrics on the Traffic_Controller dashboard.
4. WHEN the AI_Engine predicts a Congestion_Level of "Heavy" or "Gridlock" for a Road_Segment within the next 60 minutes, THE STMS SHALL proactively alert the Traffic_Controller.
5. THE STMS SHALL retain all historical predictions and actual outcomes to support model accuracy evaluation and retraining.

---

### Requirement 6: Route Recommendation for Drivers

**User Story:** As a Driver, I want to receive a recommended route between two points based on current and predicted traffic conditions, so that I can avoid congestion and reach my destination efficiently.

#### Acceptance Criteria

1. WHEN a Driver submits an origin and destination, THE STMS SHALL compute and return up to 3 ranked Route options within 3 seconds, ordered by estimated travel time.
2. THE STMS SHALL compute estimated travel time for each Route using current Congestion_Level and average speed data for each Road_Segment in the Route.
3. WHEN a Route passes through a Road_Segment with an active Incident, THE STMS SHALL label that Route as "affected by incident" and include the Incident type in the response.
4. THE STMS SHALL incorporate AI-predicted Congestion_Level data into route ranking when predictions are available and less than 15 minutes old.
5. IF no Route exists between the submitted origin and destination, THEN THE STMS SHALL return a descriptive message indicating no route is available.

---

### Requirement 7: Historical Data and Analytics

**User Story:** As a Traffic_Controller, I want to view historical traffic data and trend reports, so that I can identify peak hours, recurring congestion patterns, and the impact of past interventions.

#### Acceptance Criteria

1. THE STMS SHALL retain all traffic observation records for a minimum of 2 years, stored in the PostgreSQL database with appropriate indexing on Road_Segment ID and timestamp.
2. WHEN a Traffic_Controller requests a congestion trend report for a Road_Segment and date range, THE STMS SHALL return average Congestion_Level, peak Vehicle_Count, and peak hours for each day in the range within 5 seconds for ranges up to 90 days.
3. THE STMS SHALL provide a system-wide peak hour report identifying the top 5 most congested Road_Segments for any given week.
4. THE STMS SHALL generate a signal intervention report showing all manual overrides and AI timing changes for a specified Intersection and date range, sourced from the Audit_Log.
5. WHEN a Traffic_Controller requests an Incident history report, THE STMS SHALL return all Incidents for a specified Road_Segment or date range, including resolution time and resolving user.
6. THE STMS SHALL expose all analytics queries as stored procedures in PostgreSQL to ensure consistent, reusable, and permission-controlled data access.

---

### Requirement 8: User Authentication and Role Management

**User Story:** As a system administrator, I want to manage user accounts and roles, so that Traffic_Controllers and Drivers have access only to the features appropriate for their role.

#### Acceptance Criteria

1. THE STMS SHALL support two user roles: Traffic_Controller and Driver, enforced at the API and database levels.
2. WHEN a user logs in with valid credentials, THE STMS SHALL issue a session token valid for 8 hours for Traffic_Controllers and 24 hours for Drivers.
3. IF a user submits incorrect credentials 5 consecutive times, THEN THE STMS SHALL lock the account for 15 minutes and record the lockout event in the Audit_Log.
4. WHEN a Traffic_Controller performs any state-changing action (signal override, incident creation, incident resolution), THE STMS SHALL record the action, the user ID, and the timestamp in the Audit_Log via a database trigger.
5. THE STMS SHALL prevent a Driver from accessing Traffic_Controller endpoints, enforced by API middleware and database row-level security where applicable.

---

### Requirement 9: Data Integrity and Database Constraints

**User Story:** As a system architect, I want the database to enforce data integrity rules, so that invalid or inconsistent traffic data cannot be stored.

#### Acceptance Criteria

1. THE STMS SHALL enforce a CHECK constraint on Congestion_Level columns to allow only the values: Free, Moderate, Heavy, Gridlock.
2. THE STMS SHALL enforce a CHECK constraint on Signal_Phase duration columns to allow only values between 10 and 180 seconds.
3. THE STMS SHALL enforce FOREIGN KEY constraints between Road_Segments, Intersections, Traffic_Signals, and Incidents to prevent orphaned records.
4. WHEN a traffic observation record is inserted, THE STMS SHALL enforce a NOT NULL constraint on Road_Segment ID, timestamp, vehicle count, and average speed.
5. THE STMS SHALL use database transactions for all multi-step operations (e.g., creating an Incident and updating Road_Segment Congestion_Level) to ensure atomicity.
6. THE STMS SHALL implement an append-only Audit_Log table enforced by a database trigger that prevents UPDATE and DELETE operations on Audit_Log rows.

---

### Requirement 10: System Reliability and Performance

**User Story:** As a Traffic_Controller and Driver, I want the system to be reliably available and responsive, so that traffic management operations are never disrupted.

#### Acceptance Criteria

1. THE STMS SHALL maintain a minimum uptime of 99.5% measured on a rolling 30-day basis.
2. WHEN the STMS API receives a dashboard data request from a Traffic_Controller, THE STMS SHALL respond within 2 seconds under normal load (up to 50 concurrent users).
3. IF the AI_Engine is unavailable, THEN THE STMS SHALL continue operating with manual signal control and sensor-based Congestion_Level computation, and alert the Traffic_Controller of the degraded mode.
4. THE STMS SHALL use database connection pooling to support up to 100 concurrent database connections without degradation.
5. WHEN the STMS is restored after an outage, THE STMS SHALL reconcile all Traffic_Signal states and active Incidents from the database before resuming normal operations.

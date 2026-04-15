/**
 * Incident Escalation Scheduler
 * Requirements: 4.6
 *
 * Calls escalate_overdue_incidents() stored procedure every 5 minutes.
 * Emits incident:escalated SSE event for each escalated incident.
 */

import { escalateOverdueIncidents } from "@/lib/db/queries/storedProcedures";
import { emitSSE } from "@/lib/sse/emitter";
import { prisma } from "@/lib/db/prisma";

const ESCALATION_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

let escalationTimer: NodeJS.Timeout | null = null;

/**
 * Start the incident escalation scheduler.
 * Should be called once on first SSE connection.
 */
export function startIncidentEscalator(): void {
  if (escalationTimer) {
    console.log("Incident escalator already running");
    return;
  }

  console.log("Starting incident escalation scheduler (every 5 minutes)");

  // Run immediately on start
  runEscalation();

  // Then run every 5 minutes
  escalationTimer = setInterval(() => {
    runEscalation();
  }, ESCALATION_INTERVAL_MS);
}

/**
 * Stop the incident escalation scheduler.
 * Useful for cleanup in tests or graceful shutdown.
 */
export function stopIncidentEscalator(): void {
  if (escalationTimer) {
    clearInterval(escalationTimer);
    escalationTimer = null;
    console.log("Incident escalation scheduler stopped");
  }
}

/**
 * Execute one escalation cycle.
 */
async function runEscalation(): Promise<void> {
  try {
    // Call stored procedure
    const escalatedCount = await escalateOverdueIncidents();

    if (escalatedCount > 0) {
      console.log(`Escalated ${escalatedCount} overdue incident(s)`);

      // Fetch escalated incidents to emit SSE events
      const escalatedIncidents = await prisma.incident.findMany({
        where: {
          status: "Escalated",
          updatedAt: {
            // Fetch incidents escalated in the last minute
            gte: new Date(Date.now() - 60 * 1000),
          },
        },
        include: {
          segment: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      // Emit SSE event for each escalated incident
      for (const incident of escalatedIncidents) {
        emitSSE("incident:escalated", {
          incidentId: incident.id,
          segmentId: incident.segmentId,
          segmentName: incident.segment.name,
          type: incident.type,
          severity: incident.severity,
          createdAt: incident.createdAt.toISOString(),
        });
      }
    }
  } catch (error) {
    console.error("Error during incident escalation:", error);
  }
}

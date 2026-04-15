/**
 * Typed query wrappers for audit log
 * Requirements: 10.4
 */

import { prisma } from "@/lib/db/prisma";
import type { AuditEntry, AuditAction } from "@/types";

/**
 * Get audit log entries with optional filters
 */
export async function getAuditLog(options?: {
  userId?: string;
  action?: AuditAction;
  signalId?: string;
  incidentId?: string;
  limit?: number;
}): Promise<AuditEntry[]> {
  const { userId, action, signalId, incidentId, limit = 100 } = options ?? {};

  const entries = await prisma.auditLog.findMany({
    where: {
      ...(userId && { userId }),
      ...(action && { action }),
      ...(signalId && { signalId }),
      ...(incidentId && { incidentId }),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return entries.map((e) => ({
    id: e.id,
    action: e.action,
    userId: e.userId,
    signalId: e.signalId,
    incidentId: e.incidentId,
    metadata: e.metadata as Record<string, unknown> | null,
    createdAt: e.createdAt.toISOString(),
  }));
}

/**
 * Get audit log entries for a specific user
 */
export async function getAuditLogByUser(
  userId: string,
  limit = 50
): Promise<AuditEntry[]> {
  return getAuditLog({ userId, limit });
}

/**
 * Get audit log entries for a specific signal
 */
export async function getAuditLogBySignal(
  signalId: string,
  limit = 50
): Promise<AuditEntry[]> {
  return getAuditLog({ signalId, limit });
}

/**
 * Get audit log entries for a specific incident
 */
export async function getAuditLogByIncident(
  incidentId: string,
  limit = 50
): Promise<AuditEntry[]> {
  return getAuditLog({ incidentId, limit });
}

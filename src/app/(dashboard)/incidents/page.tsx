"use client";

/**
 * Incidents Feed Page
 * Requirements: 4.1, 4.6
 */

import { useTrafficStore } from "@/store/useTrafficStore";
import IncidentFeed from "@/components/incidents/IncidentFeed";
import ClayButton from "@/components/ui/ClayButton";
import Link from "next/link";

export default function IncidentsPage() {
  const incidents = useTrafficStore((state) => state.incidents);
  const incidentList = Object.values(incidents);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[var(--clay-text)]">
            Incident Management
          </h1>
          <p className="mt-2 text-sm text-[var(--clay-muted)]">
            Monitor and respond to traffic incidents in real-time
          </p>
        </div>
        <Link href="/incidents/new">
          <ClayButton variant="primary">Report Incident</ClayButton>
        </Link>
      </div>

      <IncidentFeed incidents={incidentList} />
    </div>
  );
}

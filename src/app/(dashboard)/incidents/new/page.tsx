"use client";

/**
 * Report New Incident Page
 * Requirements: 4.2, 4.3
 */

import IncidentForm from "@/components/incidents/IncidentForm";

export default function NewIncidentPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <IncidentForm />
    </div>
  );
}

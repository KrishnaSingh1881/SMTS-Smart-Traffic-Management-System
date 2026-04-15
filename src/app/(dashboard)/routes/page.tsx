"use client";

/**
 * Route query page for Drivers
 * Requirements: 6.1, 6.2, 6.3
 *
 * Role-gated to Driver only
 */

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import ClayInput from "@/components/ui/ClayInput";
import ClayButton from "@/components/ui/ClayButton";
import ClayCard from "@/components/ui/ClayCard";
import ClayBadge from "@/components/ui/ClayBadge";
import { staggerChildren, fadeInUp } from "@/lib/utils/motion";

interface RouteResult {
  segments: string[];
  estimatedTravelTimeSeconds: number;
  affectedByIncident: boolean;
  incidentTypes?: string[];
}

interface RouteResponse {
  routes: RouteResult[];
  message?: string;
}

interface Segment {
  id: string;
  name: string;
}

export default function RoutesPage() {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [originId, setOriginId] = useState("");
  const [destinationId, setDestinationId] = useState("");
  const [originSearch, setOriginSearch] = useState("");
  const [destinationSearch, setDestinationSearch] = useState("");
  const [routes, setRoutes] = useState<RouteResult[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch segments for autocomplete
  useEffect(() => {
    async function fetchSegments() {
      try {
        const res = await fetch("/api/monitoring/segments");
        if (res.ok) {
          const data = await res.json();
          setSegments(data.segments || []);
        }
      } catch (err) {
        console.error("Failed to fetch segments:", err);
      }
    }
    fetchSegments();
  }, []);

  // Filter segments for autocomplete
  const filteredOriginSegments = segments.filter((s) =>
    s.name.toLowerCase().includes(originSearch.toLowerCase())
  );

  const filteredDestinationSegments = segments.filter((s) =>
    s.name.toLowerCase().includes(destinationSearch.toLowerCase())
  );

  const handleQueryRoutes = async () => {
    if (!originId || !destinationId) {
      setError("Please select both origin and destination");
      return;
    }

    setIsLoading(true);
    setError(null);
    setMessage(null);
    setRoutes([]);

    try {
      const res = await fetch("/api/routes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin_segment_id: originId,
          destination_segment_id: destinationId,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to query routes");
      }

      const data: RouteResponse = await res.json();
      setRoutes(data.routes || []);
      setMessage(data.message || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${remainingSeconds}s`;
  };

  const selectOrigin = (segment: Segment) => {
    setOriginId(segment.id);
    setOriginSearch(segment.name);
  };

  const selectDestination = (segment: Segment) => {
    setDestinationId(segment.id);
    setDestinationSearch(segment.name);
  };

  return (
    <div className="container mx-auto max-w-4xl p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-[var(--clay-text)] mb-2">
          Route Recommendations
        </h1>
        <p className="text-[var(--clay-muted)]">
          Find the best route based on current traffic conditions
        </p>
      </div>

      <ClayCard>
        <div className="space-y-4">
          {/* Origin selector */}
          <div className="relative">
            <ClayInput
              label="Origin"
              placeholder="Search for origin segment..."
              value={originSearch}
              onChange={(e) => {
                setOriginSearch(e.target.value);
                setOriginId("");
              }}
            />
            {originSearch && !originId && filteredOriginSegments.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-[var(--clay-surface)] border border-[var(--clay-border)] rounded-clay shadow-clay max-h-48 overflow-y-auto">
                {filteredOriginSegments.slice(0, 10).map((segment) => (
                  <button
                    key={segment.id}
                    onClick={() => selectOrigin(segment)}
                    className="w-full text-left px-4 py-2 hover:bg-[var(--clay-accent)]/10 text-sm text-[var(--clay-text)]"
                  >
                    {segment.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Destination selector */}
          <div className="relative">
            <ClayInput
              label="Destination"
              placeholder="Search for destination segment..."
              value={destinationSearch}
              onChange={(e) => {
                setDestinationSearch(e.target.value);
                setDestinationId("");
              }}
            />
            {destinationSearch &&
              !destinationId &&
              filteredDestinationSegments.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-[var(--clay-surface)] border border-[var(--clay-border)] rounded-clay shadow-clay max-h-48 overflow-y-auto">
                  {filteredDestinationSegments.slice(0, 10).map((segment) => (
                    <button
                      key={segment.id}
                      onClick={() => selectDestination(segment)}
                      className="w-full text-left px-4 py-2 hover:bg-[var(--clay-accent)]/10 text-sm text-[var(--clay-text)]"
                    >
                      {segment.name}
                    </button>
                  ))}
                </div>
              )}
          </div>

          <ClayButton
            onClick={handleQueryRoutes}
            isLoading={isLoading}
            disabled={!originId || !destinationId}
            className="w-full"
          >
            Find Routes
          </ClayButton>

          {error && (
            <p className="text-sm text-[var(--clay-danger)]">{error}</p>
          )}
        </div>
      </ClayCard>

      {/* Results */}
      {message && (
        <ClayCard>
          <p className="text-[var(--clay-muted)]">{message}</p>
        </ClayCard>
      )}

      {routes.length > 0 && (
        <motion.div
          variants={staggerChildren}
          initial="hidden"
          animate="visible"
          className="space-y-4"
        >
          {routes.map((route, index) => (
            <motion.div key={index} variants={fadeInUp}>
              <ClayCard>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-[var(--clay-text)]">
                      Route {index + 1}
                    </h3>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-[var(--clay-accent)]">
                        {formatTime(route.estimatedTravelTimeSeconds)}
                      </p>
                      <p className="text-xs text-[var(--clay-muted)]">
                        Estimated time
                      </p>
                    </div>
                  </div>

                  {route.affectedByIncident && (
                    <div className="flex items-center gap-2">
                      <ClayBadge variant="danger">
                        ⚠️ Incident on route
                      </ClayBadge>
                      {route.incidentTypes && route.incidentTypes.length > 0 && (
                        <span className="text-xs text-[var(--clay-muted)]">
                          {route.incidentTypes.join(", ")}
                        </span>
                      )}
                    </div>
                  )}

                  <div>
                    <p className="text-sm font-medium text-[var(--clay-text)] mb-2">
                      Route segments ({route.segments.length})
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {route.segments.map((segmentId, idx) => {
                        const segment = segments.find((s) => s.id === segmentId);
                        return (
                          <span
                            key={idx}
                            className="text-xs px-2 py-1 bg-[var(--clay-accent)]/10 text-[var(--clay-text)] rounded"
                          >
                            {segment?.name || segmentId.slice(0, 8)}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </ClayCard>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}

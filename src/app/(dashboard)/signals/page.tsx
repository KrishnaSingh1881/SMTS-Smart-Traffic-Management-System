"use client";

/**
 * Traffic Signals List Page
 * Requirements: 2.1, 2.3
 */

import { useTrafficStore } from "@/store/useTrafficStore";
import ClayCard from "@/components/ui/ClayCard";
import ClayBadge from "@/components/ui/ClayBadge";
import SignalStatusRing from "@/components/signals/SignalStatusRing";
import Link from "next/link";

export default function SignalsPage() {
  const signals = useTrafficStore((state) => state.signals);
  const signalList = Object.values(signals);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-[var(--clay-text)]">
          Traffic Signals
        </h1>
        <p className="mt-2 text-sm text-[var(--clay-muted)]">
          Monitor and control traffic signal phases across all intersections
        </p>
      </div>

      {signalList.length === 0 ? (
        <ClayCard>
          <p className="text-center text-[var(--clay-muted)]">
            No signals available
          </p>
        </ClayCard>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {signalList.map((signal) => (
            <Link key={signal.id} href={`/signals/${signal.id}`}>
              <ClayCard className="cursor-pointer transition-all hover:shadow-lg">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-[var(--clay-text)]">
                      {signal.label}
                    </h3>
                    <p className="mt-1 text-xs text-[var(--clay-muted)]">
                      Intersection ID: {signal.intersectionId}
                    </p>
                  </div>
                  <SignalStatusRing
                    phase={signal.currentPhase}
                    size={48}
                  />
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {signal.overrideActive && (
                    <ClayBadge variant="warning">Manual Override</ClayBadge>
                  )}
                  {!signal.isOnline && (
                    <ClayBadge variant="danger">Offline</ClayBadge>
                  )}
                  {signal.aiOptimized && !signal.overrideActive && (
                    <ClayBadge variant="accent">AI Optimized</ClayBadge>
                  )}
                </div>

                <div className="mt-3 text-xs text-[var(--clay-muted)]">
                  Last updated:{" "}
                  {new Date(signal.lastUpdatedAt).toLocaleString()}
                </div>
              </ClayCard>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

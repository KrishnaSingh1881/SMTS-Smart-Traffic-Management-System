"use client";

/**
 * Analytics Hub Page
 * Navigation cards to all analytics sub-pages
 * Requirements: 7.4, 7.5
 */

import Link from "next/link";
import ClayCard from "@/components/ui/ClayCard";

const analyticsPages = [
  {
    title: "Congestion Trend",
    description: "View historical congestion patterns and peak hours for road segments",
    href: "/analytics/congestion-trend",
    icon: "📊",
  },
  {
    title: "Peak Hours Report",
    description: "Top 5 most congested segments for any given week",
    href: "/analytics/peak-hours",
    icon: "⏰",
  },
  {
    title: "Signal Interventions",
    description: "Signal override and AI update history from audit logs",
    href: "/analytics/interventions",
    icon: "🚦",
  },
];

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-[var(--clay-text)]">
          Analytics Hub
        </h1>
        <p className="mt-2 text-sm text-[var(--clay-muted)]">
          Access historical traffic data and trend reports
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {analyticsPages.map((page) => (
          <Link key={page.href} href={page.href}>
            <ClayCard className="h-full cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02]">
              <div className="flex flex-col gap-4">
                <div className="text-4xl">{page.icon}</div>
                <div>
                  <h2 className="text-xl font-semibold text-[var(--clay-text)]">
                    {page.title}
                  </h2>
                  <p className="mt-2 text-sm text-[var(--clay-muted)]">
                    {page.description}
                  </p>
                </div>
              </div>
            </ClayCard>
          </Link>
        ))}
      </div>
    </div>
  );
}

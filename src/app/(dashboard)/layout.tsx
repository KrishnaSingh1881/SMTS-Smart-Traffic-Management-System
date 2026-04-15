"use client";

/**
 * Dashboard shell layout
 * Requirements: 1.3, 10.5
 *
 * Renders Sidebar + TopBar + SSEProvider around all dashboard pages.
 * Wraps the content area with Framer Motion AnimatePresence for route transitions.
 * On mount, fetches initial state from API to hydrate Zustand store (startup reconciliation).
 */

import { SessionProvider } from "next-auth/react";
import { AnimatePresence, motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";
import SSEProvider from "@/components/layout/SSEProvider";
import { fadeInUp } from "@/lib/utils/motion";
import { useTrafficStore } from "@/store/useTrafficStore";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { setSegments, setSignals } = useTrafficStore();

  // Startup state reconciliation (Req 10.5)
  useEffect(() => {
    async function hydrateStore() {
      try {
        // Fetch segments
        const segmentsRes = await fetch("/api/monitoring/segments");
        if (segmentsRes.ok) {
          const segmentsData = await segmentsRes.json();
          setSegments(Array.isArray(segmentsData) ? segmentsData : (segmentsData.segments ?? []));
        }

        // Fetch signals
        const signalsRes = await fetch("/api/signals");
        if (signalsRes.ok) {
          const signalsData = await signalsRes.json();
          setSignals(Array.isArray(signalsData) ? signalsData : (signalsData.signals ?? []));
        }
      } catch (error) {
        console.error("[DashboardLayout] Failed to hydrate store:", error);
      }
    }

    hydrateStore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SessionProvider>
      <div className="flex min-h-screen bg-[var(--clay-bg)]">
        {/* Sidebar */}
        <Sidebar />

        {/* Main content column */}
        <div className="flex flex-col flex-1 min-w-0">
          {/* Top bar */}
          <TopBar />

          {/* Page content with SSE + animated transitions */}
          <SSEProvider>
            <main className="flex-1 overflow-auto p-6">
              <AnimatePresence mode="wait">
                <motion.div
                  key={pathname}
                  variants={fadeInUp}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="h-full"
                >
                  {children}
                </motion.div>
              </AnimatePresence>
            </main>
          </SSEProvider>
        </div>
      </div>
    </SessionProvider>
  );
}

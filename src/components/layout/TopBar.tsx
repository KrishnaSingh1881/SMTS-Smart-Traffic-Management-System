"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import ClayBadge from "@/components/ui/ClayBadge";
import ClayButton from "@/components/ui/ClayButton";
import { cn } from "@/lib/utils/cn";
import { useTrafficStore } from "@/store/useTrafficStore";

function getInitials(name?: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function TopBar() {
  const { data: session } = useSession();
  const user = session?.user;
  const [isDark, setIsDark] = useState(false);
  const [aiAlertDismissed, setAiAlertDismissed] = useState(false);
  const { aiDegraded, setAiDegraded } = useTrafficStore();

  // Hydrate theme from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
      setIsDark(true);
    }
  }, []);

  function toggleTheme() {
    const next = isDark ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
    setIsDark(!isDark);
  }

  function dismissAiAlert() {
    setAiAlertDismissed(true);
    // Reset the degraded flag in store
    setAiDegraded(false);
  }

  // Show AI degraded warning if active and not dismissed
  const showAiWarning = aiDegraded && !aiAlertDismissed;

  useEffect(() => {
    if (aiDegraded) {
      setAiAlertDismissed(false);
    }
  }, [aiDegraded]);

  // Auto-dismiss on mount — don't show stale AI warning from previous session
  useEffect(() => {
    setAiDegraded(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <header
      className={cn(
        "flex flex-col",
        "bg-[var(--clay-surface)] border-b border-[var(--clay-border)]",
        "shadow-clay"
      )}
    >
      {/* AI Degraded Warning Banner */}
      {showAiWarning && (
        <div
          className={cn(
            "flex items-center justify-between px-6 py-2",
            "bg-amber-500/10 border-b border-amber-500/20"
          )}
        >
          <div className="flex items-center gap-3">
            <ClayBadge variant="warning" className="text-xs">
              AI Unavailable
            </ClayBadge>
            <span className="text-sm text-[var(--clay-text-secondary)]">
              AI optimization is currently unavailable. System operating in
              manual mode.
            </span>
          </div>
          <ClayButton
            variant="ghost"
            size="sm"
            onClick={dismissAiAlert}
            aria-label="Dismiss AI warning"
          >
            Dismiss
          </ClayButton>
        </div>
      )}

      {/* Main TopBar */}
      <div className="flex items-center justify-between px-6 py-3">
          {/* Left: page context placeholder */}
        <div />

        {/* Right: controls + user info */}
        <div className="flex items-center gap-4">
        {/* Theme toggle */}
        <ClayButton
          variant="ghost"
          size="sm"
          onClick={toggleTheme}
          aria-label="Toggle theme"
          title={isDark ? "Switch to light mode" : "Switch to dark mode"}
        >
          {isDark ? (
            // Sun icon
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
          ) : (
            // Moon icon
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </ClayButton>

        {/* User info */}
        {user && (
          <div className="flex items-center gap-3">
            {/* Initials avatar */}
            <div
              className={cn(
                "flex items-center justify-center w-8 h-8 rounded-full",
                "bg-[var(--clay-accent)]/20 text-[var(--clay-accent)]",
                "text-xs font-bold shadow-clay-inset border border-[var(--clay-border)]"
              )}
              title={user.name ?? undefined}
            >
              {getInitials(user.name)}
            </div>

            {/* Name + role badge */}
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-medium text-[var(--clay-text)]">
                {user.name ?? user.email}
              </span>
              <ClayBadge
                variant="accent"
                className="mt-0.5 text-[10px] px-2 py-0.5"
              >
                {user.role}
              </ClayBadge>
            </div>
          </div>
        )}

        {/* Sign out */}
        <ClayButton
          variant="danger"
          size="sm"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          Sign out
        </ClayButton>
      </div>
      </div>
    </header>
  );
}

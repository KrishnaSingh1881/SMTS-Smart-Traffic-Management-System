"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils/cn";

const navItems = [
  {
    label: "Monitoring",
    href: "/monitoring",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    ),
    roles: ["Traffic_Controller", "Driver"],
  },
  {
    label: "Signals",
    href: "/signals",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="6" r="2" />
        <circle cx="12" cy="12" r="2" />
        <circle cx="12" cy="18" r="2" />
        <rect x="6" y="2" width="12" height="20" rx="3" />
      </svg>
    ),
    roles: ["Traffic_Controller", "Driver"],
  },
  {
    label: "Incidents",
    href: "/incidents",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
    roles: ["Traffic_Controller", "Driver"],
  },
  {
    label: "Predictions",
    href: "/predictions",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
    roles: ["Traffic_Controller", "Driver"],
  },
  {
    label: "Analytics",
    href: "/analytics",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
    roles: ["Traffic_Controller", "Driver"],
  },
  {
    label: "Routes",
    href: "/routes",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="6" cy="19" r="3" />
        <path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" />
        <circle cx="18" cy="5" r="3" />
      </svg>
    ),
    roles: ["Driver"], // hidden for Traffic_Controller (Req 8.5)
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = session?.user?.role;

  const visibleItems = navItems.filter(
    (item) => !role || item.roles.includes(role)
  );

  return (
    <aside
      className={cn(
        "flex flex-col w-64 min-h-screen",
        "bg-[var(--clay-surface)] border-r border-[var(--clay-border)]",
        "shadow-clay"
      )}
    >
      {/* Logo / Title */}
      <div className="flex items-center gap-3 px-6 py-6 border-b border-[var(--clay-border)]">
        <div
          className={cn(
            "flex items-center justify-center w-9 h-9 rounded-clay",
            "bg-[var(--clay-accent)] text-white font-bold text-sm shadow-clay"
          )}
        >
          S
        </div>
        <div>
          <p className="font-bold text-sm text-[var(--clay-text)] leading-tight">
            STMS
          </p>
          <p className="text-xs text-[var(--clay-muted)]">Traffic System</p>
        </div>
      </div>

      {/* Nav Links */}
      <nav className="flex flex-col gap-1 px-3 py-4 flex-1">
        {visibleItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-clay",
                "text-sm font-medium transition-all duration-150",
                isActive
                  ? "bg-[var(--clay-accent)]/15 text-[var(--clay-accent)] shadow-clay-inset"
                  : "text-[var(--clay-muted)] hover:bg-[var(--clay-bg)] hover:text-[var(--clay-text)]"
              )}
            >
              <span
                className={
                  isActive
                    ? "text-[var(--clay-accent)]"
                    : "text-[var(--clay-muted)]"
                }
              >
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

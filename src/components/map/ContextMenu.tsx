"use client";

/**
 * ContextMenu component
 * Right-click context menu on road segments for event injection.
 * Requirements: 5.3, 10.1, 10.2, 10.3
 *
 * Props:
 *   segmentId  — the right-clicked segment (null = hidden)
 *   position   — screen coordinates { x, y } for placement
 *   onClose    — called after successful submission or outside click
 */

import { useEffect, useRef, useState } from "react";
import ClayButton from "@/components/ui/ClayButton";
import { useToast } from "@/hooks/useToast";
import { ToastNotification } from "@/components/ui/ToastNotification";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Values must match the IncidentType enum accepted by POST /api/incidents */
type EventType = "Accident" | "Road_Closure" | "Debris" | "Flooding" | "Other";

const EVENT_TYPES: { value: EventType; label: string }[] = [
  { value: "Accident",     label: "Accident"      },
  { value: "Road_Closure", label: "Road Closure"  },
  { value: "Debris",       label: "Debris"        },
  { value: "Flooding",     label: "Flooding"      },
  { value: "Other",        label: "Other"         },
];

type Step = "root" | "select" | "confirm";

interface ContextMenuProps {
  segmentId: string | null;
  position: { x: number; y: number } | null;
  onClose: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ContextMenu({ segmentId, position, onClose }: ContextMenuProps) {
  const [step, setStep] = useState<Step>("root");
  const [selectedType, setSelectedType] = useState<EventType | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const { toast, showToast, dismissToast } = useToast();

  // Reset internal state whenever the menu opens for a new segment
  useEffect(() => {
    if (segmentId) {
      setStep("root");
      setSelectedType(null);
      setError(null);
      setSubmitting(false);
    }
  }, [segmentId]);

  // Close on outside click
  useEffect(() => {
    if (!segmentId) return;

    function handlePointerDown(e: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [segmentId, onClose]);

  // Close on Escape
  useEffect(() => {
    if (!segmentId) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [segmentId, onClose]);

  if (!segmentId || !position) return null;

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleSelectType(type: EventType) {
    setSelectedType(type);
    setStep("confirm");
    setError(null);
  }

  async function handleConfirm() {
    if (!selectedType || !segmentId) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          segment_id: segmentId,
          type: selectedType,
          severity: 3,
          description: "Manually injected event",
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? `Request failed (${res.status})`);
      }

      showToast("Event injected successfully", "success");
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to inject event";
      setError(msg);
      showToast("Failed to inject event: " + msg, "error");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Positioning ───────────────────────────────────────────────────────────
  // Keep the menu on-screen by nudging left/up if it would overflow
  const MENU_W = 192; // approximate width
  const MENU_H = step === "select" ? 240 : 120;
  const left = Math.min(position.x, window.innerWidth  - MENU_W - 8);
  const top  = Math.min(position.y, window.innerHeight - MENU_H - 8);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
    <div
      ref={menuRef}
      role="menu"
      aria-label="Segment context menu"
      style={{
        position: "fixed",
        left,
        top,
        zIndex: 9999,
        minWidth: MENU_W,
        background: "linear-gradient(135deg, var(--clay-surface-raised) 0%, var(--clay-surface) 100%)",
        border: "1px solid var(--clay-border)",
        borderRadius: "var(--clay-border-radius)",
        boxShadow: "var(--clay-shadow-lg)",
        backdropFilter: "blur(var(--clay-blur))",
      }}
    >
      {/* ── Root step: show "Inject Event" option ── */}
      {step === "root" && (
        <div className="py-1">
          <button
            role="menuitem"
            onClick={() => setStep("select")}
            className="w-full text-left px-4 py-2.5 text-sm font-medium flex items-center gap-2 transition-colors duration-100"
            style={{ color: "var(--clay-text)" }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "var(--clay-surface-raised)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "transparent")
            }
          >
            <span aria-hidden>⚡</span>
            Inject Event
          </button>
        </div>
      )}

      {/* ── Select step: choose event type ── */}
      {step === "select" && (
        <div>
          <div
            className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wider border-b"
            style={{ color: "var(--clay-text-muted)", borderColor: "var(--clay-border)" }}
          >
            Select Event Type
          </div>
          <div className="py-1">
            {EVENT_TYPES.map(({ value, label }) => (
              <button
                key={value}
                role="menuitem"
                onClick={() => handleSelectType(value)}
                className="w-full text-left px-4 py-2 text-sm transition-colors duration-100"
                style={{ color: "var(--clay-text)" }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "var(--clay-surface-raised)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "transparent")
                }
              >
                {label}
              </button>
            ))}
          </div>
          <div
            className="px-4 py-2 border-t"
            style={{ borderColor: "var(--clay-border)" }}
          >
            <button
              onClick={() => setStep("root")}
              className="text-xs"
              style={{ color: "var(--clay-text-muted)" }}
            >
              ← Back
            </button>
          </div>
        </div>
      )}

      {/* ── Confirm step ── */}
      {step === "confirm" && selectedType && (
        <div className="p-4 flex flex-col gap-3">
          <p className="text-sm" style={{ color: "var(--clay-text)" }}>
            Inject{" "}
            <span className="font-semibold">
              {EVENT_TYPES.find((t) => t.value === selectedType)?.label}
            </span>{" "}
            on this segment?
          </p>

          {error && (
            <p className="text-xs" style={{ color: "var(--clay-danger)" }}>
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <ClayButton
              variant="primary"
              size="sm"
              isLoading={submitting}
              onClick={handleConfirm}
              className="flex-1"
            >
              Confirm
            </ClayButton>
            <ClayButton
              variant="ghost"
              size="sm"
              disabled={submitting}
              onClick={() => setStep("select")}
            >
              Back
            </ClayButton>
          </div>
        </div>
      )}
    </div>
    {toast && (
      <ToastNotification
        message={toast.message}
        type={toast.type}
        onDismiss={dismissToast}
      />
    )}
  </>
  );
}

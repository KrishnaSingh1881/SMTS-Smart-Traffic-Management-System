"use client";

/**
 * EmergencyDispatchModal component
 * Modal with Origin/Destination intersection pickers for emergency dispatch.
 * Requirements: 15.2, 15.3
 */

import { useEffect, useRef, useState } from "react";
import ClayButton from "@/components/ui/ClayButton";
import { ToastNotification } from "@/components/ui/ToastNotification";
import { useToast } from "@/hooks/useToast";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Intersection {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

interface SignalWithIntersection {
  id: string;
  intersection: Intersection;
}

interface EmergencyDispatchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function EmergencyDispatchModal({
  isOpen,
  onClose,
}: EmergencyDispatchModalProps) {
  const [intersections, setIntersections] = useState<Intersection[]>([]);
  const [loadingIntersections, setLoadingIntersections] = useState(false);
  const [originId, setOriginId] = useState("");
  const [destinationId, setDestinationId] = useState("");
  const [dispatching, setDispatching] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const { toast, showToast, dismissToast } = useToast();
  const backdropRef = useRef<HTMLDivElement>(null);

  // Fetch intersections when modal opens
  useEffect(() => {
    if (!isOpen) return;

    setOriginId("");
    setDestinationId("");
    setInlineError(null);
    setLoadingIntersections(true);

    fetch("/api/signals")
      .then((res) => res.json())
      .then((signals: SignalWithIntersection[]) => {
        // Deduplicate intersections by id
        const seen = new Set<string>();
        const unique: Intersection[] = [];
        for (const signal of signals) {
          if (signal.intersection && !seen.has(signal.intersection.id)) {
            seen.add(signal.intersection.id);
            unique.push(signal.intersection);
          }
        }
        setIntersections(unique);
      })
      .catch(() => {
        setInlineError("Failed to load intersections. Please try again.");
      })
      .finally(() => setLoadingIntersections(false));
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function handleDispatch() {
    if (!originId || !destinationId) return;
    setDispatching(true);
    setInlineError(null);

    try {
      const res = await fetch("/api/emergency/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ originId, destinationId }),
      });

      if (res.status === 422) {
        setInlineError("No route found between selected intersections");
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg = (data as { error?: string }).error ?? `Request failed (${res.status})`;
        setInlineError(msg);
        return;
      }

      showToast("Emergency vehicle dispatched successfully", "success");
      onClose();
    } catch {
      setInlineError("Network error. Please try again.");
    } finally {
      setDispatching(false);
    }
  }

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === backdropRef.current) onClose();
  }

  const canDispatch =
    !!originId && !!destinationId && originId !== destinationId && !dispatching;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Backdrop */}
      <div
        ref={backdropRef}
        onClick={handleBackdropClick}
        className="fixed inset-0 z-50 flex items-center justify-center"
        style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(2px)" }}
        aria-modal="true"
        role="dialog"
        aria-labelledby="emergency-modal-title"
      >
        {/* Modal panel */}
        <div
          className="relative w-full max-w-md mx-4 rounded-clay shadow-clay border"
          style={{
            background:
              "linear-gradient(135deg, var(--clay-surface-raised) 0%, var(--clay-surface) 100%)",
            borderColor: "var(--clay-border)",
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-6 py-4 border-b"
            style={{ borderColor: "var(--clay-border)" }}
          >
            <div className="flex items-center gap-2">
              <span className="text-lg" aria-hidden>
                🚨
              </span>
              <h2
                id="emergency-modal-title"
                className="text-base font-semibold"
                style={{ color: "var(--clay-text)" }}
              >
                Dispatch Emergency Vehicle
              </h2>
            </div>
            <button
              onClick={onClose}
              aria-label="Close modal"
              className="text-sm transition-colors focus:outline-none"
              style={{ color: "var(--clay-muted)" }}
            >
              ✕
            </button>
          </div>

          {/* Body */}
          <div className="px-6 py-5 flex flex-col gap-5">
            {loadingIntersections ? (
              <div
                className="flex items-center justify-center py-8 text-sm"
                style={{ color: "var(--clay-muted)" }}
              >
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" />
                Loading intersections…
              </div>
            ) : (
              <>
                {/* Origin picker */}
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="origin-select"
                    className="text-xs font-semibold uppercase tracking-wider"
                    style={{ color: "var(--clay-muted)" }}
                  >
                    Origin
                  </label>
                  <select
                    id="origin-select"
                    value={originId}
                    onChange={(e) => {
                      setOriginId(e.target.value);
                      setInlineError(null);
                    }}
                    className="w-full rounded-clay border px-3 py-2 text-sm focus:outline-none focus:ring-1"
                    style={{
                      background: "var(--clay-surface)",
                      borderColor: "var(--clay-border)",
                      color: "var(--clay-text)",
                    }}
                  >
                    <option value="">Select origin intersection…</option>
                    {intersections.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Destination picker */}
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="destination-select"
                    className="text-xs font-semibold uppercase tracking-wider"
                    style={{ color: "var(--clay-muted)" }}
                  >
                    Destination
                  </label>
                  <select
                    id="destination-select"
                    value={destinationId}
                    onChange={(e) => {
                      setDestinationId(e.target.value);
                      setInlineError(null);
                    }}
                    className="w-full rounded-clay border px-3 py-2 text-sm focus:outline-none focus:ring-1"
                    style={{
                      background: "var(--clay-surface)",
                      borderColor: "var(--clay-border)",
                      color: "var(--clay-text)",
                    }}
                  >
                    <option value="">Select destination intersection…</option>
                    {intersections.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Same-intersection warning */}
                {originId && destinationId && originId === destinationId && (
                  <p className="text-xs" style={{ color: "var(--clay-danger)" }}>
                    Origin and destination must be different intersections.
                  </p>
                )}

                {/* Inline error */}
                {inlineError && (
                  <p
                    role="alert"
                    className="text-xs px-3 py-2 rounded-clay border"
                    style={{
                      color: "var(--clay-danger)",
                      borderColor: "var(--clay-danger)",
                      background: "rgba(239,68,68,0.08)",
                    }}
                  >
                    {inlineError}
                  </p>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          {!loadingIntersections && (
            <div
              className="flex justify-end gap-3 px-6 py-4 border-t"
              style={{ borderColor: "var(--clay-border)" }}
            >
              <ClayButton variant="ghost" size="sm" onClick={onClose} disabled={dispatching}>
                Cancel
              </ClayButton>
              <ClayButton
                variant="danger"
                size="sm"
                isLoading={dispatching}
                disabled={!canDispatch}
                onClick={handleDispatch}
                className="bg-red-600/20 text-red-400 hover:bg-red-600/30 border-red-500/30"
              >
                🚨 Dispatch
              </ClayButton>
            </div>
          )}
        </div>
      </div>

      {/* Toast */}
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

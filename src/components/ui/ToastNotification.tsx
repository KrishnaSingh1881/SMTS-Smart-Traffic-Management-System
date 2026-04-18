"use client";

import { useEffect, useCallback } from "react";
import ReactDOM from "react-dom";
import { cn } from "@/lib/utils/cn";

export type ToastType = "success" | "error" | "info";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastNotificationProps {
  message: string;
  type: ToastType;
  onDismiss: () => void;
  action?: ToastAction;
}

const typeStyles: Record<ToastType, string> = {
  success:
    "border-l-4 border-[var(--clay-success)] bg-[var(--clay-surface)] text-[var(--clay-text)]",
  error:
    "border-l-4 border-[var(--clay-danger)] bg-[var(--clay-surface)] text-[var(--clay-text)]",
  info: "border-l-4 border-[var(--clay-accent)] bg-[var(--clay-surface)] text-[var(--clay-text)]",
};

const typeIconColors: Record<ToastType, string> = {
  success: "text-[var(--clay-success)]",
  error: "text-[var(--clay-danger)]",
  info: "text-[var(--clay-accent)]",
};

const typeIcons: Record<ToastType, string> = {
  success: "✓",
  error: "✕",
  info: "ℹ",
};

const AUTO_DISMISS_MS = 4000;

export function ToastNotification({
  message,
  type,
  onDismiss,
  action,
}: ToastNotificationProps) {
  const dismiss = useCallback(() => onDismiss(), [onDismiss]);

  useEffect(() => {
    const timer = setTimeout(dismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [dismiss]);

  const toast = (
    <div
      role="alert"
      aria-live="assertive"
      className={cn(
        "fixed bottom-6 right-6 z-50",
        "flex items-start gap-3 px-4 py-3 rounded-clay shadow-clay",
        "min-w-[280px] max-w-sm",
        "animate-in slide-in-from-bottom-2 fade-in duration-200",
        typeStyles[type]
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex-shrink-0 font-bold text-sm",
          typeIconColors[type]
        )}
        aria-hidden="true"
      >
        {typeIcons[type]}
      </span>

      <span className="flex-1 text-sm leading-snug">{message}</span>

      <div className="flex items-center gap-2 flex-shrink-0">
        {action && (
          <button
            onClick={() => {
              action.onClick();
              dismiss();
            }}
            className="text-xs font-semibold text-[var(--clay-accent)] hover:underline focus:outline-none"
          >
            {action.label}
          </button>
        )}
        <button
          onClick={dismiss}
          aria-label="Dismiss notification"
          className="text-[var(--clay-muted)] hover:text-[var(--clay-text)] transition-colors focus:outline-none text-sm leading-none"
        >
          ✕
        </button>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return ReactDOM.createPortal(toast, document.body);
}

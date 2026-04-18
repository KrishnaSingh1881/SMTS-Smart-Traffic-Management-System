"use client";

import { useState, useCallback } from "react";
import type { ToastType, ToastAction } from "@/components/ui/ToastNotification";

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  action?: ToastAction;
}

export function useToast() {
  const [toast, setToast] = useState<ToastItem | null>(null);

  const showToast = useCallback(
    (message: string, type: ToastType = "info", action?: ToastAction) => {
      setToast({ id: crypto.randomUUID(), message, type, action });
    },
    []
  );

  const dismissToast = useCallback(() => setToast(null), []);

  return { toast, showToast, dismissToast };
}

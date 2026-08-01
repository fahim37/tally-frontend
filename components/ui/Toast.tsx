"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { Icon } from "./Icon";

interface ToastState {
  id: number;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

interface ToastContextValue {
  /** Shows a transient confirmation, optionally with a single undo action. */
  toast: (message: string, options?: { actionLabel: string; onAction: () => void }) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DURATION_MS = 4200;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [current, setCurrent] = useState<ToastState | null>(null);
  const timer = useRef<number | null>(null);
  const nextId = useRef(0);

  const dismiss = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
    setCurrent(null);
  }, []);

  const toast = useCallback<ToastContextValue["toast"]>(
    (message, options) => {
      if (timer.current) window.clearTimeout(timer.current);
      // One toast at a time — a rapid burst of taps should replace the
      // message, not stack five undo prompts the user has to dismiss.
      setCurrent({ id: nextId.current++, message, ...options });
      timer.current = window.setTimeout(() => setCurrent(null), DURATION_MS);
    },
    []
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {current && (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed inset-x-0 z-40 flex justify-center px-4"
          style={{ bottom: "calc(96px + env(safe-area-inset-bottom))" }}
        >
          <div
            className="pointer-events-auto flex w-full max-w-[440px] items-center gap-3 rounded-[14px] px-4 py-3"
            style={{
              background: "var(--text)",
              color: "var(--bg)",
              boxShadow: "var(--lift)",
              animation: "fadeIn .18s ease both",
            }}
          >
            <span className="flex-1 text-[13px] font-medium">{current.message}</span>

            {current.actionLabel && (
              <button
                type="button"
                onClick={() => {
                  current.onAction?.();
                  dismiss();
                }}
                className="rounded-[9px] px-2.5 py-1.5 text-[13px] font-semibold"
                style={{ color: "var(--blue-200)" }}
              >
                {current.actionLabel}
              </button>
            )}

            <button
              type="button"
              onClick={dismiss}
              aria-label="Dismiss"
              className="opacity-60"
              style={{ color: "var(--bg)" }}
            >
              <Icon name="plus" size={16} strokeWidth={2} className="rotate-45" />
            </button>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside <ToastProvider>");
  return context;
}

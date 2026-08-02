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
  const [leaving, setLeaving] = useState(false);
  const timer = useRef<number | null>(null);
  const nextId = useRef(0);

  const dismiss = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
    // Play the exit rather than cutting; the node unmounts on animationend.
    setLeaving(true);
  }, []);

  const toast = useCallback<ToastContextValue["toast"]>(
    (message, options) => {
      if (timer.current) window.clearTimeout(timer.current);
      // One toast at a time — a rapid burst of taps should replace the
      // message, not stack five undo prompts the user has to dismiss.
      setLeaving(false);
      setCurrent({ id: nextId.current++, message, ...options });
      timer.current = window.setTimeout(() => setLeaving(true), DURATION_MS);
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
          className="pointer-events-none fixed inset-x-0 z-40 flex justify-center px-5"
          style={{
            // Clears the nav, and rides above the soft keyboard when one is
            // open — a confirmation the keyboard covers may as well not exist.
            // The safe-area inset is added once, here, not also on body.
            bottom: "calc(96px + var(--safe-b) + var(--kb))",
            transition: "bottom var(--dur-base) var(--ease-out)",
          }}
        >
          <div
            onAnimationEnd={(event) => {
              if (event.animationName !== "toastOut") return;
              setCurrent(null);
              setLeaving(false);
            }}
            className="pointer-events-auto flex w-full max-w-[440px] items-center gap-3 rounded-card px-4 py-3"
            style={{
              background: "var(--text)",
              color: "var(--bg)",
              boxShadow: "var(--lift)",
              animation: leaving
                ? "toastOut var(--dur-base) var(--ease-out) both"
                : "toastIn var(--dur-base) var(--ease-spring) both",
            }}
          >
            <span className="flex-1 text-body font-medium">{current.message}</span>

            {current.actionLabel && (
              <button
                type="button"
                onClick={() => {
                  current.onAction?.();
                  dismiss();
                }}
                className="tap-target shrink-0 rounded-[10px] px-3 py-2 text-body font-semibold"
                style={{ color: "var(--blue-200)" }}
              >
                {current.actionLabel}
              </button>
            )}

            <button
              type="button"
              onClick={dismiss}
              aria-label="Dismiss"
              className="tap-target shrink-0 opacity-70"
              style={{ color: "var(--bg)" }}
            >
              <Icon name="plus" size={18} strokeWidth={2} className="rotate-45" />
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

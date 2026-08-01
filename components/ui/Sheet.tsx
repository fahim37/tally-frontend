"use client";

import { useEffect, useRef } from "react";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Announced to screen readers as the sheet's name. */
  label: string;
}

/**
 * A bottom sheet — the app's one modal surface.
 *
 * Handles the things a modal has to get right and screens shouldn't have to
 * repeat: Escape closes it, focus moves in and returns to where it was, the
 * page behind it doesn't scroll, and focus can't tab out into the frozen page.
 */
export function Sheet({ open, onClose, children, label }: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    restoreFocusTo.current = document.activeElement as HTMLElement | null;

    // Lock the page behind the sheet.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusables = () =>
      Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        ) ?? []
      ).filter((el) => !el.hasAttribute("disabled"));

    // Move focus into the sheet so a keyboard user isn't left behind it.
    const timer = window.setTimeout(() => focusables()[0]?.focus(), 60);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const items = focusables();
      if (!items.length) return;

      const first = items[0];
      const last = items[items.length - 1];

      // Wrap at both ends rather than letting focus escape to the page.
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      restoreFocusTo.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default"
        style={{ background: "var(--scrim)", animation: "fadeIn .16s ease both" }}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className="relative w-full max-w-[520px] px-0"
        style={{
          background: "var(--surf)",
          borderRadius: "22px 22px 0 0",
          boxShadow: "var(--lift-sheet)",
          animation: "sheetUp .3s cubic-bezier(.2,.9,.25,1) both",
          maxHeight: "92vh",
          overflowY: "auto",
          paddingBottom: "calc(26px + env(safe-area-inset-bottom))",
        }}
      >
        <div className="sticky top-0 z-10 pt-3.5 pb-2" style={{ background: "var(--surf)" }}>
          <span
            className="mx-auto block h-1 w-[38px] rounded-pill"
            style={{ background: "var(--line)" }}
          />
        </div>
        <div className="px-5">{children}</div>
      </div>
    </div>
  );
}

export default Sheet;

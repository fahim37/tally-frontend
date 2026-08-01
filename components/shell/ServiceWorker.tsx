"use client";

import { useEffect } from "react";

/**
 * Registers the service worker that makes the app shell open offline.
 *
 * Development is excluded on purpose: a cached shell over a hot-reloading dev
 * server produces stale-bundle bugs that look like application errors.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Registration fails on insecure origins and in some private modes.
        // The app is fully functional without it — only the offline *shell*
        // is lost, not offline logging.
      });
    };

    // Wait for load so the worker never competes with the first paint.
    if (document.readyState === "complete") register();
    else {
      window.addEventListener("load", register);
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}

export default ServiceWorker;

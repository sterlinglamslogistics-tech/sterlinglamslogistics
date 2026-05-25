"use client"

import { useEffect } from "react"

/**
 * Registers the /driver service worker so the Capacitor APK (and any
 * browser that opens the driver web app) keeps a cached copy of the
 * Next.js bundle + recently-visited /driver pages. The next time the
 * driver opens the app — even with no signal — the shell loads from
 * cache instead of showing a network error.
 *
 * Failure to register is non-fatal: the app still works online; we
 * just lose the offline fallback.
 */
export function DriverSWRegister() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return
    }
    // Scope is /driver/ so the SW only governs driver pages and never
    // intercepts admin / marketing routes.
    navigator.serviceWorker
      .register("/driver/sw.js", { scope: "/driver/" })
      .catch(() => { /* registration failure is non-fatal */ })
  }, [])
  return null
}

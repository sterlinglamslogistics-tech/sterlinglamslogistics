"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { applyStatusBar, onAndroidBack } from "@/lib/native-bridge"
import { useDriver } from "@/components/driver-context"

/**
 * Native chrome wiring for the driver Capacitor APK.
 *
 * - Styles the Android status bar to match the app theme (green on light).
 * - Intercepts the Android hardware back button so it:
 *     1. closes the left drawer if open, otherwise
 *     2. falls back to web history (the shim handles app-exit when stack
 *        is empty).
 *
 * Pure no-op in a regular browser (the native-bridge shim's try/catch
 * around the dynamic plugin imports never resolves to the real plugin).
 */
export function DriverNativeChrome() {
  const router = useRouter()
  const { drawerOpen, setDrawerOpen } = useDriver()

  // Status bar — apply once on mount.
  useEffect(() => {
    void applyStatusBar({ backgroundColor: "#16a34a", dark: false })
  }, [])

  // Android hardware back button. Re-register when drawerOpen flips so the
  // closure sees the current value.
  useEffect(() => {
    let unsub: (() => void) | null = null

    void onAndroidBack(() => {
      if (drawerOpen) {
        setDrawerOpen(false)
        return true // handled — don't pop history
      }
      // Let the shim's default handling kick in (history.back or app exit)
      return false
    }).then((u) => { unsub = u })

    return () => { unsub?.() }
  }, [drawerOpen, setDrawerOpen, router])

  return null
}

"use client"

/**
 * Map / navigation app preference helpers. Lifted out of the
 * /driver/settings/navigations page so non-settings code can import
 * them without depending on a route file (which broke the
 * driver-mobile-2 static-export build — paths like
 * `@/app/(app)/driver/settings/navigations/page` don't resolve when
 * the bundle is built from a flattened subset of /driver routes).
 */

export const NAV_APP_KEY = "driverNavApp"

export type NavApp = "google" | "waze" | "apple"

export function buildNavUrl(address: string, app: NavApp = "google"): string {
  const encoded = encodeURIComponent(address)
  if (app === "waze") return `https://waze.com/ul?q=${encoded}&navigate=yes`
  if (app === "apple") return `maps://maps.apple.com/?daddr=${encoded}`
  return `https://www.google.com/maps/dir/?api=1&destination=${encoded}`
}

export function getNavApp(): NavApp {
  try {
    const saved = localStorage.getItem(NAV_APP_KEY)
    if (saved === "google" || saved === "waze" || saved === "apple") return saved
  } catch { /* ignore */ }
  return "google"
}

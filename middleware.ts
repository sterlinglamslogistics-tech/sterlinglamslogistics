import { NextResponse, type NextRequest } from "next/server"

/**
 * CORS middleware — lets the bundled driver APKs (driver-mobile-2 and
 * any other Capacitor / PWA build that ships from a non-sterlinglamslogistics
 * origin) call the /api/driver/* endpoints on this server.
 *
 * Why this is needed
 *   The static-export APK runs from https://localhost (Capacitor's
 *   default Android scheme) or capacitor://localhost (iOS). Any
 *   fetch to https://sterlinglamslogistics.com/api/... is therefore
 *   cross-origin, and the WebView triggers the browser CORS algorithm.
 *   Because driverFetch sets credentials: "include", we must echo a
 *   specific Allow-Origin (not "*") AND set Allow-Credentials: true.
 *
 * Scope
 *   Only /api/driver/* — the public /api/track/* endpoints already
 *   work from any origin via Cache-Control: no-store + force-dynamic.
 *   Admin/internal API routes are left strict so they're not
 *   accidentally exposed cross-origin.
 *
 * Preflight
 *   The browser sends OPTIONS first for non-simple requests (any
 *   POST with a JSON body falls into this). We respond with the
 *   CORS headers and a 204 short-circuit so the actual route handler
 *   doesn't have to know anything about CORS.
 */

// Capacitor's WebView origins. https://localhost is the Android default,
// capacitor://localhost is iOS. Both static-export builds will hit this.
const ALLOWED_ORIGINS = new Set([
  "https://localhost",
  "capacitor://localhost",
  "http://localhost",
])

function corsHeaders(origin: string | null): Record<string, string> {
  const allowOrigin = origin && ALLOWED_ORIGINS.has(origin) ? origin : ""
  if (!allowOrigin) return {}
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Driver-Token, Authorization",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  }
}

export function middleware(req: NextRequest) {
  const origin = req.headers.get("origin")
  const headers = corsHeaders(origin)

  // CORS preflight — short-circuit with 204 + headers so the route
  // handler doesn't see the OPTIONS request at all.
  if (req.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers })
  }

  // Pass-through with CORS headers tacked onto the eventual response.
  const res = NextResponse.next()
  for (const [k, v] of Object.entries(headers)) {
    res.headers.set(k, v)
  }
  return res
}

export const config = {
  // Only intercept the driver API routes. Admin/internal APIs stay
  // same-origin-only by default.
  matcher: ["/api/driver/:path*"],
}

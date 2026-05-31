import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

const DRIVER_APP_COOKIE = "driver_app_locked"
const PAGE_CACHE_CONTROL = "no-store, no-cache, max-age=0, must-revalidate"

// Capacitor WebView origins for the bundled driver APKs. Both
// "https://localhost" (Android default) and "capacitor://localhost"
// (iOS default) need to be allowlisted so the static-export APK can
// hit /api/driver/* cross-origin. driverFetch uses credentials:
// "include", so we must echo a specific origin (not "*") and pair it
// with Access-Control-Allow-Credentials: true.
const CAPACITOR_ORIGINS = new Set([
  "https://localhost",
  "capacitor://localhost",
  "http://localhost",
])

function corsHeaders(origin: string | null): Record<string, string> {
  if (!origin || !CAPACITOR_ORIGINS.has(origin)) return {}
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Driver-Token, Authorization",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  }
}

function isAssetOrApi(pathname: string): boolean {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  )
}

export function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl

  // ── CORS for the driver API ────────────────────────────────────────────
  // The bundled driver-mobile-2 APK calls /api/driver/* from its WebView
  // origin (https://localhost), so each call triggers CORS. Handle the
  // preflight here, and tack the response headers onto the eventual
  // route-handler reply for non-OPTIONS requests.
  if (pathname.startsWith("/api/driver/")) {
    const headers = corsHeaders(request.headers.get("origin"))
    if (request.method === "OPTIONS") {
      return new NextResponse(null, { status: 204, headers })
    }
    if (Object.keys(headers).length > 0) {
      const res = NextResponse.next()
      for (const [k, v] of Object.entries(headers)) res.headers.set(k, v)
      return res
    }
  }

  if (isAssetOrApi(pathname)) {
    return NextResponse.next()
  }

  const isDriverPath = pathname.startsWith("/driver")
  const hasDriverLock = request.cookies.get(DRIVER_APP_COOKIE)?.value === "1"
  const shouldEnableDriverLock = isDriverPath && searchParams.get("driverApp") === "1"

  if (hasDriverLock && !isDriverPath) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = "/driver"
    redirectUrl.search = ""
    const response = NextResponse.redirect(redirectUrl)
    response.headers.set("Cache-Control", PAGE_CACHE_CONTROL)
    return response
  }

  if (shouldEnableDriverLock) {
    const response = NextResponse.next()
    response.headers.set("Cache-Control", PAGE_CACHE_CONTROL)
    response.cookies.set({
      name: DRIVER_APP_COOKIE,
      value: "1",
      path: "/",
      sameSite: "lax",
      httpOnly: true,
      secure: request.nextUrl.protocol === "https:",
    })
    return response
  }

  const response = NextResponse.next()
  response.headers.set("Cache-Control", PAGE_CACHE_CONTROL)
  return response
}

export const config = {
  matcher: ["/:path*"],
}

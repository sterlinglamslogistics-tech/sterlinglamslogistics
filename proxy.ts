import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

const DRIVER_APP_COOKIE = "driver_app_locked"
const PAGE_CACHE_CONTROL = "no-store, no-cache, max-age=0, must-revalidate"

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
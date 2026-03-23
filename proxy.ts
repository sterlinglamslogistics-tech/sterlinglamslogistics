import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

const DRIVER_APP_COOKIE = "driver_app_locked"

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
    return NextResponse.redirect(redirectUrl)
  }

  if (shouldEnableDriverLock) {
    const response = NextResponse.next()
    response.cookies.set({
      name: DRIVER_APP_COOKIE,
      value: "1",
      path: "/",
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
    })
    return response
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/:path*"],
}
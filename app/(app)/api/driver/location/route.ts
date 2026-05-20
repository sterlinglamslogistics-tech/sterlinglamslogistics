import { NextResponse } from "next/server"
import { checkRateLimit, getRateLimitIdentifier, getDriverRateLimitIdentifier } from "@/lib/rate-limit"
import { adminUpdateDriverLocation } from "@/lib/server/firestore-admin"
import { createLogger } from "@/lib/logger"
import { resolveDriverIdFromRequest } from "@/lib/server/driver-auth"

const log = createLogger("api:driver:location")

export async function POST(req: Request) {
  // IP-level guard first (protects unauthenticated path)
  const rl = await checkRateLimit(getRateLimitIdentifier(req))
  if (rl) return rl

  try {
    const body = (await req.json()) as { driverId?: string; lat?: number; lng?: number }
    const lat = body.lat
    const lng = body.lng

    const driverId = resolveDriverIdFromRequest(req, body.driverId)
    if (!driverId) {
      return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 })
    }

    // Per-driver rate limit — GPS sends every 5 s, so each driver uses ~12 req/min.
    // Without this, multiple drivers behind the same NAT would share the IP bucket.
    const driverRl = await checkRateLimit(getDriverRateLimitIdentifier(driverId))
    if (driverRl) return driverRl
    if (typeof lat !== "number" || typeof lng !== "number") {
      return NextResponse.json({ ok: false, error: "lat and lng are required." }, { status: 400 })
    }
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return NextResponse.json({ ok: false, error: "Invalid coordinates." }, { status: 400 })
    }

    await adminUpdateDriverLocation(driverId, lat, lng)
    return NextResponse.json({ ok: true })
  } catch (error) {
    log.error({ error }, "Driver location update failed")
    return NextResponse.json({ ok: false, error: "Failed to update location." }, { status: 500 })
  }
}

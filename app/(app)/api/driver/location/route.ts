import { NextResponse } from "next/server"
import { checkDriverLocationRateLimit } from "@/lib/rate-limit"
import { adminUpdateDriverLocation, adminRecordDriverPing } from "@/lib/server/firestore-admin"
import { createLogger } from "@/lib/logger"
import { resolveDriverIdFromRequest } from "@/lib/server/driver-auth"

const log = createLogger("api:driver:location")

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { driverId?: string; lat?: number; lng?: number; clientError?: string }
    const lat = body.lat
    const lng = body.lng

    const driverId = resolveDriverIdFromRequest(req, body.driverId)
    if (!driverId) {
      return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 })
    }

    // Per-driver rate limit only — IP-level limit intentionally skipped here
    // because multiple drivers on the same network would block each other.
    const rl = await checkDriverLocationRateLimit(driverId)
    if (rl) return rl

    if (typeof lat !== "number" || typeof lng !== "number") {
      // If the client included a diagnostic string explaining why it has no
      // coords, surface that on the admin page instead of the generic message.
      const errMsg = body.clientError?.trim() ? body.clientError.trim() : "missing-coords"
      await adminRecordDriverPing(driverId, lat, lng, errMsg)
      return NextResponse.json({ ok: false, error: "lat and lng are required." }, { status: 400 })
    }
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      await adminRecordDriverPing(driverId, lat, lng, "nan-coords")
      return NextResponse.json({ ok: false, error: "Invalid coordinates." }, { status: 400 })
    }
    
    // Valid coordinate ranges: lat [-90, 90], lng [-180, 180]
    // Accept any valid GPS coordinates (not just Nigeria bounds)
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      log.warn({ driverId, lat, lng }, "Driver coordinates out of valid GPS range")
      await adminRecordDriverPing(driverId, lat, lng, `out-of-range:${lat},${lng}`)
      return NextResponse.json({ ok: false, error: "Coordinates out of valid range." }, { status: 400 })
    }

    await adminRecordDriverPing(driverId, lat, lng, null)
    await adminUpdateDriverLocation(driverId, lat, lng)
    return NextResponse.json({ ok: true })
  } catch (error) {
    log.error({ error }, "Driver location update failed")
    return NextResponse.json({ ok: false, error: "Failed to update location." }, { status: 500 })
  }
}

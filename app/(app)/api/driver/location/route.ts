import { NextResponse } from "next/server"
import { checkRateLimit, getRateLimitIdentifier } from "@/lib/rate-limit"
import { updateDriverLocation } from "@/lib/firestore"
import { createLogger } from "@/lib/logger"
import { resolveDriverIdFromRequest } from "@/lib/server/driver-auth"

const log = createLogger("api:driver:location")

export async function POST(req: Request) {
  const rateLimitResponse = await checkRateLimit(getRateLimitIdentifier(req))
  if (rateLimitResponse) return rateLimitResponse

  try {
    const body = (await req.json()) as { driverId?: string; lat?: number; lng?: number }
    const lat = body.lat
    const lng = body.lng

    const driverId = resolveDriverIdFromRequest(req, body.driverId)
    if (!driverId) {
      return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 })
    }
    if (typeof lat !== "number" || typeof lng !== "number") {
      return NextResponse.json({ ok: false, error: "lat and lng are required." }, { status: 400 })
    }
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return NextResponse.json({ ok: false, error: "Invalid coordinates." }, { status: 400 })
    }

    await updateDriverLocation(driverId, lat, lng)
    return NextResponse.json({ ok: true })
  } catch (error) {
    log.error({ error }, "Driver location update failed")
    return NextResponse.json({ ok: false, error: "Failed to update location." }, { status: 500 })
  }
}

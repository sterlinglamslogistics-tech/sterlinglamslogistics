import { NextResponse } from "next/server"
import { checkRateLimit, getRateLimitIdentifier } from "@/lib/rate-limit"
import { resolveDriverIdFromRequest } from "@/lib/server/driver-auth"
import { adminSaveOptimizedRouteOrder } from "@/lib/server/firestore-admin"
import { createLogger } from "@/lib/logger"

const log = createLogger("api:driver:route:reorder")

export async function POST(req: Request) {
  const rateLimitResponse = await checkRateLimit(getRateLimitIdentifier(req))
  if (rateLimitResponse) return rateLimitResponse

  try {
    const body = (await req.json()) as { driverId?: string; orderedIds?: string[] }

    const driverId = resolveDriverIdFromRequest(req, body.driverId)
    if (!driverId) {
      return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 })
    }

    const orderedIds = Array.isArray(body.orderedIds) ? body.orderedIds : []
    if (orderedIds.length === 0) {
      return NextResponse.json({ ok: false, error: "orderedIds is required." }, { status: 400 })
    }

    await adminSaveOptimizedRouteOrder(orderedIds)
    return NextResponse.json({ ok: true })
  } catch (error) {
    log.error({ error }, "Driver route reorder failed")
    return NextResponse.json({ ok: false, error: "Failed to save route order." }, { status: 500 })
  }
}

import { NextResponse } from "next/server"
import { checkRateLimit, getRateLimitIdentifier } from "@/lib/rate-limit"
import { updateDriver } from "@/lib/firestore"
import { createLogger } from "@/lib/logger"
import { resolveDriverIdFromRequest } from "@/lib/server/driver-auth"

const log = createLogger("api:driver:profile")

export async function POST(req: Request) {
  const rateLimitResponse = await checkRateLimit(getRateLimitIdentifier(req))
  if (rateLimitResponse) return rateLimitResponse

  try {
    const body = (await req.json()) as {
      driverId?: string
      name?: string
      email?: string
      phone?: string
      vehicle?: string
      area?: string
    }

    const driverId = resolveDriverIdFromRequest(req, body.driverId)
    if (!driverId) {
      return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 })
    }

    await updateDriver(driverId, {
      ...(typeof body.name === "string" ? { name: body.name.trim() } : {}),
      ...(typeof body.email === "string" ? { email: body.email.trim() } : {}),
      ...(typeof body.phone === "string" ? { phone: body.phone.trim() } : {}),
      ...(typeof body.vehicle === "string" ? { vehicle: body.vehicle.trim() } : {}),
      ...(typeof body.area === "string" ? { area: body.area.trim() } : {}),
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    log.error({ error }, "Driver profile update failed")
    return NextResponse.json({ ok: false, error: "Failed to update driver profile." }, { status: 500 })
  }
}

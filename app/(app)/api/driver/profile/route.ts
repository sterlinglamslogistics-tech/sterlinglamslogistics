import { NextResponse } from "next/server"
import { checkRateLimit, getRateLimitIdentifier } from "@/lib/rate-limit"
import { adminUpdateDriver } from "@/lib/server/firestore-admin"
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
      model?: string
      plate?: string
    }

    const driverId = resolveDriverIdFromRequest(req, body.driverId)
    if (!driverId) {
      return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 })
    }

    await adminUpdateDriver(driverId, {
      ...(typeof body.name === "string" ? { name: body.name.trim() } : {}),
      ...(typeof body.email === "string" ? { email: body.email.trim() } : {}),
      ...(typeof body.phone === "string" ? { phone: body.phone.trim() } : {}),
      ...(typeof body.vehicle === "string" ? { vehicle: body.vehicle.trim() } : {}),
      ...(typeof body.area === "string" ? { area: body.area.trim() } : {}),
      ...(typeof body.model === "string" ? { model: body.model.trim() } : {}),
      ...(typeof body.plate === "string" ? { plate: body.plate.trim() } : {}),
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    log.error({ error }, "Driver profile update failed")
    return NextResponse.json({ ok: false, error: "Failed to update driver profile." }, { status: 500 })
  }
}

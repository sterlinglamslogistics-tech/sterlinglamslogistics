import { NextResponse } from "next/server"
import { orderEventSchema } from "@/lib/validations"
import { checkRateLimit, getRateLimitIdentifier } from "@/lib/rate-limit"
import { createLogger } from "@/lib/logger"
import { verifyAdmin } from "@/lib/server/auth"
import { notifyOrderEventServer } from "@/lib/server/notify-order-event"
import type { NotificationPayload, OrderEvent } from "@/lib/server/notifications"

const log = createLogger("api:order-event")

export async function POST(req: Request) {
  try {
    const admin = await verifyAdmin(req)
    if (!admin) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
    }

    const rateLimitResponse = await checkRateLimit(getRateLimitIdentifier(req))
    if (rateLimitResponse) return rateLimitResponse

    const rawBody = await req.json()
    const parsed = orderEventSchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Invalid request body", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const result = await notifyOrderEventServer(
      parsed.data.event as OrderEvent,
      parsed.data.payload as NotificationPayload,
    )

    return NextResponse.json({ ok: true, result })
  } catch (error) {
    log.error({ error }, "Notification API error")
    return NextResponse.json(
      { ok: false, error: "Failed to send notification" },
      { status: 500 }
    )
  }
}

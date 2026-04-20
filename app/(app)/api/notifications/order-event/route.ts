import { NextResponse } from "next/server"
import { sendOrderEventNotifications, DEFAULT_NOTIFICATION_SETTINGS, type NotificationPayload, type OrderEvent, type NotificationSettings } from "@/lib/server/notifications"
import { addDoc, collection, doc, getDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { orderEventSchema } from "@/lib/validations"
import { checkRateLimit, getRateLimitIdentifier } from "@/lib/rate-limit"
import { createLogger } from "@/lib/logger"
import { audit } from "@/lib/audit"

const log = createLogger("api:order-event")

async function writeNotificationLog(input: {
  event: OrderEvent
  payload: NotificationPayload
  sms: { sent: boolean; reason?: string; detail?: string }
  whatsapp: { sent: boolean; reason?: string; detail?: string }
  email: { sent: boolean; reason?: string; detail?: string }
}) {
  if (!db) return
  try {
    await addDoc(collection(db, "notificationLogs"), {
      event: input.event,
      orderId: input.payload.orderId,
      orderNumber: input.payload.orderNumber,
      customerName: input.payload.customerName,
      customerPhone: input.payload.customerPhone,
      customerEmail: input.payload.customerEmail ?? null,
      sms: input.sms,
      whatsapp: input.whatsapp,
      email: input.email,
      createdAt: new Date(),
    })
  } catch (error) {
    console.error("Notification log write error:", error)
  }
}

export async function POST(req: Request) {
  try {
    // Rate limiting
    const rateLimitResponse = await checkRateLimit(getRateLimitIdentifier(req))
    if (rateLimitResponse) return rateLimitResponse

    const rawBody = await req.json()

    // Validate request body with Zod
    const parsed = orderEventSchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Invalid request body", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { event, payload } = parsed.data

    // Load customer notification settings from Firestore
    let settings: NotificationSettings = DEFAULT_NOTIFICATION_SETTINGS
    if (db) {
      try {
        const settingsSnap = await getDoc(doc(db, "settings", "customerNotification"))
        if (settingsSnap.exists()) {
          settings = { ...DEFAULT_NOTIFICATION_SETTINGS, ...settingsSnap.data() } as NotificationSettings
        }
      } catch (err) {
        log.warn({ err }, "Could not load notification settings, using defaults")
      }
    }

    const result = await sendOrderEventNotifications(event, payload as NotificationPayload, settings)
    await writeNotificationLog({
      event: event as OrderEvent,
      payload: payload as NotificationPayload,
      sms: result.sms,
      whatsapp: result.whatsapp,
      email: result.email,
    })

    return NextResponse.json({ ok: true, result })
  } catch (error) {
    log.error({ error }, "Notification API error")

    // Best-effort logging for unexpected failures
    try {
      const body = await req.clone().json()
      if (body.event && body.payload) {
        await writeNotificationLog({
          event: body.event,
          payload: body.payload,
          sms: { sent: false, reason: "api_exception" },
          whatsapp: { sent: false, reason: "api_exception" },
          email: { sent: false, reason: "api_exception" },
        })
      }
    } catch {
      // Ignore secondary failures while handling API exceptions
    }

    return NextResponse.json(
      { ok: false, error: "Failed to send notification" },
      { status: 500 }
    )
  }
}

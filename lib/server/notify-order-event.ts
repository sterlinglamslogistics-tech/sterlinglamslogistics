import { adminDb } from "@/lib/server/firebase-admin"
import {
  sendOrderEventNotifications,
  DEFAULT_NOTIFICATION_SETTINGS,
  type NotificationSettings,
  type NotificationPayload,
  type OrderEvent,
} from "@/lib/server/notifications"
import { createLogger } from "@/lib/logger"

const log = createLogger("server:notify-order-event")

export async function notifyOrderEventServer(
  event: OrderEvent,
  payload: NotificationPayload,
): Promise<{
  sms: { sent: boolean; reason?: string; detail?: string }
  whatsapp: { sent: boolean; reason?: string; detail?: string }
  email: { sent: boolean; reason?: string; detail?: string }
}> {
  // Load customer notification settings (best-effort; falls back to defaults)
  let settings: NotificationSettings = DEFAULT_NOTIFICATION_SETTINGS
  try {
    const snap = await adminDb.collection("settings").doc("customerNotification").get()
    if (snap.exists) {
      settings = { ...DEFAULT_NOTIFICATION_SETTINGS, ...snap.data() } as NotificationSettings
    }
  } catch (err) {
    log.warn({ err }, "Could not load notification settings, using defaults")
  }

  const result = await sendOrderEventNotifications(event, payload, settings)

  // Write notification log using admin SDK so Firestore rules don't block it
  try {
    await adminDb.collection("notificationLogs").add({
      event,
      orderId: payload.orderId,
      orderNumber: payload.orderNumber,
      customerName: payload.customerName,
      customerPhone: payload.customerPhone,
      customerEmail: payload.customerEmail ?? null,
      sms: result.sms,
      whatsapp: result.whatsapp,
      email: result.email,
      createdAt: new Date(),
    })
  } catch (err) {
    log.error({ err, event, orderId: payload.orderId }, "Failed to write notification log")
  }

  return result
}

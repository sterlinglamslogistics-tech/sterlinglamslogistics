import { addDoc, collection, doc, getDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import {
  sendOrderEventNotifications,
  DEFAULT_NOTIFICATION_SETTINGS,
  type NotificationSettings,
  type NotificationPayload,
  type OrderEvent,
} from "@/lib/server/notifications"
import { createLogger } from "@/lib/logger"

const log = createLogger("server:notify-order-event")

/**
 * Send WhatsApp / SMS / Email notifications for an order event and write a row
 * to `notificationLogs` in Firestore.
 *
 * Centralized so it can be called from any server route (admin route handler,
 * driver status route, etc.) without going through the HTTP layer.
 */
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
  if (db) {
    try {
      const snap = await getDoc(doc(db, "settings", "customerNotification"))
      if (snap.exists()) {
        settings = { ...DEFAULT_NOTIFICATION_SETTINGS, ...snap.data() } as NotificationSettings
      }
    } catch (err) {
      log.warn({ err }, "Could not load notification settings, using defaults")
    }
  }

  const result = await sendOrderEventNotifications(event, payload, settings)

  // Mirror the original notification log shape so existing dashboards keep working
  if (db) {
    try {
      await addDoc(collection(db, "notificationLogs"), {
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
  }

  return result
}

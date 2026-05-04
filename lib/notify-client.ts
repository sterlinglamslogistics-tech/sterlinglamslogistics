import { auth } from "@/lib/firebase"

type OrderEvent = "order_accepted" | "out_for_delivery" | "delivered"

interface OrderNotificationPayload {
  orderId: string
  orderNumber: string
  customerName: string
  customerPhone: string
  customerEmail?: string | null
  address?: string
  driverName?: string
  items?: Array<{ name: string; qty?: number; price?: number }>
}

export async function notifyOrderEvent(event: OrderEvent, payload: OrderNotificationPayload) {
  try {
    const trackingBase = typeof window !== "undefined" ? window.location.origin : ""
    const trackingUrl = trackingBase
      ? `${trackingBase}/track/${encodeURIComponent(payload.orderNumber)}`
      : undefined

    const idToken = await auth.currentUser?.getIdToken()

    await fetch("/api/notifications/order-event", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
      },
      body: JSON.stringify({
        event,
        payload: {
          ...payload,
          trackingUrl,
        },
      }),
    })
  } catch (error) {
    console.error("Failed to trigger order notification:", error)
  }
}

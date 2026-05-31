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
    // Use orderNumber as tracking token — fall back to orderId so the
    // tracking page can find the order even if orderNumber is not set.
    const trackingToken = payload.orderNumber || payload.orderId
    const trackingUrl = trackingBase && trackingToken
      ? `${trackingBase}/track/${encodeURIComponent(trackingToken)}`
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

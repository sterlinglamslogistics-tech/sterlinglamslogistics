import { NextResponse } from "next/server"
import { checkRateLimit, getRateLimitIdentifier } from "@/lib/rate-limit"
import { updateDriver, fetchDriverById } from "@/lib/firestore"
import { db } from "@/lib/firebase"
import { doc, runTransaction } from "firebase/firestore"
import { createLogger } from "@/lib/logger"
import { resolveDriverIdFromRequest } from "@/lib/server/driver-auth"
import { notifyOrderEventServer } from "@/lib/server/notify-order-event"
import type { Order } from "@/lib/data"
import type { OrderEvent } from "@/lib/server/notifications"

const log = createLogger("api:driver:order-status")

type DriverOrderStatusAction = "picked-up" | "in-transit" | "delivered"

function buildTrackingUrl(req: Request, orderNumber: string): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_ORIGIN
  const origin = explicit || new URL(req.url).origin
  return `${origin}/track/${encodeURIComponent(orderNumber)}`
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const rateLimitResponse = await checkRateLimit(getRateLimitIdentifier(req))
  if (rateLimitResponse) return rateLimitResponse

  const { orderId } = await params
  try {
    const body = (await req.json()) as {
      driverId?: string
      status?: DriverOrderStatusAction
    }

    const nextStatus = body.status
    const driverId = resolveDriverIdFromRequest(req, body.driverId)
    if (!driverId) {
      return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 })
    }
    if (!nextStatus) {
      return NextResponse.json({ ok: false, error: "status is required." }, { status: 400 })
    }
    if (!["picked-up", "in-transit", "delivered"].includes(nextStatus)) {
      return NextResponse.json({ ok: false, error: "Unsupported status transition." }, { status: 400 })
    }

    const orderRef = doc(db, "orders", orderId)
    let order: Order | null = null
    let notificationEvent: OrderEvent | null = null
    let txnError: { status: number; message: string } | null = null

    // Atomically check the current status and apply the transition so that
    // concurrent requests (e.g. double-tap) cannot both pass the guard and
    // each send a customer notification.
    await runTransaction(db, async (txn) => {
      const snap = await txn.get(orderRef)
      if (!snap.exists()) {
        txnError = { status: 404, message: "Order not found." }
        return
      }

      const data = snap.data()
      order = { id: snap.id, ...data } as Order

      if (data.assignedDriver !== driverId) {
        txnError = { status: 403, message: "Order is not assigned to this driver." }
        return
      }

      const now = new Date()

      if (nextStatus === "picked-up") {
        if (data.status !== "started") {
          txnError = { status: 409, message: "Order must be in started state first." }
          return
        }
        txn.update(orderRef, { status: "picked-up", pickedUpAt: now, updatedAt: now })
      } else if (nextStatus === "in-transit") {
        if (data.status !== "picked-up") {
          txnError = { status: 409, message: "Order must be picked up first." }
          return
        }
        txn.update(orderRef, { status: "in-transit", inTransitAt: now, updatedAt: now })
        notificationEvent = "out_for_delivery"
      } else {
        if (data.status !== "in-transit") {
          txnError = { status: 409, message: "Order must be in transit first." }
          return
        }
        txn.update(orderRef, { status: "delivered", deliveredAt: now, updatedAt: now })
        notificationEvent = "delivered"
      }
    })

    if (txnError) {
      return NextResponse.json({ ok: false, error: txnError.message }, { status: txnError.status })
    }

    // Side-effects outside the transaction (best-effort)
    if (nextStatus === "picked-up") {
      await updateDriver(driverId, { status: "on-delivery" }).catch(() => null)
    } else if (nextStatus === "delivered") {
      await updateDriver(driverId, { status: "available" }).catch(() => null)
    }

    // Fire WhatsApp / SMS / email server-side so it doesn't depend on the
    // driver client having an admin Firebase token. Best-effort — never fails
    // the status update if notifications fail.
    if (notificationEvent && order) {
      try {
        const driver = await fetchDriverById(driverId).catch(() => null)
        const result = await notifyOrderEventServer(notificationEvent, {
          orderId: (order as Order).id,
          orderNumber: (order as Order).orderNumber,
          customerName: (order as Order).customerName,
          customerPhone: (order as Order).phone,
          customerEmail: (order as Order).customerEmail ?? null,
          trackingUrl: buildTrackingUrl(req, (order as Order).orderNumber),
          address: (order as Order).address,
          driverName: driver?.name ?? undefined,
          items: (order as Order).items,
        })
        log.info(
          { orderId: (order as Order).id, event: notificationEvent, result },
          "driver-triggered notifications dispatched"
        )
      } catch (err) {
        log.error({ err, orderId, event: notificationEvent }, "Failed to dispatch notifications")
      }
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    log.error({ error, orderId }, "Driver order status update failed")
    return NextResponse.json({ ok: false, error: "Failed to update order status." }, { status: 500 })
  }
}

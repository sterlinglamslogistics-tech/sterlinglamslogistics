import { NextResponse } from "next/server"
import { verifyAdmin } from "@/lib/server/auth"
import { adminFetchOrder, adminUpdateOrder, adminFetchDriverById } from "@/lib/server/firestore-admin"
import { ORDER_STATUS } from "@/lib/constants"
import { createLogger } from "@/lib/logger"
import { notifyOrderEventServer } from "@/lib/server/notify-order-event"

const log = createLogger("api:admin:dispatch:assign")

function buildTrackingUrl(req: Request, orderNumber: string, orderId: string): string {
  const origin = process.env.NEXT_PUBLIC_SITE_ORIGIN || new URL(req.url).origin
  // Use orderNumber as tracking token; fall back to orderId if orderNumber is empty
  const token = orderNumber || orderId
  return `${origin}/track/${encodeURIComponent(token)}`
}

export async function POST(req: Request) {
  const admin = await verifyAdmin(req)
  if (!admin) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = (await req.json()) as { orderId?: string; driverId?: string | null }
    const orderId = body.orderId?.trim()
    const driverId = body.driverId?.trim() ?? null
    if (!orderId) {
      return NextResponse.json({ ok: false, error: "orderId is required" }, { status: 400 })
    }

    const order = await adminFetchOrder(orderId)
    if (!order) {
      return NextResponse.json({ ok: false, error: "Order not found" }, { status: 404 })
    }

    if (!driverId) {
      await adminUpdateOrder(orderId, {
        assignedDriver: null,
        status: ORDER_STATUS.UNASSIGNED,
        startedAt: null,
      })
    } else {
      await adminUpdateOrder(orderId, {
        assignedDriver: driverId,
        status: ORDER_STATUS.STARTED,
        startedAt: new Date(),
      })

      // Fire order_accepted notification server-side (best-effort — never blocks response)
      const driver = await adminFetchDriverById(driverId).catch(() => null)
      notifyOrderEventServer("order_accepted", {
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        customerPhone: order.phone,
        customerEmail: order.customerEmail ?? null,
        trackingUrl: buildTrackingUrl(req, order.orderNumber, order.id),
        address: order.address,
        driverName: driver?.name ?? undefined,
        items: order.items,
      }).catch((err) =>
        log.error({ err, orderId: order.id }, "order_accepted notification failed")
      )
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    log.error({ error }, "Dispatch assign failed")
    return NextResponse.json({ ok: false, error: "Failed to assign order" }, { status: 500 })
  }
}

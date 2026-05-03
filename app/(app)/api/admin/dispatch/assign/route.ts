import { NextResponse } from "next/server"
import { verifyAdmin } from "@/lib/server/auth"
import { fetchOrder, updateOrder } from "@/lib/firestore"
import { ORDER_STATUS } from "@/lib/constants"
import { createLogger } from "@/lib/logger"

const log = createLogger("api:admin:dispatch:assign")

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

    const order = await fetchOrder(orderId)
    if (!order) {
      return NextResponse.json({ ok: false, error: "Order not found" }, { status: 404 })
    }

    if (!driverId) {
      await updateOrder(orderId, {
        assignedDriver: null,
        status: ORDER_STATUS.UNASSIGNED,
        startedAt: null,
      })
    } else {
      await updateOrder(orderId, {
        assignedDriver: driverId,
        status: ORDER_STATUS.STARTED,
        startedAt: new Date(),
      })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    log.error({ error }, "Dispatch assign failed")
    return NextResponse.json({ ok: false, error: "Failed to assign order" }, { status: 500 })
  }
}

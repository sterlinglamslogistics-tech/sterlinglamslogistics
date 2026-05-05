import { NextResponse } from "next/server"
import { checkRateLimit, getRateLimitIdentifier } from "@/lib/rate-limit"
import { resolveDriverIdFromRequest } from "@/lib/server/driver-auth"
import { adminDb } from "@/lib/server/firebase-admin"
import { adminUpdateDriver } from "@/lib/server/firestore-admin"
import { createLogger } from "@/lib/logger"

const log = createLogger("api:driver:order-decline")

export async function POST(
  req: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const rateLimitResponse = await checkRateLimit(getRateLimitIdentifier(req))
  if (rateLimitResponse) return rateLimitResponse

  const { orderId } = await params
  try {
    const body = (await req.json()) as { driverId?: string; reason?: string }
    const driverId = resolveDriverIdFromRequest(req, body.driverId)
    if (!driverId) {
      return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 })
    }

    const orderRef = adminDb.collection("orders").doc(orderId)
    let txnError: { status: number; message: string } | null = null

    await adminDb.runTransaction(async (txn) => {
      const snap = await txn.get(orderRef)
      if (!snap.exists) {
        txnError = { status: 404, message: "Order not found." }
        return
      }
      const data = snap.data() as Record<string, unknown>
      if (data.assignedDriver !== driverId) {
        txnError = { status: 403, message: "Order is not assigned to this driver." }
        return
      }
      if (data.status !== "started") {
        txnError = { status: 409, message: "Only orders in started state can be declined." }
        return
      }
      txn.update(orderRef, {
        status: "unassigned",
        assignedDriver: null,
        startedAt: null,
        updatedAt: new Date(),
        ...(body.reason ? { declinedReason: body.reason } : {}),
      })
    })

    if (txnError) {
      const err = txnError as { status: number; message: string }
      return NextResponse.json({ ok: false, error: err.message }, { status: err.status })
    }

    await adminUpdateDriver(driverId, { status: "available" }).catch(() => null)

    log.info({ orderId, driverId, reason: body.reason }, "Driver declined order")
    return NextResponse.json({ ok: true })
  } catch (error) {
    log.error({ error, orderId }, "Order decline failed")
    return NextResponse.json({ ok: false, error: "Failed to decline order." }, { status: 500 })
  }
}

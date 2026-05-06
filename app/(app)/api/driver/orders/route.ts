import { NextResponse } from "next/server"
import { adminDb } from "@/lib/server/firebase-admin"
import { verifyDriverSession } from "@/lib/server/driver-auth"
import { checkRateLimit, getRateLimitIdentifier } from "@/lib/rate-limit"

export async function GET(req: Request) {
  const rl = await checkRateLimit(getRateLimitIdentifier(req))
  if (rl) return rl

  const session = await verifyDriverSession(req)
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const driverId = searchParams.get("driverId")

  if (!driverId || driverId !== session.driverId) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 })
  }

  try {
    const snap = await adminDb
      .collection("orders")
      .where("assignedDriver", "==", driverId)
      .get()

    const orders = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
    return NextResponse.json({ ok: true, orders })
  } catch (error) {
    return NextResponse.json({ ok: false, error: "Failed to fetch orders" }, { status: 500 })
  }
}

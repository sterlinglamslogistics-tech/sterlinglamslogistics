import { NextResponse } from "next/server"
import { adminDb } from "@/lib/server/firebase-admin"
import { checkRateLimit, getRateLimitIdentifier } from "@/lib/rate-limit"
import { createLogger } from "@/lib/logger"
import type { DriverStatus } from "@/lib/data"

const log = createLogger("api:track")

/**
 * Public tracking endpoint — returns order status and driver location for a
 * given tracking code (order number or order document ID).
 *
 * Uses the admin SDK server-side so Firestore security rules can be locked
 * down to admin-only reads. Sensitive fields (phone, email, password) are
 * stripped before the response is sent.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ tracking: string }> }
) {
  const rl = await checkRateLimit(getRateLimitIdentifier(req))
  if (rl) return rl

  const { tracking } = await params
  const token = tracking.trim()
  if (!token) {
    return NextResponse.json({ ok: false, error: "Invalid tracking code." }, { status: 400 })
  }

  try {
    // ── Find order ─────────────────────────────────────────────────────────
    let rawOrder: Record<string, unknown> & { id: string } | null = null

    // 1. Try orderNumber field match (most common case)
    const snap = await adminDb
      .collection("orders")
      .where("orderNumber", "==", token)
      .limit(5)
      .get()

    if (!snap.empty) {
      // Pick the most recently created order (handles duplicates)
      const sorted = snap.docs.slice().sort((a, b) => {
        const toMs = (v: unknown): number => {
          if (!v) return 0
          if (typeof v === "object" && v !== null && "seconds" in v)
            return (v as { seconds: number }).seconds * 1000
          return new Date(v as string | number).getTime()
        }
        return toMs(b.data().createdAt) - toMs(a.data().createdAt)
      })
      const d = sorted[0]
      rawOrder = { id: d.id, ...d.data() } as Record<string, unknown> & { id: string }
    } else {
      // 2. Fallback: treat the token as a Firestore document ID
      const docSnap = await adminDb.collection("orders").doc(token).get()
      if (docSnap.exists) {
        rawOrder = { id: docSnap.id, ...docSnap.data() } as Record<string, unknown> & { id: string }
      }
    }

    if (!rawOrder) {
      return NextResponse.json({ ok: true, order: null, driver: null })
    }

    // ── Strip sensitive order fields ────────────────────────────────────────
    // Only expose fields the tracking page needs. Customer phone and email are
    // NOT included — anyone with the order number could see them otherwise.
    const safeOrder = {
      id:                  rawOrder.id,
      orderNumber:         rawOrder.orderNumber,
      status:              rawOrder.status,
      customerName:        rawOrder.customerName,
      address:             rawOrder.address,
      amount:              rawOrder.amount,
      assignedDriver:      rawOrder.assignedDriver,
      items:               rawOrder.items,
      distanceKm:          rawOrder.distanceKm,
      lat:                 rawOrder.lat,
      lng:                 rawOrder.lng,
      deliveryDate:        rawOrder.deliveryDate,
      deliveryTime:        rawOrder.deliveryTime,
      deliveryInstruction: rawOrder.deliveryInstruction,
      paymentMethod:       rawOrder.paymentMethod,
      customerRating:      rawOrder.customerRating,
      driverRating:        rawOrder.driverRating,
      createdAt:           rawOrder.createdAt,
      startedAt:           rawOrder.startedAt,
      pickedUpAt:          rawOrder.pickedUpAt,
      inTransitAt:         rawOrder.inTransitAt,
      deliveredAt:         rawOrder.deliveredAt,
    }

    // ── Fetch driver (only if assigned) ────────────────────────────────────
    let safeDriver: {
      id: string
      name: string
      vehicle: string
      model?: unknown
      plate?: unknown
      status: DriverStatus
      rating: number
      lastLocation?: { lat: number; lng: number }
    } | null = null

    const assignedDriver = rawOrder.assignedDriver as string | null | undefined
    if (assignedDriver) {
      const driverSnap = await adminDb.collection("drivers").doc(assignedDriver).get()
      if (driverSnap.exists) {
        const d = driverSnap.data() as Record<string, unknown>
        // Expose only fields needed for the tracking UI — never phone, email, or password
        safeDriver = {
          id:           driverSnap.id,
          name:         d.name as string,
          vehicle:      d.vehicle as string,
          model:        d.model,
          plate:        d.plate,
          status:       d.status as DriverStatus,
          rating:       (d.rating as number) ?? 0,
          lastLocation: d.lastLocation as { lat: number; lng: number } | undefined,
        }
      }
    }

    // Cache for 4 seconds — short enough that driver location feels live
    return NextResponse.json(
      { ok: true, order: safeOrder, driver: safeDriver },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch (error) {
    log.error({ error, tracking: token }, "Failed to fetch tracking data")
    return NextResponse.json({ ok: false, error: "Failed to fetch tracking data." }, { status: 500 })
  }
}

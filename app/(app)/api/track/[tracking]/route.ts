import { NextResponse } from "next/server"
import { adminDb } from "@/lib/server/firebase-admin"
import { checkRateLimit, getRateLimitIdentifier } from "@/lib/rate-limit"
import { createLogger } from "@/lib/logger"
import type { DriverStatus } from "@/lib/data"

const log = createLogger("api:track")

/**
 * Convert a Firestore Admin Timestamp (or any timestamp-like value) to an ISO
 * string so the client-side parseDate() helper can reliably parse it.
 * Admin SDK Timestamps serialise their internal _seconds/_nanoseconds fields
 * (not the public .seconds getter) when passed through JSON.stringify, which
 * breaks client-side parsing that looks for the .seconds key.
 */
function tsToIso(v: unknown): string | null {
  if (!v) return null
  if (typeof v === "string") return v
  if (typeof v === "number") return new Date(v).toISOString()
  if (typeof v === "object" && v !== null) {
    const t = v as { toDate?: () => Date; seconds?: number; _seconds?: number; toMillis?: () => number }
    if (typeof t.toDate === "function") return t.toDate().toISOString()
    if (typeof t.toMillis === "function") return new Date(t.toMillis()).toISOString()
    if (typeof t.seconds === "number") return new Date(t.seconds * 1000).toISOString()
    if (typeof t._seconds === "number") return new Date(t._seconds * 1000).toISOString()
  }
  return null
}

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
    // Address is hidden for delivered orders (no longer needed for tracking).
    const isDelivered = rawOrder.status === "delivered"
    const safeOrder = {
      id:                  rawOrder.id,
      orderNumber:         rawOrder.orderNumber,
      status:              rawOrder.status,
      customerName:        rawOrder.customerName,
      address:             isDelivered ? null : rawOrder.address,
      amount:              rawOrder.amount,
      assignedDriver:      rawOrder.assignedDriver,
      items:               rawOrder.items,
      distanceKm:          rawOrder.distanceKm,
      lat:                 isDelivered ? null : rawOrder.lat,
      lng:                 isDelivered ? null : rawOrder.lng,
      deliveryDate:        rawOrder.deliveryDate,
      deliveryTime:        rawOrder.deliveryTime,
      deliveryInstruction: rawOrder.deliveryInstruction,
      paymentMethod:       rawOrder.paymentMethod,
      customerRating:      rawOrder.customerRating,
      driverRating:        rawOrder.driverRating,
      createdAt:           tsToIso(rawOrder.createdAt),
      startedAt:           tsToIso(rawOrder.startedAt),
      pickedUpAt:          tsToIso(rawOrder.pickedUpAt),
      inTransitAt:         tsToIso(rawOrder.inTransitAt),
      deliveredAt:         tsToIso(rawOrder.deliveredAt),
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

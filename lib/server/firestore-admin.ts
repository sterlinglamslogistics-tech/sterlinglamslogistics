import { adminDb } from "./firebase-admin"
import { hashPassword, isHashed } from "@/lib/password"
import { ORDER_STATUS } from "@/lib/constants"
import type { Order, Driver } from "@/lib/data"

// ── Geocoding (REST, no SDK dependency) ──────────────────────────────────────

type LatLng = { lat: number; lng: number }

const DEFAULT_HUB_COORDS: LatLng = { lat: 6.4642667, lng: 3.5554814 }

function getHubCoordinates(): LatLng {
  const rawLat = Number(process.env.NEXT_PUBLIC_HUB_LAT)
  const rawLng = Number(process.env.NEXT_PUBLIC_HUB_LNG)
  if (!Number.isNaN(rawLat) && !Number.isNaN(rawLng)) return { lat: rawLat, lng: rawLng }
  return DEFAULT_HUB_COORDS
}

const geocodeCache = new Map<string, LatLng>()

async function geocodeAddress(address: string): Promise<LatLng | null> {
  const q = address.trim()
  if (!q) return null
  const cached = geocodeCache.get(q)
  if (cached) return cached

  try {
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? ""
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(q)}&key=${key}`
    )
    if (res.ok) {
      const data = await res.json()
      const loc = data.results?.[0]?.geometry?.location
      if (loc) {
        const coords: LatLng = { lat: loc.lat, lng: loc.lng }
        geocodeCache.set(q, coords)
        return coords
      }
    }
  } catch { /* fall through to Nominatim */ }

  try {
    const nRes = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(q)}`,
      { headers: { Accept: "application/json", "User-Agent": "sg-delivery/1.0" } }
    )
    if (!nRes.ok) return null
    const nData = await nRes.json()
    const result = nData?.[0]
    if (!result) return null
    const lat = Number(result.lat)
    const lng = Number(result.lon)
    if (Number.isNaN(lat) || Number.isNaN(lng)) return null
    const coords: LatLng = { lat, lng }
    geocodeCache.set(q, coords)
    return coords
  } catch { return null }
}

function haversineDistanceKm(a: LatLng, b: LatLng): number {
  const toRad = (v: number) => (v * Math.PI) / 180
  const R = 6371
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return Number((R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))).toFixed(2))
}

async function calculateDistanceKm(
  address: string
): Promise<{ distanceKm?: number; lat?: number; lng?: number }> {
  const destination = await geocodeAddress(address)
  if (!destination) return {}
  const distanceKm = haversineDistanceKm(getHubCoordinates(), destination)
  return { distanceKm, lat: destination.lat, lng: destination.lng }
}

// ── Document normalization ────────────────────────────────────────────────────

function toDate(val: unknown): Date | undefined {
  if (!val) return undefined
  if (val instanceof Date) return val
  if (typeof (val as { toDate?: unknown }).toDate === "function")
    return (val as { toDate: () => Date }).toDate()
  if (typeof val === "string" || typeof val === "number") {
    const d = new Date(val)
    if (!Number.isNaN(d.getTime())) return d
  }
  return undefined
}

function normalizeOrderStatus(status: unknown): Order["status"] {
  if (status === "pending") return ORDER_STATUS.UNASSIGNED
  if (status === "assigned") return ORDER_STATUS.STARTED
  if (status === ORDER_STATUS.STARTED) return ORDER_STATUS.STARTED
  if (status === ORDER_STATUS.PICKED_UP) return ORDER_STATUS.PICKED_UP
  if (status === ORDER_STATUS.IN_TRANSIT) return ORDER_STATUS.IN_TRANSIT
  if (status === ORDER_STATUS.DELIVERED) return ORDER_STATUS.DELIVERED
  if (status === ORDER_STATUS.FAILED) return ORDER_STATUS.FAILED
  if (status === ORDER_STATUS.CANCELLED) return ORDER_STATUS.CANCELLED
  return ORDER_STATUS.UNASSIGNED
}

function normalizeOrderDoc(id: string, data: Record<string, unknown>): Order {
  return {
    ...(data as Omit<Order, "id" | "status">),
    id,
    status: normalizeOrderStatus(data.status),
    createdAt: toDate(data.createdAt),
    startedAt: toDate(data.startedAt),
    completedAt: toDate(data.completedAt),
  } as Order
}

// ── Orders ────────────────────────────────────────────────────────────────────

export async function adminFetchOrder(orderId: string): Promise<Order | null> {
  const snap = await adminDb.collection("orders").doc(orderId).get()
  if (!snap.exists) return null
  return normalizeOrderDoc(snap.id, snap.data() as Record<string, unknown>)
}

export async function adminFetchOrderByTracking(tracking: string): Promise<Order | null> {
  const token = tracking.trim()
  if (!token) return null
  const snap = await adminDb
    .collection("orders")
    .where("orderNumber", "==", token)
    .get()
  if (!snap.empty) {
    // Sort in memory — most recently created order wins (no composite index needed)
    const toMs = (v: unknown): number => {
      if (!v) return 0
      if (typeof v === "object" && v !== null && "seconds" in v) return (v as { seconds: number }).seconds * 1000
      return new Date(v as string | number).getTime()
    }
    const sorted = snap.docs.slice().sort((a, b) => toMs(b.data().createdAt) - toMs(a.data().createdAt))
    const d = sorted[0]
    return normalizeOrderDoc(d.id, d.data() as Record<string, unknown>)
  }
  return adminFetchOrder(token)
}

export async function adminUpdateOrder(orderId: string, updates: Partial<Order>): Promise<void> {
  let geoUpdate: { distanceKm?: number; lat?: number; lng?: number } = {}
  if (typeof updates.address === "string" && updates.address.trim()) {
    geoUpdate = await calculateDistanceKm(updates.address)
  }
  await adminDb.collection("orders").doc(orderId).update({
    ...updates,
    ...geoUpdate,
    updatedAt: new Date(),
  })
}

export async function adminCreateOrderWithId(
  orderId: string,
  order: Omit<Order, "id">
): Promise<string> {
  const geo = await calculateDistanceKm(order.address)
  await adminDb.collection("orders").doc(orderId).set({
    ...order,
    ...geo,
    createdAt: new Date(),
  })
  return orderId
}

export async function adminOrderExists(orderNumber: string): Promise<boolean> {
  const stripped = orderNumber.replace(/^WC-/i, "")
  const snap = await adminDb
    .collection("orders")
    .where("orderNumber", "in", [stripped, `WC-${stripped}`])
    .get()
  return !snap.empty
}

// ── Drivers ───────────────────────────────────────────────────────────────────

export async function adminFetchDriverById(driverId: string): Promise<Driver | null> {
  const snap = await adminDb.collection("drivers").doc(driverId).get()
  if (!snap.exists) return null
  return { id: snap.id, ...snap.data() } as Driver
}

export async function adminCreateDriver(driver: Omit<Driver, "id">): Promise<string> {
  const driverData = { ...driver }
  if (driverData.password) driverData.password = await hashPassword(driverData.password)
  const ref = await adminDb.collection("drivers").add({ ...driverData, createdAt: new Date() })
  return ref.id
}

export async function adminUpdateDriver(
  driverId: string,
  updates: Partial<Driver>
): Promise<void> {
  const updatesData = { ...updates }
  if (updatesData.password && !isHashed(updatesData.password)) {
    updatesData.password = await hashPassword(updatesData.password)
  }
  await adminDb.collection("drivers").doc(driverId).update({ ...updatesData, updatedAt: new Date() })
}

export async function adminDeleteDriver(driverId: string): Promise<void> {
  await adminDb.collection("drivers").doc(driverId).delete()
}

export async function adminUpdateDriverLocation(
  driverId: string,
  lat: number,
  lng: number
): Promise<void> {
  await adminDb.collection("drivers").doc(driverId).update({
    lastLocation: { lat, lng },
    locationUpdatedAt: new Date(),
  })
}

// ── Route optimization ────────────────────────────────────────────────────────

export async function adminSaveOptimizedRouteOrder(orderedIds: string[]): Promise<void> {
  await Promise.all(
    orderedIds.map((id, i) =>
      adminDb
        .collection("orders")
        .doc(id)
        .update({ routeOrder: i })
        .catch(() => null)
    )
  )
}

// ── Ratings ───────────────────────────────────────────────────────────────────

export async function adminRecalculateDriverRating(driverId: string): Promise<number> {
  const snap = await adminDb
    .collection("orders")
    .where("assignedDriver", "==", driverId)
    .where("driverRating", ">", 0)
    .get()
  if (snap.empty) return 0
  let sum = 0
  for (const d of snap.docs) sum += (d.data().driverRating as number) ?? 0
  const rounded = Math.round((sum / snap.size) * 10) / 10
  await adminUpdateDriver(driverId, { rating: rounded })
  return rounded
}

// ── Bulk admin utilities ──────────────────────────────────────────────────────

export async function adminCleanOrderNumbersWC(): Promise<number> {
  const snap = await adminDb
    .collection("orders")
    .where("orderNumber", ">=", "WC-")
    .where("orderNumber", "<", "WC.`")
    .get()
  let updated = 0
  for (const d of snap.docs) {
    const orderNumber = d.data().orderNumber
    if (typeof orderNumber === "string" && orderNumber.startsWith("WC-")) {
      await d.ref.update({ orderNumber: orderNumber.replace(/^WC-/, "") })
      updated++
    }
  }
  return updated
}

export async function adminRemoveDuplicateOrders(): Promise<number> {
  const snap = await adminDb.collection("orders").get()
  const orderMap = new Map<string, { id: string; createdAt: unknown }[]>()
  for (const d of snap.docs) {
    const data = d.data()
    const orderNumber = data.orderNumber as string
    if (!orderNumber) continue
    if (!orderMap.has(orderNumber)) orderMap.set(orderNumber, [])
    orderMap.get(orderNumber)!.push({ id: d.id, createdAt: data.createdAt })
  }
  let deleted = 0
  for (const [, docs] of orderMap) {
    if (docs.length <= 1) continue
    docs.sort((a, b) => (toDate(a.createdAt)?.getTime() ?? 0) - (toDate(b.createdAt)?.getTime() ?? 0))
    for (let i = 1; i < docs.length; i++) {
      await adminDb.collection("orders").doc(docs[i].id).delete()
      deleted++
    }
  }
  return deleted
}

export async function adminBackfillOrderCoords(): Promise<number> {
  const snap = await adminDb.collection("orders").get()
  let updated = 0
  for (const d of snap.docs) {
    const data = d.data()
    if (typeof data.lat === "number" && typeof data.lng === "number") continue
    const address = data.address as string
    if (!address?.trim()) continue
    const coords = await geocodeAddress(address.trim())
    if (coords) {
      await d.ref.update({ lat: coords.lat, lng: coords.lng })
      updated++
    }
  }
  return updated
}

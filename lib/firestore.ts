import {
  collection,
  getDocs,
  getDoc,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
} from "firebase/firestore"
import { db } from "./firebase"
import type { Order, Driver, NotificationLog } from "./data"

type LatLng = { lat: number; lng: number }

const DEFAULT_HUB_COORDS: LatLng = { lat: 6.4642667, lng: 3.5554814 }

function getHubCoordinates(): LatLng {
  const rawLat = Number(process.env.NEXT_PUBLIC_HUB_LAT)
  const rawLng = Number(process.env.NEXT_PUBLIC_HUB_LNG)
  if (!Number.isNaN(rawLat) && !Number.isNaN(rawLng)) {
    return { lat: rawLat, lng: rawLng }
  }
  return DEFAULT_HUB_COORDS
}

const geocodeCache = new Map<string, LatLng>()

async function geocodeAddress(address: string): Promise<LatLng | null> {
  const query = address.trim()
  if (!query) return null

  const cached = geocodeCache.get(query)
  if (cached) return cached

  // Try Google Maps Geocoding API first
  try {
    const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? ""
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${API_KEY}`
    const response = await fetch(url)
    if (response.ok) {
      const data = await response.json()
      const loc = data.results?.[0]?.geometry?.location
      if (loc) {
        const coords: LatLng = { lat: loc.lat, lng: loc.lng }
        geocodeCache.set(query, coords)
        return coords
      }
    }
  } catch { /* fall through to Nominatim */ }

  // Fallback to Nominatim (OpenStreetMap)
  try {
    const nUrl = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`
    const nRes = await fetch(nUrl, {
      headers: { Accept: "application/json", "User-Agent": "sg-delivery/1.0" },
    })
    if (!nRes.ok) return null
    const nData = await nRes.json()
    const result = nData?.[0]
    if (!result) return null

    const lat = Number(result.lat)
    const lng = Number(result.lon)
    if (Number.isNaN(lat) || Number.isNaN(lng)) return null

    const coords: LatLng = { lat, lng }
    geocodeCache.set(query, coords)
    return coords
  } catch {
    return null
  }
}

function haversineDistanceKm(a: LatLng, b: LatLng): number {
  const toRad = (value: number) => (value * Math.PI) / 180
  const earthRadiusKm = 6371
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)

  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
  return Number((earthRadiusKm * c).toFixed(2))
}

async function calculateDistanceKm(address: string): Promise<number | undefined> {
  const destination = await geocodeAddress(address)
  if (!destination) return undefined
  return haversineDistanceKm(getHubCoordinates(), destination)
}

function normalizeOrderStatus(status: unknown): Order["status"] {
  if (status === "pending") return "unassigned"
  if (status === "assigned") return "started"
  if (status === "started") return "started"
  if (status === "picked-up") return "picked-up"
  if (status === "in-transit") return "in-transit"
  if (status === "delivered") return "delivered"
  if (status === "failed") return "failed"
  if (status === "cancelled") return "cancelled"
  return "unassigned"
}

function normalizeOrderDoc(id: string, data: Record<string, unknown>): Order {
  return {
    ...(data as Omit<Order, "id" | "status">),
    id,
    status: normalizeOrderStatus(data.status),
  } as Order
}

// Orders Collection
export const ordersCollection = collection(db, "orders")
export const driversCollection = collection(db, "drivers")
export const notificationLogsCollection = collection(db, "notificationLogs")

// Fetch all orders
export async function fetchOrders(): Promise<Order[]> {
  try {
    const q = query(ordersCollection, orderBy("createdAt", "desc"))
    const snapshot = await getDocs(q)
    return snapshot.docs.map((doc) => normalizeOrderDoc(doc.id, doc.data() as Record<string, unknown>))
  } catch (error) {
    console.error("Error fetching orders:", error)
    return []
  }
}

// Fetch all drivers
export async function fetchDrivers(): Promise<Driver[]> {
  try {
    const snapshot = await getDocs(driversCollection)
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    } as Driver))
  } catch (error) {
    console.error("Error fetching drivers:", error)
    return []
  }
}

// Fetch single order
export async function fetchOrder(orderId: string): Promise<Order | null> {
  try {
    const docRef = doc(db, "orders", orderId)
    const snapshot = await getDoc(docRef)
    if (!snapshot.exists()) return null
    return normalizeOrderDoc(snapshot.id, snapshot.data() as Record<string, unknown>)
  } catch (error) {
    console.error("Error fetching order:", error)
    return null
  }
}

// Fetch order by tracking token (order number first, then doc id fallback)
export async function fetchOrderByTracking(tracking: string): Promise<Order | null> {
  const token = tracking.trim()
  if (!token) return null

  try {
    const byOrderNumber = query(ordersCollection, where("orderNumber", "==", token))
    const snapshot = await getDocs(byOrderNumber)
    if (!snapshot.empty) {
      const docRef = snapshot.docs[0]
      return normalizeOrderDoc(docRef.id, docRef.data() as Record<string, unknown>)
    }
  } catch (error) {
    console.error("Error fetching order by order number:", error)
  }

  // fallback to document id
  return fetchOrder(token)
}

// Fetch single driver
export async function fetchDriverById(driverId: string): Promise<Driver | null> {
  try {
    const docRef = doc(db, "drivers", driverId)
    const snapshot = await getDoc(docRef)
    if (!snapshot.exists()) return null
    return {
      id: snapshot.id,
      ...snapshot.data(),
    } as Driver
  } catch (error) {
    console.error("Error fetching driver:", error)
    return null
  }
}

// Create new order
export async function createOrder(order: Omit<Order, "id">) {
  try {
    const distanceKm = await calculateDistanceKm(order.address)
    const docRef = await addDoc(ordersCollection, {
      ...order,
      ...(distanceKm !== undefined ? { distanceKm } : {}),
      createdAt: new Date(),
    })
    return docRef.id
  } catch (error) {
    console.error("Error creating order:", error)
    throw error
  }
}

// Update order
export async function updateOrder(orderId: string, updates: Partial<Order>) {
  try {
    const docRef = doc(db, "orders", orderId)
    let distanceUpdate: { distanceKm?: number } = {}
    if (typeof updates.address === "string" && updates.address.trim()) {
      const distanceKm = await calculateDistanceKm(updates.address)
      if (distanceKm !== undefined) {
        distanceUpdate = { distanceKm }
      }
    }
    await updateDoc(docRef, {
      ...updates,
      ...distanceUpdate,
      updatedAt: new Date(),
    })
  } catch (error) {
    console.error("Error updating order:", error)
    throw error
  }
}

// Delete order
export async function deleteOrder(orderId: string) {
  try {
    await deleteDoc(doc(db, "orders", orderId))
  } catch (error) {
    console.error("Error deleting order:", error)
    throw error
  }
}

// Fetch orders by status
export async function fetchOrdersByStatus(status: string): Promise<Order[]> {
  try {
    const q = query(
      ordersCollection,
      where("status", "==", status),
      orderBy("createdAt", "desc")
    )
    const snapshot = await getDocs(q)
    return snapshot.docs.map((doc) => normalizeOrderDoc(doc.id, doc.data() as Record<string, unknown>))
  } catch (error) {
    console.error("Error fetching orders by status:", error)
    return []
  }
}

// Fetch drivers by status
export async function fetchDriversByStatus(status: string): Promise<Driver[]> {
  try {
    const q = query(driversCollection, where("status", "==", status))
    const snapshot = await getDocs(q)
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    } as Driver))
  } catch (error) {
    console.error("Error fetching drivers by status:", error)
    return []
  }
}

// Update driver
export async function updateDriver(driverId: string, updates: Partial<Driver>) {
  try {
    const docRef = doc(db, "drivers", driverId)
    await updateDoc(docRef, {
      ...updates,
      updatedAt: new Date(),
    })
  } catch (error) {
    console.error("Error updating driver:", error)
    throw error
  }
}

// Delete driver
export async function deleteDriver(driverId: string) {
  try {
    await deleteDoc(doc(db, "drivers", driverId))
  } catch (error) {
    console.error("Error deleting driver:", error)
    throw error
  }
}

// Fetch orders assigned to a specific driver
export async function fetchOrdersByDriver(driverId: string): Promise<Order[]> {
  try {
    const q = query(
      ordersCollection,
      where("assignedDriver", "==", driverId)
    )
    const snapshot = await getDocs(q)
    return snapshot.docs.map((d) => normalizeOrderDoc(d.id, d.data() as Record<string, unknown>))
  } catch (error) {
    console.error("Error fetching driver orders:", error)
    return []
  }
}

function normalizeDriverPhoneForMatch(value: string): string | null {
  const digits = value.replace(/\D/g, "")
  if (!digits) return null

  // Accept common Nigerian formats:
  // +2348045678901, 2348045678901, 08045678901, 8045678901
  if (digits.length === 10) return digits
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1)
  if (digits.length >= 13 && digits.startsWith("234")) return digits.slice(-10)
  if (digits.length > 10) return digits.slice(-10)

  return null
}

// Authenticate driver by phone + password
export async function authenticateDriver(phone: string, password: string): Promise<Driver | null> {
  try {
    const normalizedInput = normalizeDriverPhoneForMatch(phone)
    if (!normalizedInput) return null

    const snapshot = await getDocs(driversCollection)
    for (const driverDoc of snapshot.docs) {
      const data = driverDoc.data() as Driver
      const normalizedStored = normalizeDriverPhoneForMatch(String(data.phone ?? ""))
      if (normalizedStored === normalizedInput && data.password === password) {
        return { ...data, id: driverDoc.id } as Driver
      }
    }

    return null
  } catch (error) {
    console.error("Error authenticating driver:", error)
    return null
  }
}

// Update driver GPS location
export async function updateDriverLocation(driverId: string, lat: number, lng: number) {
  try {
    const docRef = doc(db, "drivers", driverId)
    await updateDoc(docRef, {
      lastLocation: { lat, lng },
      locationUpdatedAt: new Date(),
    })
  } catch (error) {
    console.error("Error updating driver location:", error)
    throw error
  }
}

// Fetch notification logs
export async function fetchNotificationLogs(limit = 20): Promise<NotificationLog[]> {
  try {
    const q = query(notificationLogsCollection, orderBy("createdAt", "desc"))
    const snapshot = await getDocs(q)
    return snapshot.docs.slice(0, limit).map((doc) => ({
      id: doc.id,
      ...doc.data(),
    } as NotificationLog))
  } catch (error) {
    console.error("Error fetching notification logs:", error)
    return []
  }
}

export function subscribeOrdersRealtime(onData: (orders: Order[]) => void) {
  const q = query(ordersCollection, orderBy("createdAt", "desc"))
  return onSnapshot(
    q,
    (snapshot) => {
      const orders = snapshot.docs.map((doc) =>
        normalizeOrderDoc(doc.id, doc.data() as Record<string, unknown>)
      )
      onData(orders)
    },
    (error) => {
      console.error("Error subscribing to orders:", error)
      onData([])
    }
  )
}

export function subscribeDriversRealtime(onData: (drivers: Driver[]) => void) {
  return onSnapshot(
    driversCollection,
    (snapshot) => {
      const drivers = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      } as Driver))
      onData(drivers)
    },
    (error) => {
      console.error("Error subscribing to drivers:", error)
      onData([])
    }
  )
}

export function subscribeOrderByTrackingRealtime(
  tracking: string,
  onData: (order: Order | null) => void
) {
  const token = tracking.trim()
  if (!token) {
    onData(null)
    return () => undefined
  }

  let fallbackUnsubscribe: (() => void) | null = null
  let fallbackActive = false
  const byOrderNumber = query(ordersCollection, where("orderNumber", "==", token))

  const orderNumberUnsubscribe = onSnapshot(
    byOrderNumber,
    (snapshot) => {
      if (!snapshot.empty) {
        if (fallbackUnsubscribe) {
          fallbackUnsubscribe()
          fallbackUnsubscribe = null
          fallbackActive = false
        }
        const docRef = snapshot.docs[0]
        onData(normalizeOrderDoc(docRef.id, docRef.data() as Record<string, unknown>))
        return
      }

      if (!fallbackActive) {
        fallbackActive = true
        fallbackUnsubscribe = onSnapshot(
          doc(db, "orders", token),
          (docSnapshot) => {
            if (!docSnapshot.exists()) {
              onData(null)
              return
            }
            onData(normalizeOrderDoc(docSnapshot.id, docSnapshot.data() as Record<string, unknown>))
          },
          (error) => {
            console.error("Error subscribing to fallback tracking doc:", error)
            onData(null)
          }
        )
      }
    },
    (error) => {
      console.error("Error subscribing to order by tracking:", error)
      onData(null)
    }
  )

  return () => {
    orderNumberUnsubscribe()
    if (fallbackUnsubscribe) fallbackUnsubscribe()
  }
}

export function subscribeDriverRealtime(
  driverId: string,
  onData: (driver: Driver | null) => void
) {
  const id = driverId.trim()
  if (!id) {
    onData(null)
    return () => undefined
  }

  return onSnapshot(
    doc(db, "drivers", id),
    (snapshot) => {
      if (!snapshot.exists()) {
        onData(null)
        return
      }
      onData({
        id: snapshot.id,
        ...snapshot.data(),
      } as Driver)
    },
    (error) => {
      console.error("Error subscribing to driver:", error)
      onData(null)
    }
  )
}
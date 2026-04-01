"use client"

import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { fetchDriverById, updateDriver, updateDriverLocation, fetchOrdersByDriver, saveOptimizedRouteOrder, subscribeDriverRealtime } from "@/lib/firestore"
import { optimizeRouteOrder } from "@/lib/google-maps"
import type { Driver, Order } from "@/lib/data"
import { toast } from "@/hooks/use-toast"

interface DriverSession {
  id: string
  name: string
  phone: string
}

interface DriverContextValue {
  session: DriverSession | null
  driver: Driver | null
  orders: Order[]
  isOnline: boolean
  justWentOnline: boolean
  consumeJustWentOnline: () => void
  loadingSession: boolean
  loadingOrders: boolean
  drawerOpen: boolean
  setDrawerOpen: (open: boolean) => void
  goOnline: () => Promise<void>
  goOffline: () => Promise<void>
  refreshOrders: () => Promise<void>
  optimizeRoute: (lastStopId?: string | null) => Promise<boolean>
  logout: () => void
  /** Latest GPS position from the device (updated locally before Firestore round-trip) */
  liveGps: { lat: number; lng: number } | null
}

const DriverContext = createContext<DriverContextValue | null>(null)

export function useDriver() {
  const ctx = useContext(DriverContext)
  if (!ctx) throw new Error("useDriver must be used within DriverProvider")
  return ctx
}

export function DriverProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [session, setSession] = useState<DriverSession | null>(null)
  const [driver, setDriver] = useState<Driver | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [isOnline, setIsOnline] = useState(false)
  const [loadingSession, setLoadingSession] = useState(true)
  const [loadingOrders, setLoadingOrders] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [justWentOnline, setJustWentOnline] = useState(false)
  const [liveGps, setLiveGps] = useState<{ lat: number; lng: number } | null>(null)
  const watchIdRef = useRef<number | null>(null)
  const lastGpsWriteRef = useRef<number>(0)

  // Load session from localStorage
  useEffect(() => {
    const raw = localStorage.getItem("driverSession")
    if (!raw) {
      setLoadingSession(false)
      return
    }
    try {
      const parsed = JSON.parse(raw) as DriverSession
      if (parsed?.id) {
        setSession(parsed)
      }
    } catch {
      localStorage.removeItem("driverSession")
    }
    setLoadingSession(false)
  }, [])

  // Subscribe to driver profile in realtime so lastLocation updates live
  useEffect(() => {
    if (!session) return
    const unsubscribe = subscribeDriverRealtime(session.id, (d) => {
      if (d) {
        setDriver(d)
        setIsOnline(d.status === "available" || d.status === "on-delivery")
      }
    })
    return () => unsubscribe()
  }, [session])

  // GPS tracking when online
  useEffect(() => {
    if (!session || !isOnline) return
    if (!navigator.geolocation) {
      toast({ title: "Location unavailable", description: "Your device does not support GPS.", variant: "destructive" })
      return
    }
    if (watchIdRef.current !== null) return

    // Get an immediate position fix so the map shows the driver right away
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setLiveGps(coords)
        lastGpsWriteRef.current = Date.now()
        try {
          await updateDriverLocation(session.id, coords.lat, coords.lng)
        } catch {
          // silently ignore
        }
      },
      (err) => {
        console.warn("Initial GPS fix failed:", err.message)
        if (err.code === err.PERMISSION_DENIED) {
          toast({ title: "Location access denied", description: "Go to your device Settings → App Permissions → Location and enable it for this app so customers can track your delivery.", variant: "destructive" })
        }
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    )

    watchIdRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        // Always update local state immediately for instant map updates
        setLiveGps(coords)

        // Throttle writes to Firestore — at most once every 5 seconds
        const now = Date.now()
        if (now - lastGpsWriteRef.current < 5000) return
        lastGpsWriteRef.current = now
        try {
          await updateDriverLocation(session.id, coords.lat, coords.lng)
        } catch {
          // silently ignore
        }
      },
      (err) => {
        console.warn("GPS watch error:", err.message)
        if (err.code === err.PERMISSION_DENIED) {
          toast({ title: "Location access denied", description: "Go to your device Settings → App Permissions → Location and enable it for this app so customers can track your delivery.", variant: "destructive" })
        }
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    )

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
    }
  }, [session, isOnline])

  const refreshOrders = useCallback(async () => {
    if (!session) return
    setLoadingOrders(true)
    try {
      const data = await fetchOrdersByDriver(session.id)
      const hasRouteOrder = data.some((o) => typeof o.routeOrder === "number")
      const sorted = data.sort((a, b) => {
        // If route has been optimized, sort active orders by routeOrder
        if (hasRouteOrder) {
          const aActive = a.status !== "delivered" && a.status !== "cancelled" && a.status !== "failed"
          const bActive = b.status !== "delivered" && b.status !== "cancelled" && b.status !== "failed"
          // Active orders with routeOrder come first, in order
          if (aActive && bActive) {
            const aR = a.routeOrder ?? 9999
            const bR = b.routeOrder ?? 9999
            if (aR !== bR) return aR - bR
          }
          // Inactive orders go to the bottom
          if (aActive && !bActive) return -1
          if (!aActive && bActive) return 1
        }
        // Fallback: sort by status priority
        const priority: Record<string, number> = {
          started: 0,
          "picked-up": 1,
          "in-transit": 2,
          delivered: 3,
          failed: 4,
          cancelled: 5,
          unassigned: 6,
        }
        return (priority[a.status] ?? 5) - (priority[b.status] ?? 5)
      })
      setOrders(sorted)
    } catch {
      toast({ title: "Error", description: "Failed to load deliveries.", variant: "destructive" })
    } finally {
      setLoadingOrders(false)
    }
  }, [session])

  const optimizeRoute = useCallback(async (lastStopId?: string | null): Promise<boolean> => {
    if (!session || !driver?.lastLocation) return false
    try {
      const data = await fetchOrdersByDriver(session.id)
      const active = data.filter(
        (o) => o.status === "picked-up" || o.status === "in-transit"
      )
      // Need lat/lng on orders to optimize
      const withCoords = active.filter(
        (o) => typeof o.lat === "number" && typeof o.lng === "number"
      ) as (Order & { lat: number; lng: number })[]

      if (withCoords.length < 2) {
        // Nothing to optimize with 0-1 stops
        return false
      }

      const orderedIds = await optimizeRouteOrder(
        driver.lastLocation,
        withCoords.map((o) => ({ id: o.id, lat: o.lat, lng: o.lng })),
        lastStopId,
      )

      // Persist to Firestore
      await saveOptimizedRouteOrder(orderedIds)

      // Refresh to reflect new order
      await refreshOrders()
      return true
    } catch {
      toast({ title: "Error", description: "Route optimization failed.", variant: "destructive" })
      return false
    }
  }, [session, driver, refreshOrders])

  // Load orders when online
  useEffect(() => {
    if (session && isOnline) refreshOrders()
  }, [session, isOnline, refreshOrders])

  async function goOnline() {
    if (!session) return
    try {
      await updateDriver(session.id, { status: "available" })
      setIsOnline(true)
      setJustWentOnline(true)
      const d = await fetchDriverById(session.id)
      if (d) setDriver(d)
    } catch {
      toast({ title: "Error", description: "Failed to go online.", variant: "destructive" })
    }
  }

  async function goOffline() {
    if (!session) return
    try {
      await updateDriver(session.id, { status: "offline" })
      setIsOnline(false)
      setJustWentOnline(false)
      const d = await fetchDriverById(session.id)
      if (d) setDriver(d)
    } catch {
      toast({ title: "Error", description: "Failed to go offline.", variant: "destructive" })
    }
  }

  function logout() {
    localStorage.removeItem("driverSession")
    setSession(null)
    setDriver(null)
    setOrders([])
    setIsOnline(false)
    router.replace("/driver")
  }

  return (
    <DriverContext.Provider
      value={{
        session,
        driver,
        orders,
        isOnline,
        justWentOnline,
        consumeJustWentOnline: () => setJustWentOnline(false),
        loadingSession,
        loadingOrders,
        drawerOpen,
        setDrawerOpen,
        goOnline,
        goOffline,
        refreshOrders,
        optimizeRoute,
        logout,
        liveGps,
      }}
    >
      {children}
    </DriverContext.Provider>
  )
}

"use client"

import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { fetchDriverById, updateDriver, updateDriverLocation, fetchOrdersByDriver } from "@/lib/firestore"
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
  loadingSession: boolean
  loadingOrders: boolean
  drawerOpen: boolean
  setDrawerOpen: (open: boolean) => void
  goOnline: () => Promise<void>
  goOffline: () => Promise<void>
  refreshOrders: () => Promise<void>
  logout: () => void
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
  const watchIdRef = useRef<number | null>(null)

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

  // Fetch driver profile
  useEffect(() => {
    if (!session) return
    fetchDriverById(session.id).then((d) => {
      if (d) {
        setDriver(d)
        setIsOnline(d.status === "available" || d.status === "on-delivery")
      }
    })
  }, [session])

  // GPS tracking when online
  useEffect(() => {
    if (!session || !isOnline) return
    if (!navigator.geolocation) return
    if (watchIdRef.current !== null) return

    watchIdRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        try {
          await updateDriverLocation(session.id, pos.coords.latitude, pos.coords.longitude)
        } catch {
          // silently ignore
        }
      },
      () => {},
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
      const sorted = data.sort((a, b) => {
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

  // Load orders when online
  useEffect(() => {
    if (session && isOnline) refreshOrders()
  }, [session, isOnline, refreshOrders])

  async function goOnline() {
    if (!session) return
    try {
      await updateDriver(session.id, { status: "available" })
      setIsOnline(true)
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
        loadingSession,
        loadingOrders,
        drawerOpen,
        setDrawerOpen,
        goOnline,
        goOffline,
        refreshOrders,
        logout,
      }}
    >
      {children}
    </DriverContext.Provider>
  )
}

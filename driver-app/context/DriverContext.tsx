import {
  createContext, useContext, useState, useEffect,
  useCallback, useRef, useMemo, type ReactNode,
} from "react"
import * as SecureStore from "expo-secure-store"
import * as Location from "expo-location"
import * as TaskManager from "expo-task-manager"
import * as Notifications from "expo-notifications"
import { AppState, type AppStateStatus } from "react-native"
import { router } from "expo-router"
import {
  loadSession, saveSession, clearSession,
  getPendingDeliveries, removePendingDelivery,
  getProfilePhoto, saveProfilePhoto as storeProfilePhoto,
  getPreferences, type Preferences,
} from "@/lib/storage"
import { driverFetch, clearTokenCache } from "@/lib/api"
import { registerForPushNotifications, showLocalNotification } from "@/lib/notifications"
import type { Driver, DriverSession, Order } from "@/lib/types"

const BG_LOCATION_TASK = "bg-location-task"

TaskManager.defineTask(BG_LOCATION_TASK, async ({ data, error }: TaskManager.TaskManagerTaskBody<{ locations: Location.LocationObject[] }>) => {
  if (error || !data) return
  // Skip background send when app is foregrounded — foreground watcher handles it
  if (AppState.currentState === "active") return
  const { locations } = data
  const loc = locations[0]
  if (!loc) return
  try {
    // Read session from secure storage since this task runs outside the React context
    const [sessionRaw, token] = await Promise.all([
      SecureStore.getItemAsync("driverSession"),
      SecureStore.getItemAsync("driverToken"),
    ])
    if (!token || !sessionRaw) return
    const session = JSON.parse(sessionRaw) as { id?: string }
    if (!session?.id) return
    await fetch("https://sterlinglamslogistics.com/api/driver/location", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Driver-Token": token },
      body: JSON.stringify({ driverId: session.id, lat: loc.coords.latitude, lng: loc.coords.longitude }),
    })
  } catch { /* best-effort */ }
})

interface DriverContextValue {
  session: DriverSession | null
  driver: Driver | null
  orders: Order[]
  isOnline: boolean
  loadingSession: boolean
  loadingOrders: boolean
  gpsError: boolean
  liveGps: { lat: number; lng: number } | null
  pendingDeliveryCount: number
  unreadMessageCount: number
  drawerOpen: boolean
  profilePhoto: string | null
  preferences: Preferences
  goOnline: () => Promise<void>
  goOffline: () => Promise<void>
  refreshOrders: () => Promise<void>
  patchOrder: (id: string, updates: Partial<Order>) => void
  refreshUnreadCount: () => Promise<void>
  logout: () => Promise<void>
  login: (session: DriverSession) => Promise<void>
  setDrawerOpen: (open: boolean) => void
  setProfilePhoto: (uri: string) => Promise<void>
  updatePreferences: (prefs: Preferences) => Promise<void>
  setUnreadMessageCount: (count: number) => void
}

const DriverContext = createContext<DriverContextValue | null>(null)

export function useDriver() {
  const ctx = useContext(DriverContext)
  if (!ctx) throw new Error("useDriver must be used inside DriverProvider")
  return ctx
}

export function DriverProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<DriverSession | null>(null)
  const [driver, setDriver] = useState<Driver | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [isOnline, setIsOnline] = useState(false)
  const [loadingSession, setLoadingSession] = useState(true)
  const [loadingOrders, setLoadingOrders] = useState(false)
  const [gpsError, setGpsError] = useState(false)
  const [liveGps, setLiveGps] = useState<{ lat: number; lng: number } | null>(null)
  const [pendingDeliveryCount, setPendingDeliveryCount] = useState(0)
  const [unreadMessageCount, setUnreadMessageCount] = useState(0)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [profilePhoto, setProfilePhotoState] = useState<string | null>(null)
  const [preferences, setPreferences] = useState<Preferences>({
    newOrderAlert: true, statusConfirmation: false, podRequired: true, cashTips: false,
  })
  const lastGpsWrite = useRef(0)
  const locationSub = useRef<Location.LocationSubscription | null>(null)
  const unreadPollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const orderPollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const prevOrderIds = useRef<Set<string>>(new Set())
  const isRetryingRef = useRef(false)
  // True until the first successful order load — controls the full-screen spinner
  const isFirstOrderLoadRef = useRef(true)

  useEffect(() => {
    Promise.all([loadSession(), getProfilePhoto(), getPreferences()]).then(async ([s, photo, prefs]) => {
      if (s) {
        setSession(s)
        void fetchDriverProfile(s.id)
      }
      if (photo) setProfilePhotoState(photo)
      setPreferences(prefs)
      setLoadingSession(false)
    })
  }, [])

  useEffect(() => {
    getPendingDeliveries().then((p) => setPendingDeliveryCount(p.length))
  }, [])

  // ── Register push token once session is available ─────────────────────────
  useEffect(() => {
    if (!session) return
    registerForPushNotifications(session.id).catch(() => {})
  }, [session?.id])

  // ── Foreground notification listener — handle new-order & message alerts ──
  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener((notification) => {
      const data = notification.request.content.data as Record<string, unknown> | undefined
      const type = data?.type as string | undefined

      if (type === "new_order") {
        void refreshOrders()
      }
      if (type === "new_message") {
        setUnreadMessageCount((c) => c + 1)
      }
    })
    return () => sub.remove()
  }, [])

  // ── Offline sync on app foreground ────────────────────────────────────────
  useEffect(() => {
    const sub = AppState.addEventListener("change", async (state: AppStateStatus) => {
      if (state !== "active") return
      if (isRetryingRef.current) return
      isRetryingRef.current = true
      try {
        const pending = await getPendingDeliveries()
        if (pending.length === 0) return
        for (const item of pending) {
          try {
            const res = await driverFetch(`/api/driver/orders/${encodeURIComponent(item.orderId)}/status`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                driverId: item.driverId, status: "delivered",
                ...(item.photoData ? { photoData: item.photoData } : {}),
                ...(item.signatureData ? { signatureData: item.signatureData } : {}),
                ...(item.deliveryNotes ? { deliveryNotes: item.deliveryNotes } : {}),
              }),
            })
            if (res.ok) await removePendingDelivery(item.orderId)
          } catch { /* retry next time */ }
        }
        getPendingDeliveries().then((p) => setPendingDeliveryCount(p.length))
      } finally {
        isRetryingRef.current = false
      }
    })
    return () => sub.remove()
  }, [])

  // ── GPS start/stop based on online state ──────────────────────────────────
  useEffect(() => {
    if (!session || !isOnline) {
      void stopGps()
      return
    }
    void startGps()
    return () => { void stopGps() }
  }, [session, isOnline])

  // ── Unread message polling (every 30s when online) ────────────────────────
  const refreshUnreadCount = useCallback(async () => {
    if (!session) return
    try {
      const res = await driverFetch(`/api/driver/messages/unread?driverId=${encodeURIComponent(session.id)}`)
      if (!res.ok) return
      const data = await res.json() as { count?: number }
      setUnreadMessageCount(data.count ?? 0)
    } catch { /* ignore */ }
  }, [session])

  useEffect(() => {
    if (!session || !isOnline) {
      if (unreadPollRef.current) { clearInterval(unreadPollRef.current); unreadPollRef.current = null }
      return
    }
    void refreshUnreadCount()
    unreadPollRef.current = setInterval(() => { void refreshUnreadCount() }, 30_000)
    return () => {
      if (unreadPollRef.current) { clearInterval(unreadPollRef.current); unreadPollRef.current = null }
    }
  }, [session, isOnline, refreshUnreadCount])

  async function startGps() {
    const { status } = await Location.requestForegroundPermissionsAsync()
    if (status !== "granted") { setGpsError(true); return }
    try {
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
      const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude }
      setLiveGps(coords)
      sendLocation(coords)
    } catch { /* ignore */ }
    setGpsError(false)
    locationSub.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 10 },
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setLiveGps(coords)
        setGpsError(false)
        const now = Date.now()
        if (now - lastGpsWrite.current < 5000) return
        lastGpsWrite.current = now
        sendLocation(coords)
      }
    )
    const bgStatus = await Location.requestBackgroundPermissionsAsync()
    if (bgStatus.status === "granted") {
      const already = await Location.hasStartedLocationUpdatesAsync(BG_LOCATION_TASK).catch(() => false)
      if (!already) {
        await Location.startLocationUpdatesAsync(BG_LOCATION_TASK, {
          // Balanced accuracy is sufficient for delivery tracking (~50m) and saves battery
          accuracy: Location.Accuracy.Balanced, timeInterval: 15000, distanceInterval: 20,
          showsBackgroundLocationIndicator: true,
          foregroundService: { notificationTitle: "Sterlin Driver", notificationBody: "Location tracking active", notificationColor: "#16a34a" },
        })
      }
    }
  }

  async function stopGps() {
    locationSub.current?.remove()
    locationSub.current = null
    const running = await Location.hasStartedLocationUpdatesAsync(BG_LOCATION_TASK).catch(() => false)
    if (running) await Location.stopLocationUpdatesAsync(BG_LOCATION_TASK).catch(() => { })
  }

  function sendLocation(coords: { lat: number; lng: number }) {
    if (!session) return
    driverFetch("/api/driver/location", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ driverId: session.id, lat: coords.lat, lng: coords.lng }),
    }).catch(() => { })
  }

  const patchOrder = useCallback((id: string, updates: Partial<Order>) => {
    setOrders((prev) => prev.map((o) => o.id === id ? { ...o, ...updates } : o))
  }, [])

  const refreshOrders = useCallback(async () => {
    if (!session) return
    // Only show the full-screen spinner on the very first load; background refreshes are silent
    if (isFirstOrderLoadRef.current) setLoadingOrders(true)
    try {
      const res = await driverFetch(`/api/driver/orders?driverId=${encodeURIComponent(session.id)}`)
      if (!res.ok) return
      const data = await res.json() as { orders?: Order[] }
      const raw = data.orders ?? []
      const sorted = [...raw].sort((a, b) => {
        const priority: Record<string, number> = {
          started: 0, "picked-up": 1, "in-transit": 2, delivered: 3, failed: 4, cancelled: 5, unassigned: 6,
        }
        const aR = typeof a.routeOrder === "number" ? a.routeOrder : 999
        const bR = typeof b.routeOrder === "number" ? b.routeOrder : 999
        if (aR !== bR) return aR - bR
        return (priority[a.status] ?? 5) - (priority[b.status] ?? 5)
      })

      // Fire local notification for genuinely new orders (not on first load)
      if (prevOrderIds.current.size > 0 && preferences.newOrderAlert) {
        for (const order of sorted) {
          if (!prevOrderIds.current.has(order.id) && (order.status === "unassigned" || order.status === "started")) {
            void showLocalNotification(
              "New Order",
              `Order #${order.orderNumber} — ${order.customerName}`,
              { type: "new_order", orderId: order.id },
              "new_order"
            )
          }
        }
      }
      prevOrderIds.current = new Set(sorted.map((o) => o.id))

      setOrders(sorted)
      isFirstOrderLoadRef.current = false
    } catch { /* silently ignore */ } finally {
      setLoadingOrders(false)
    }
  }, [session, preferences.newOrderAlert])

  useEffect(() => {
    if (session && isOnline) refreshOrders()
  }, [session, isOnline, refreshOrders])

  // ── Order polling (every 30s when online) ─────────────────────────────────
  useEffect(() => {
    if (!session || !isOnline) {
      if (orderPollRef.current) { clearInterval(orderPollRef.current); orderPollRef.current = null }
      return
    }
    orderPollRef.current = setInterval(() => { void refreshOrders() }, 30_000)
    return () => {
      if (orderPollRef.current) { clearInterval(orderPollRef.current); orderPollRef.current = null }
    }
  }, [session, isOnline, refreshOrders])

  async function goOnline() {
    if (!session) return
    const res = await driverFetch("/api/driver/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ driverId: session.id, status: "available" }),
    })
    if (res.ok) setIsOnline(true)
  }

  async function goOffline() {
    if (!session) return
    const res = await driverFetch("/api/driver/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ driverId: session.id, status: "offline" }),
    })
    if (res.ok) { setIsOnline(false); await stopGps() }
  }

  async function fetchDriverProfile(driverId: string) {
    try {
      const res = await driverFetch(`/api/driver/profile?driverId=${encodeURIComponent(driverId)}`)
      if (!res.ok) return
      const data = await res.json() as { driver?: Driver }
      if (data.driver) setDriver(data.driver)
    } catch { /* ignore — driver profile is best-effort */ }
  }

  async function login(s: DriverSession) {
    await saveSession(s)
    setSession(s)
    void fetchDriverProfile(s.id)
  }

  async function logout() {
    await stopGps()
    clearTokenCache()
    isFirstOrderLoadRef.current = true
    await clearSession()
    setSession(null); setDriver(null); setOrders([]); setIsOnline(false); setUnreadMessageCount(0)
    router.replace("/")
  }

  async function setProfilePhoto(uri: string) {
    await storeProfilePhoto(uri)
    setProfilePhotoState(uri)
  }

  async function updatePreferences(prefs: Preferences) {
    const { savePreferences } = await import("@/lib/storage")
    await savePreferences(prefs)
    setPreferences(prefs)
  }

  const value = useMemo<DriverContextValue>(() => ({
    session, driver, orders, isOnline, loadingSession, loadingOrders,
    gpsError, liveGps, pendingDeliveryCount, unreadMessageCount,
    drawerOpen, profilePhoto, preferences,
    goOnline, goOffline, refreshOrders, patchOrder, refreshUnreadCount, logout, login,
    setDrawerOpen, setProfilePhoto, updatePreferences, setUnreadMessageCount,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [session, driver, orders, isOnline, loadingSession, loadingOrders, gpsError, liveGps, pendingDeliveryCount, unreadMessageCount, drawerOpen, profilePhoto, preferences, refreshOrders, patchOrder, refreshUnreadCount])

  return <DriverContext.Provider value={value}>{children}</DriverContext.Provider>
}

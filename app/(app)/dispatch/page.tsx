"use client"

import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { MapPin, Search, Send, ChevronRight } from "lucide-react"
import {
  subscribeOrdersRealtime,
  subscribeDriversRealtime,
  updateOrder,
} from "@/lib/firestore"
import { loadGoogleMaps, geocodeAddress } from "@/lib/google-maps"
import { formatCurrency } from "@/lib/data"
import type { Order, Driver } from "@/lib/data"
import { notifyOrderEvent } from "@/lib/notify-client"
import { MarkerClusterer } from "@googlemaps/markerclusterer"

/* ── Constants ── */

type LatLng = { lat: number; lng: number }
const LAGOS: LatLng = { lat: 6.5244, lng: 3.3792 }

/* ── Helpers ── */

function orderColor(status: string): string {
  if (status === "unassigned") return "#dc2626"
  if (status === "delivered") return "#16a34a"
  return "#f97316"
}

function statusLabel(s: string): string {
  const map: Record<string, string> = {
    unassigned: "Unassigned",
    started: "Started",
    "picked-up": "Picked Up",
    "in-transit": "In Transit",
    delivered: "Delivered",
    failed: "Failed",
    cancelled: "Cancelled",
  }
  return map[s] ?? s
}

function driverStatusLabel(s: string): string {
  const map: Record<string, string> = {
    available: "Idle",
    "on-delivery": "Delivering",
    offline: "Offline",
  }
  return map[s] ?? s
}

function makeOrderIcon(color: string): google.maps.Symbol {
  return {
    path: google.maps.SymbolPath.CIRCLE,
    fillColor: color,
    fillOpacity: 1,
    strokeColor: "#fff",
    strokeWeight: 2,
    scale: 8,
  }
}

function makeDriverIcon(): google.maps.Icon {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><circle cx="20" cy="20" r="17" fill="%232563eb" stroke="white" stroke-width="2.5"/><rect x="11" y="15" width="11" height="9" rx="1" fill="white"/><path d="M22 17.5h4.5l3 3.5v3h-7.5z" fill="white"/><circle cx="15" cy="26" r="2" fill="%232563eb" stroke="white" stroke-width="1"/><circle cx="26" cy="26" r="2" fill="%232563eb" stroke="white" stroke-width="1"/></svg>`
  return {
    url: `data:image/svg+xml;charset=UTF-8,${svg}`,
    scaledSize: new google.maps.Size(40, 40),
    anchor: new google.maps.Point(20, 20),
  }
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

/* ── Component ── */

export default function DispatchPage() {
  /* ── State ── */
  const [orders, setOrders] = useState<Order[]>([])
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [orderCoords, setOrderCoords] = useState<Record<string, LatLng>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedDriverMap, setSelectedDriverMap] = useState<Record<string, string>>({})
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<"unassigned" | "active" | "drivers">("unassigned")

  const [sidebarOpen, setSidebarOpen] = useState(false)

  /* ── Map refs ── */
  const mapElRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const orderMarkersMap = useRef(new Map<string, google.maps.Marker>())
  const driverMarkersMap = useRef(new Map<string, google.maps.Marker>())
  const clustererRef = useRef<MarkerClusterer | null>(null)
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null)
  const boundsSetRef = useRef(false)

  /* latest data refs (for InfoWindow content) */
  const ordersRef = useRef(orders)
  ordersRef.current = orders
  const driversRef = useRef(drivers)
  driversRef.current = drivers

  /* ── 1. Real-time Firestore subscriptions ── */
  useEffect(() => {
    let ordersLoaded = false
    let driversLoaded = false

    const unsub1 = subscribeOrdersRealtime((data) => {
      setOrders(data)
      ordersLoaded = true
      if (driversLoaded) setIsLoading(false)
    })
    const unsub2 = subscribeDriversRealtime((data) => {
      setDrivers(data)
      driversLoaded = true
      if (ordersLoaded) setIsLoading(false)
    })

    return () => {
      unsub1()
      unsub2()
    }
  }, [])

  /* ── 2. Geocode order addresses (only re-run when addresses change) ── */
  const addressKey = useMemo(
    () =>
      orders
        .map((o) => `${o.id}:${o.address}`)
        .sort()
        .join("|"),
    [orders],
  )

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const results = await Promise.all(
        orders.map(async (o) => ({ id: o.id, c: await geocodeAddress(o.address) })),
      )
      if (cancelled) return
      const next: Record<string, LatLng> = {}
      results.forEach((r) => {
        if (r.c) next[r.id] = r.c
      })
      setOrderCoords(next)
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addressKey])

  /* ── Derived data ── */
  const availableDrivers = useMemo(() => drivers.filter((d) => d.status === "available"), [drivers])

  const unassigned = useMemo(() => orders.filter((o) => o.status === "unassigned"), [orders])

  const activeOrders = useMemo(
    () =>
      orders.filter(
        (o) =>
          o.assignedDriver &&
          !["unassigned", "delivered", "failed", "cancelled"].includes(o.status),
      ),
    [orders],
  )

  const deliveredOrders = useMemo(() => orders.filter((o) => o.status === "delivered"), [orders])

  const driversWithLocation = useMemo(() => drivers.filter((d) => d.lastLocation), [drivers])

  /* search helper */
  const applySearch = useCallback(
    (list: Order[]) => {
      const q = searchTerm.trim().toLowerCase()
      if (!q) return list
      return list.filter(
        (o) =>
          o.orderNumber.toLowerCase().includes(q) ||
          o.customerName.toLowerCase().includes(q) ||
          o.address.toLowerCase().includes(q),
      )
    },
    [searchTerm],
  )

  /* ── 3. Init Google Map ── */
  useEffect(() => {
    if (isLoading) return
    let mounted = true

    ;(async () => {
      if (!mapElRef.current || mapRef.current) return
      await loadGoogleMaps()
      if (!mounted || !mapElRef.current) return

      const map = new google.maps.Map(mapElRef.current, {
        center: LAGOS,
        zoom: 11,
        disableDefaultUI: false,
        zoomControl: true,
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: true,
      })
      mapRef.current = map
      infoWindowRef.current = new google.maps.InfoWindow()
      clustererRef.current = new MarkerClusterer({ map, markers: [] })
    })()

    return () => {
      mounted = false
      orderMarkersMap.current.forEach((m) => m.setMap(null))
      orderMarkersMap.current.clear()
      driverMarkersMap.current.forEach((m) => m.setMap(null))
      driverMarkersMap.current.clear()
      if (clustererRef.current) {
        clustererRef.current.clearMarkers()
        clustererRef.current = null
      }
      infoWindowRef.current = null
      mapRef.current = null
      boundsSetRef.current = false
    }
  }, [isLoading])

  /* ── 4. Sync markers (efficient — only update changed) ── */
  useEffect(() => {
    const map = mapRef.current
    const cl = clustererRef.current
    if (!map || !cl) return

    const bounds = new google.maps.LatLngBounds()
    let pts = false

    /* ─ Order markers ─ */
    const shown = orders.filter((o) => !["failed", "cancelled"].includes(o.status))
    const liveIds = new Set<string>()

    shown.forEach((order) => {
      const coords = orderCoords[order.id]
      if (!coords) return
      liveIds.add(order.id)

      const color = orderColor(order.status)
      const existing = orderMarkersMap.current.get(order.id)

      if (existing) {
        const p = existing.getPosition()
        if (p && (p.lat() !== coords.lat || p.lng() !== coords.lng)) {
          existing.setPosition(coords)
        }
        existing.setIcon(makeOrderIcon(color))
        existing.setTitle(`${order.orderNumber} – ${order.customerName}`)
      } else {
        const m = new google.maps.Marker({
          position: coords,
          title: `${order.orderNumber} – ${order.customerName}`,
          icon: makeOrderIcon(color),
        })
        m.addListener("click", () => {
          const latest = ordersRef.current.find((o) => o.id === order.id)
          if (!latest || !infoWindowRef.current) return
          infoWindowRef.current.setContent(
            `<div style="min-width:200px;font-family:system-ui,sans-serif;padding:4px">
              <p style="margin:0 0 4px;font-size:14px;font-weight:600">${latest.orderNumber}</p>
              <p style="margin:0 0 2px;font-size:12px">Customer: ${latest.customerName}</p>
              <p style="margin:0 0 2px;font-size:12px">Order ID: ${latest.id}</p>
              <p style="margin:0 0 2px;font-size:12px">Status: <b style="color:${orderColor(latest.status)}">${statusLabel(latest.status)}</b></p>
              <p style="margin:0;font-size:11px;color:#666">${latest.address}</p>
            </div>`,
          )
          infoWindowRef.current.open(map, m)
        })
        orderMarkersMap.current.set(order.id, m)
        cl.addMarker(m)
      }
      bounds.extend(coords)
      pts = true
    })

    /* Remove stale order markers */
    orderMarkersMap.current.forEach((m, id) => {
      if (!liveIds.has(id)) {
        cl.removeMarker(m)
        m.setMap(null)
        orderMarkersMap.current.delete(id)
      }
    })

    /* ─ Driver markers (NOT clustered) ─ */
    const liveDriverIds = new Set<string>()
    const driverIcon = makeDriverIcon()

    drivers.forEach((d) => {
      if (!d.lastLocation) return
      liveDriverIds.add(d.id)

      const pos = { lat: d.lastLocation.lat, lng: d.lastLocation.lng }
      const existing = driverMarkersMap.current.get(d.id)

      if (existing) {
        const p = existing.getPosition()
        if (p && (p.lat() !== pos.lat || p.lng() !== pos.lng)) {
          existing.setPosition(pos)
        }
      } else {
        const m = new google.maps.Marker({
          map,
          position: pos,
          title: d.name,
          icon: driverIcon,
          zIndex: 1000,
        })
        m.addListener("click", () => {
          const latest = driversRef.current.find((dr) => dr.id === d.id)
          if (!latest || !infoWindowRef.current) return
          infoWindowRef.current.setContent(
            `<div style="min-width:180px;font-family:system-ui,sans-serif;padding:4px">
              <p style="margin:0 0 4px;font-size:14px;font-weight:600">${latest.name}</p>
              <p style="margin:0 0 2px;font-size:12px">Status: <b>${driverStatusLabel(latest.status)}</b></p>
              <p style="margin:0;font-size:11px;color:#666">Vehicle: ${latest.vehicle}</p>
            </div>`,
          )
          infoWindowRef.current.open(map, m)
        })
        driverMarkersMap.current.set(d.id, m)
      }
      bounds.extend(pos)
      pts = true
    })

    /* Remove stale driver markers */
    driverMarkersMap.current.forEach((m, id) => {
      if (!liveDriverIds.has(id)) {
        m.setMap(null)
        driverMarkersMap.current.delete(id)
      }
    })

    /* Auto-fit bounds on first meaningful data */
    if (pts && !boundsSetRef.current) {
      map.fitBounds(bounds, 50)
      boundsSetRef.current = true
    }
  }, [orders, drivers, orderCoords])

  /* ── Dispatch handler ── */
  async function handleDispatch(orderId: string, driverId?: string) {
    const did = driverId ?? selectedDriverMap[orderId]
    if (!did) return
    try {
      setIsSaving(true)
      const startedAt = new Date()
      const target = orders.find((o) => o.id === orderId)
      await updateOrder(orderId, { assignedDriver: did, status: "started", startedAt })
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId ? { ...o, assignedDriver: did, status: "started", startedAt } : o,
        ),
      )
      setSelectedDriverMap((p) => {
        const n = { ...p }
        delete n[orderId]
        return n
      })
      if (target) {
        const driverObj = drivers.find((d) => d.id === did)
        notifyOrderEvent("order_accepted", {
          orderId: target.id,
          orderNumber: target.orderNumber,
          customerName: target.customerName,
          customerPhone: target.phone,
          customerEmail: target.customerEmail,
          address: target.address,
          driverName: driverObj?.name,
          items: target.items,
        })
      }
    } catch {
      setError("Failed to dispatch order")
    } finally {
      setIsSaving(false)
    }
  }

  /* ── Focus helpers ── */
  function focusOnMap(lat: number, lng: number) {
    if (!mapRef.current) return
    mapRef.current.panTo({ lat, lng })
    mapRef.current.setZoom(15)
    setSidebarOpen(false)
  }

  /* ── Loading ── */
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner />
      </div>
    )
  }

  return (
    <div className="relative flex h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* ═══ Sidebar ═══ */}
      <aside
        className={`absolute inset-y-0 left-0 z-20 flex w-[380px] max-w-[85vw] flex-col border-r bg-card shadow-xl transition-transform xl:relative xl:z-auto xl:translate-x-0 xl:shadow-none ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* header */}
        <div className="border-b px-4 py-3">
          <h1 className="text-xl font-semibold text-foreground">Live Dispatch</h1>
          <p className="text-xs text-muted-foreground">Real-time orders &amp; drivers</p>
          {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
        </div>

        {/* stats */}
        <div className="grid grid-cols-4 gap-1 border-b px-3 py-2 text-center text-[11px] font-medium">
          <div className="rounded bg-red-500/10 py-1 text-red-700 dark:text-red-400">
            <div className="text-lg font-bold">{unassigned.length}</div>
            Unassigned
          </div>
          <div className="rounded bg-orange-500/10 py-1 text-orange-700 dark:text-orange-400">
            <div className="text-lg font-bold">{activeOrders.length}</div>
            Active
          </div>
          <div className="rounded bg-green-500/10 py-1 text-green-700 dark:text-green-400">
            <div className="text-lg font-bold">{deliveredOrders.length}</div>
            Delivered
          </div>
          <div className="rounded bg-blue-500/10 py-1 text-blue-700 dark:text-blue-400">
            <div className="text-lg font-bold">{driversWithLocation.length}</div>
            Drivers
          </div>
        </div>

        {/* search */}
        <div className="border-b px-3 py-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search orders…"
              className="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </div>

        {/* tabs */}
        <div className="flex border-b text-sm font-medium">
          {(
            [
              ["unassigned", `Unassigned (${unassigned.length})`],
              ["active", `Active (${activeOrders.length})`],
              ["drivers", `Drivers (${drivers.length})`],
            ] as [typeof tab, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 border-b-2 px-2 py-2.5 transition ${
                tab === key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* tab content */}
        <div className="flex-1 overflow-y-auto p-3">
          {/* ─── Unassigned ─── */}
          {tab === "unassigned" && (
            <div className="space-y-2">
              {applySearch(unassigned).length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">No unassigned orders</p>
              ) : (
                applySearch(unassigned).map((order) => (
                  <div key={order.id} className="rounded-lg border bg-background p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-foreground">{order.orderNumber}</p>
                      <span className="text-sm font-semibold text-foreground">
                        {formatCurrency(order.amount)}
                      </span>
                    </div>
                    <p className="text-sm text-foreground">{order.customerName}</p>
                    <p className="mt-1 flex items-start gap-1 text-xs text-muted-foreground">
                      <MapPin className="mt-0.5 h-3 w-3 shrink-0" /> {order.address}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <Select
                        onValueChange={(val) =>
                          setSelectedDriverMap((p) => ({ ...p, [order.id]: val }))
                        }
                      >
                        <SelectTrigger className="h-8 flex-1 text-xs">
                          <SelectValue placeholder="Select driver" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableDrivers.map((d) => (
                            <SelectItem key={d.id} value={d.id}>
                              {d.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        className="h-8 gap-1"
                        disabled={!selectedDriverMap[order.id] || isSaving}
                        onClick={() => handleDispatch(order.id)}
                      >
                        <Send className="h-3 w-3" /> Dispatch
                      </Button>
                    </div>
                    {orderCoords[order.id] && (
                      <button
                        onClick={() =>
                          focusOnMap(orderCoords[order.id].lat, orderCoords[order.id].lng)
                        }
                        className="mt-1 text-xs text-primary hover:underline"
                      >
                        Show on map →
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* ─── Active ─── */}
          {tab === "active" && (
            <div className="space-y-2">
              {applySearch(activeOrders).length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">No active orders</p>
              ) : (
                applySearch(activeOrders).map((order) => {
                  const driver = drivers.find((d) => d.id === order.assignedDriver)
                  return (
                    <div key={order.id} className="rounded-lg border bg-background p-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-foreground">{order.orderNumber}</p>
                        <Badge
                          variant="outline"
                          className="bg-orange-500/10 text-orange-700 border-orange-200 dark:text-orange-400"
                        >
                          {statusLabel(order.status)}
                        </Badge>
                      </div>
                      <p className="text-sm text-foreground">{order.customerName}</p>
                      <p className="mt-1 flex items-start gap-1 text-xs text-muted-foreground">
                        <MapPin className="mt-0.5 h-3 w-3 shrink-0" /> {order.address}
                      </p>
                      {driver && (
                        <p className="mt-1 text-xs text-blue-600 dark:text-blue-400">
                          Driver: {driver.name}
                        </p>
                      )}
                      <div className="mt-2 flex items-center gap-2">
                        <Select
                          onValueChange={(val) =>
                            setSelectedDriverMap((p) => ({ ...p, [order.id]: val }))
                          }
                        >
                          <SelectTrigger className="h-8 flex-1 text-xs">
                            <SelectValue placeholder="Reassign driver" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableDrivers.map((d) => (
                              <SelectItem key={d.id} value={d.id}>
                                {d.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8"
                          disabled={!selectedDriverMap[order.id] || isSaving}
                          onClick={() => handleDispatch(order.id)}
                        >
                          Reassign
                        </Button>
                      </div>
                      {orderCoords[order.id] && (
                        <button
                          onClick={() =>
                            focusOnMap(orderCoords[order.id].lat, orderCoords[order.id].lng)
                          }
                          className="mt-1 text-xs text-primary hover:underline"
                        >
                          Show on map →
                        </button>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          )}

          {/* ─── Drivers ─── */}
          {tab === "drivers" && (
            <div className="space-y-1">
              {drivers.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">No drivers</p>
              ) : (
                drivers.map((d) => {
                  const count = orders.filter(
                    (o) =>
                      o.assignedDriver === d.id &&
                      !["delivered", "failed", "cancelled", "unassigned"].includes(o.status),
                  ).length
                  return (
                    <button
                      key={d.id}
                      onClick={() =>
                        d.lastLocation &&
                        focusOnMap(d.lastLocation.lat, d.lastLocation.lng)
                      }
                      className="flex w-full items-center justify-between rounded-md border bg-background px-3 py-2 text-left transition hover:bg-secondary/40"
                    >
                      <div className="flex items-center gap-2">
                        <Avatar className="size-8">
                          <AvatarFallback>{getInitials(d.name)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium text-foreground">{d.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {driverStatusLabel(d.status)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={
                            d.status === "available"
                              ? "bg-green-500/10 text-green-700 border-green-200 dark:text-green-400"
                              : d.status === "on-delivery"
                                ? "bg-blue-500/10 text-blue-600 border-blue-200 dark:text-blue-400"
                                : "bg-muted text-muted-foreground"
                          }
                        >
                          {count} orders
                        </Badge>
                        {d.lastLocation && (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          )}
        </div>
      </aside>

      {/* ═══ Map ═══ */}
      <section className="relative h-full flex-1 overflow-hidden">
        {/* Mobile sidebar toggle */}
        <button
          onClick={() => setSidebarOpen((o) => !o)}
          className="absolute left-3 top-3 z-10 rounded-md border bg-white px-3 py-1.5 text-xs font-medium shadow-md xl:hidden dark:bg-card"
        >
          ☰ Orders
        </button>

        {/* Mobile backdrop */}
        {sidebarOpen && (
          <div
            className="absolute inset-0 z-10 bg-black/30 xl:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        <div ref={mapElRef} className="h-full w-full" />

        {/* Legend */}
        <div className="pointer-events-none absolute left-4 top-4 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-white/95 px-3 py-1 shadow">
            <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-red-600" />
            Unassigned
          </span>
          <span className="rounded-full bg-white/95 px-3 py-1 shadow">
            <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-orange-500" />
            Assigned
          </span>
          <span className="rounded-full bg-white/95 px-3 py-1 shadow">
            <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-green-600" />
            Delivered
          </span>
          <span className="rounded-full bg-white/95 px-3 py-1 shadow">
            <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-blue-600" />
            Driver
          </span>
        </div>
      </section>
    </div>
  )
}

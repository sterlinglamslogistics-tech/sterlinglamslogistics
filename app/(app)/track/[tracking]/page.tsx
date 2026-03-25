"use client"

import { useEffect, useMemo, useRef, useState, use } from "react"
import { Phone, MessageSquare, ChevronDown, ChevronUp, MapPin, Package, Clock } from "lucide-react"
import { Spinner } from "@/components/ui/spinner"
import { subscribeDriverRealtime, subscribeOrderByTrackingRealtime } from "@/lib/firestore"
import { formatCurrency } from "@/lib/data"
import type { Driver, Order } from "@/lib/data"

function parseDate(value: unknown): Date | null {
  if (!value) return null
  if (value instanceof Date) return value
  if (typeof value === "object" && value !== null) {
    const maybeObj = value as { toDate?: () => Date; seconds?: number }
    if (typeof maybeObj.toDate === "function") return maybeObj.toDate()
    if (typeof maybeObj.seconds === "number") return new Date(maybeObj.seconds * 1000)
  }
  return null
}

function formatTime(value: unknown) {
  const date = parseDate(value)
  if (!date) return "--"
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date)
}

function formatEta(ms: number) {
  if (ms <= 0) return "Arriving now"
  const total = Math.floor(ms / 1000)
  const hrs = Math.floor(total / 3600)
  const mins = Math.floor((total % 3600) / 60)
  if (hrs > 0) return `${hrs}h ${mins}m`
  return `${mins} mins`
}

function formatEtaTime(ms: number) {
  if (ms <= 0) return null
  return new Intl.DateTimeFormat("en-NG", { timeStyle: "short" }).format(new Date(Date.now() + ms))
}

const STATUS_STEPS: Array<{ label: string }> = [
  { label: "Assigned" },
  { label: "Picked Up" },
  { label: "In Transit" },
  { label: "Delivered" },
]

function getStepIndex(status: Order["status"]) {
  if (status === "delivered") return 4
  if (status === "in-transit") return 3
  if (status === "picked-up") return 2
  if (status === "started") return 1
  return 0
}

function getStatusHeading(status: Order["status"]) {
  const map: Record<Order["status"], string> = {
    unassigned: "Waiting for driver",
    started: "Driver assigned",
    "picked-up": "Order picked up",
    "in-transit": "On the way",
    delivered: "Delivered",
    failed: "Delivery failed",
    cancelled: "Cancelled",
  }
  return map[status]
}

const HUB = {
  lat: Number(process.env.NEXT_PUBLIC_HUB_LAT) || 6.4642667,
  lng: Number(process.env.NEXT_PUBLIC_HUB_LNG) || 3.5554814,
}

const geocodeCache = new Map<string, { lat: number; lng: number }>()

async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  const query = address.trim()
  if (!query) return null

  const cached = geocodeCache.get(query)
  if (cached) return cached

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
    })
    if (!response.ok) return null

    const data = (await response.json()) as Array<{ lat: string; lon: string }>
    if (!data.length) return null

    const lat = Number(data[0].lat)
    const lng = Number(data[0].lon)
    if (Number.isNaN(lat) || Number.isNaN(lng)) return null

    const coords = { lat, lng }
    geocodeCache.set(query, coords)
    return coords
  } catch {
    return null
  }
}

function animateMarkerTo(
  marker: import("leaflet").Marker,
  target: [number, number],
  frameRef: { current: number | null },
  durationMs = 900
) {
  if (frameRef.current !== null) {
    window.cancelAnimationFrame(frameRef.current)
    frameRef.current = null
  }

  const start = marker.getLatLng()
  const fromLat = start.lat
  const fromLng = start.lng
  const toLat = target[0]
  const toLng = target[1]

  if (Math.abs(fromLat - toLat) < 0.000001 && Math.abs(fromLng - toLng) < 0.000001) {
    marker.setLatLng(target)
    return
  }

  const startedAt = performance.now()
  const step = (now: number) => {
    const progress = Math.min((now - startedAt) / durationMs, 1)
    const eased = 1 - Math.pow(1 - progress, 3)
    const lat = fromLat + (toLat - fromLat) * eased
    const lng = fromLng + (toLng - fromLng) * eased
    marker.setLatLng([lat, lng])

    if (progress < 1) {
      frameRef.current = window.requestAnimationFrame(step)
      return
    }

    frameRef.current = null
  }

  frameRef.current = window.requestAnimationFrame(step)
}

export default function TrackingPage({ params }: { params: Promise<{ tracking: string }> }) {
  const { tracking } = use(params)
  const [order, setOrder] = useState<Order | null>(null)
  const [driver, setDriver] = useState<Driver | null>(null)
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState(() => Date.now())
  const [destinationCoord, setDestinationCoord] = useState<{ lat: number; lng: number } | null>(null)
  const [updatesOpen, setUpdatesOpen] = useState(false)
  const [orderOpen, setOrderOpen] = useState(false)
  const [liveRoute, setLiveRoute] = useState<{ distanceKm: number; durationMs: number; fetchedAt: number } | null>(null)

  const activeDriverSubscriptionRef = useRef<(() => void) | null>(null)
  const activeDriverIdRef = useRef<string | null>(null)
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<import("leaflet").Map | null>(null)
  const driverMarkerRef = useRef<import("leaflet").Marker | null>(null)
  const destinationMarkerRef = useRef<import("leaflet").Marker | null>(null)
  const routeLineRef = useRef<import("leaflet").Polyline | null>(null)
  const driverAnimFrameRef = useRef<number | null>(null)
  const destinationAnimFrameRef = useRef<number | null>(null)

  useEffect(() => {
    setLoading(true)

    const unsubscribeOrder = subscribeOrderByTrackingRealtime(tracking, (foundOrder) => {
      setOrder(foundOrder)

      const nextDriverId = foundOrder?.assignedDriver ?? null
      if (!nextDriverId) {
        if (activeDriverSubscriptionRef.current) {
          activeDriverSubscriptionRef.current()
          activeDriverSubscriptionRef.current = null
          activeDriverIdRef.current = null
        }
        setDriver(null)
        setLoading(false)
        return
      }

      if (activeDriverIdRef.current === nextDriverId) {
        setLoading(false)
        return
      }

      if (activeDriverSubscriptionRef.current) {
        activeDriverSubscriptionRef.current()
      }

      activeDriverIdRef.current = nextDriverId
      activeDriverSubscriptionRef.current = subscribeDriverRealtime(nextDriverId, (foundDriver) => {
        setDriver(foundDriver)
        setLoading(false)
      })
    })

    return () => {
      unsubscribeOrder()
      if (activeDriverSubscriptionRef.current) {
        activeDriverSubscriptionRef.current()
        activeDriverSubscriptionRef.current = null
      }
      activeDriverIdRef.current = null
    }
  }, [tracking])

  useEffect(() => {
    let cancelled = false

    async function resolveDestination() {
      if (!order?.address) {
        setDestinationCoord(null)
        return
      }

      const coords = await geocodeAddress(order.address)
      if (!cancelled) {
        setDestinationCoord(coords)
      }
    }

    resolveDestination()

    return () => {
      cancelled = true
    }
  }, [order?.address])

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const etaMs = useMemo(() => {
    if (!order || order.status === "delivered") return 0
    // Use OSRM road-network duration (ticks down from when it was last fetched)
    if (liveRoute) {
      const elapsed = now - liveRoute.fetchedAt
      return Math.max(0, liveRoute.durationMs - elapsed)
    }
    // Fallback: estimate from stored distanceKm at avg 25 km/h
    const distance = typeof order.distanceKm === "number" ? order.distanceKm : 8
    const durationMs = (distance / 25) * 3600 * 1000
    const started = parseDate(order.inTransitAt) ?? parseDate(order.pickedUpAt) ?? parseDate(order.startedAt)
    const base = started ? started.getTime() : Date.now()
    return base + durationMs - now
  }, [order, liveRoute, now])

  useEffect(() => {
    if (loading) return

    let mounted = true

    async function initMap() {
      if (!mapContainerRef.current || mapRef.current) return

      const L = await import("leaflet")
      if (!mounted || !mapContainerRef.current) return

      const map = L.map(mapContainerRef.current, {
        zoomControl: false,
      }).setView([HUB.lat, HUB.lng], 13)

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map)

      L.control.zoom({ position: "bottomright" }).addTo(map)
      mapRef.current = map
      window.requestAnimationFrame(() => map.invalidateSize())
    }

    initMap()

    return () => {
      mounted = false
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
      if (driverAnimFrameRef.current !== null) {
        window.cancelAnimationFrame(driverAnimFrameRef.current)
        driverAnimFrameRef.current = null
      }
      if (destinationAnimFrameRef.current !== null) {
        window.cancelAnimationFrame(destinationAnimFrameRef.current)
        destinationAnimFrameRef.current = null
      }
      driverMarkerRef.current = null
      destinationMarkerRef.current = null
      routeLineRef.current = null
    }
  }, [loading])

  useEffect(() => {
    let cancelled = false

    async function renderMapData() {
      const map = mapRef.current
      if (!map) return

      const L = await import("leaflet")
      if (cancelled) return

      if (routeLineRef.current) {
        map.removeLayer(routeLineRef.current)
        routeLineRef.current = null
      }

      const points: Array<[number, number]> = []

      if (driver?.lastLocation) {
        const point: [number, number] = [driver.lastLocation.lat, driver.lastLocation.lng]
        points.push(point)
        if (!driverMarkerRef.current) {
          const driverIcon = L.divIcon({
            className: "",
            html: `<div style="width:44px;height:44px;background:#1a1a2e;border-radius:9999px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 10px rgba(0,0,0,0.4);border:3px solid #fff;"><svg xmlns='http://www.w3.org/2000/svg' width='22' height='22' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'/><polyline points='9 22 9 12 15 12 15 22'/></svg></div>`,
            iconSize: [44, 44],
            iconAnchor: [22, 22],
          })
          driverMarkerRef.current = L.marker(point, { icon: driverIcon })
            .bindPopup(`<strong>${driver.name}</strong><br/>Driver location`)
            .addTo(map)
        } else {
          driverMarkerRef.current.setPopupContent(`<strong>${driver.name}</strong><br/>Driver location`)
          animateMarkerTo(driverMarkerRef.current, point, driverAnimFrameRef)
        }
      } else if (driverMarkerRef.current) {
        if (driverAnimFrameRef.current !== null) {
          window.cancelAnimationFrame(driverAnimFrameRef.current)
          driverAnimFrameRef.current = null
        }
        map.removeLayer(driverMarkerRef.current)
        driverMarkerRef.current = null
      }

      if (destinationCoord) {
        const point: [number, number] = [destinationCoord.lat, destinationCoord.lng]
        points.push(point)
        if (!destinationMarkerRef.current) {
          const destinationIcon = L.divIcon({
            className: "",
            html: `<div style="width:36px;height:46px;display:flex;flex-direction:column;align-items:center;">
  <div style="width:36px;height:36px;background:#1a1a2e;border-radius:9999px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 10px rgba(0,0,0,0.4);border:3px solid #fff;">
    <svg xmlns='http://www.w3.org/2000/svg' width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'>
      <path d='M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z'/>
      <circle cx='12' cy='10' r='3'/>
    </svg>
  </div>
  <div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:10px solid #1a1a2e;margin-top:-2px;"></div>
</div>`,
            iconSize: [36, 46],
            iconAnchor: [18, 46],
          })
          destinationMarkerRef.current = L.marker(point, { icon: destinationIcon })
            .bindPopup("<strong>Delivery destination</strong>")
            .addTo(map)
        } else {
          destinationMarkerRef.current.setPopupContent("<strong>Delivery destination</strong>")
          animateMarkerTo(destinationMarkerRef.current, point, destinationAnimFrameRef)
        }
      } else if (destinationMarkerRef.current) {
        if (destinationAnimFrameRef.current !== null) {
          window.cancelAnimationFrame(destinationAnimFrameRef.current)
          destinationAnimFrameRef.current = null
        }
        map.removeLayer(destinationMarkerRef.current)
        destinationMarkerRef.current = null
      }

      if (driver?.lastLocation && destinationCoord) {
        try {
          const from = `${driver.lastLocation.lng},${driver.lastLocation.lat}`
          const to = `${destinationCoord.lng},${destinationCoord.lat}`
          const osrm = `https://router.project-osrm.org/route/v1/driving/${from};${to}?overview=full&geometries=geojson`
          const res = await fetch(osrm)
          if (res.ok) {
            const data = (await res.json()) as {
              routes?: Array<{
                distance?: number
                duration?: number
                geometry?: { coordinates: Array<[number, number]> }
              }>
            }
            const route = data.routes?.[0]
            const coords = route?.geometry?.coordinates
            if (coords && coords.length > 1) {
              const latLngs: Array<[number, number]> = coords.map(([lng, lat]) => [lat, lng])
              routeLineRef.current = L.polyline(latLngs, {
                color: "#374151",
                weight: 5,
                opacity: 0.75,
              }).addTo(map)
            }
            if (!cancelled && typeof route?.distance === "number" && typeof route?.duration === "number") {
              setLiveRoute({
                distanceKm: route.distance / 1000,
                durationMs: route.duration * 1000,
                fetchedAt: Date.now(),
              })
            }
          }
        } catch {
          // Keep markers visible even if OSRM fails.
        }
      } else {
        // No route possible — clear stale live-route data
        if (!cancelled) setLiveRoute(null)
      }

      if (points.length > 1) {
        map.fitBounds(L.latLngBounds(points), { padding: [24, 24] })
      } else if (points.length === 1) {
        map.setView(points[0], 14)
      } else {
        map.setView([HUB.lat, HUB.lng], 13)
      }

      window.requestAnimationFrame(() => map.invalidateSize())
    }

    renderMapData()

    return () => {
      cancelled = true
    }
  }, [destinationCoord, driver])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner />
      </div>
    )
  }

  if (!order) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 px-4">
        <Package className="h-12 w-12 text-muted-foreground" />
        <p className="text-lg font-semibold">Order not found</p>
        <p className="text-sm text-muted-foreground">Tracking code: {tracking}</p>
      </div>
    )
  }

  const stepIndex = getStepIndex(order.status)
  const etaTime = formatEtaTime(etaMs)
  const isActive = order.status !== "delivered" && order.status !== "cancelled" && order.status !== "failed"

  return (
    <div className="grid h-screen xl:grid-cols-[420px_minmax(0,1fr)]" style={{ minHeight: "100dvh" }}>
      {/* ── Left panel ── */}
      <aside className="flex h-full flex-col overflow-y-auto border-r bg-background">
        {/* Branding */}
        <div className="border-b px-6 py-4">
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Powered by Sterlinglams Logistics</p>
        </div>

        {/* Status + ETA */}
        <div className="border-b px-6 py-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xl font-semibold text-foreground">{getStatusHeading(order.status)}</p>
              {isActive && etaTime && (
                <p className="mt-0.5 text-sm text-muted-foreground">Est. arrival at {etaTime}</p>
              )}
              {order.status === "delivered" && (
                <p className="mt-0.5 text-sm text-muted-foreground">Delivered on {formatTime(order.deliveredAt)}</p>
              )}
            </div>
            {isActive && etaMs > 0 && (
              <div className="flex flex-col items-end gap-0.5">
                <div className="shrink-0 rounded-full border bg-secondary px-4 py-2 text-sm font-semibold text-foreground">
                  {formatEta(etaMs)}
                </div>
                {liveRoute && (
                  <p className="text-[11px] text-muted-foreground">
                    {liveRoute.distanceKm.toFixed(1)} km away
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Progress bar */}
          <div className="mt-5 flex items-start">
            {STATUS_STEPS.map((step, i) => {
              const done = stepIndex > i + 1
              const active = stepIndex === i + 1
              const isLast = i === STATUS_STEPS.length - 1
              return (
                <div key={step.label} className="flex flex-1 flex-col items-center">
                  <div className="flex w-full items-center">
                    {i > 0 && (
                      <div className={`h-1 flex-1 ${done || active ? "bg-green-500" : "bg-muted"}`} />
                    )}
                    <div
                      className={`h-3 w-3 shrink-0 rounded-full border-2 ${
                        done
                          ? "border-green-500 bg-green-500"
                          : active
                          ? "border-green-500 bg-white"
                          : "border-muted bg-muted"
                      }`}
                    />
                    {!isLast && (
                      <div className={`h-1 flex-1 ${done ? "bg-green-500" : "bg-muted"}`} />
                    )}
                  </div>
                  <p className={`mt-1 text-[10px] ${active || done ? "font-medium text-green-600" : "text-muted-foreground"}`}>
                    {step.label}
                  </p>
                </div>
              )
            })}
          </div>
        </div>

        {/* Driver card */}
        <div className="border-b px-6 py-4">
          {driver ? (
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
                {driver.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-foreground">{driver.name}</p>
                <p className="text-xs text-muted-foreground">Your driver</p>
              </div>
              <div className="flex gap-2">
                {driver.phone && (
                  <a
                    href={`tel:${driver.phone}`}
                    className="flex h-9 w-9 items-center justify-center rounded-full border bg-secondary text-foreground hover:bg-muted"
                    aria-label="Call driver"
                  >
                    <Phone className="h-4 w-4" />
                  </a>
                )}
                <button
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-full border bg-secondary text-foreground hover:bg-muted"
                  aria-label="Message driver"
                >
                  <MessageSquare className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No driver assigned yet</p>
          )}
        </div>

        {/* Updates section */}
        <div className="border-b">
          <button
            type="button"
            className="flex w-full items-center justify-between px-6 py-4 text-left text-sm font-semibold text-foreground hover:bg-secondary/40"
            onClick={() => setUpdatesOpen((prev) => !prev)}
          >
            Updates
            {updatesOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>
          {updatesOpen && (
            <div className="space-y-2 px-6 pb-4 text-sm">
              <div className="flex items-start gap-3">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div>
                  <p className="font-medium text-foreground">{getStatusHeading(order.status)}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatTime(order.inTransitAt ?? order.pickedUpAt ?? order.startedAt ?? order.createdAt)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Order details */}
        <div className="border-b">
          <button
            type="button"
            className="flex w-full items-center justify-between px-6 py-4 text-left text-sm font-semibold text-foreground hover:bg-secondary/40"
            onClick={() => setOrderOpen((prev) => !prev)}
          >
            Order {order.orderNumber}
            {orderOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>
          {orderOpen && (
            <div className="space-y-2 px-6 pb-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Customer</span>
                <span className="font-medium">{order.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Phone</span>
                <span className="font-medium">{order.phone ?? "--"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-medium">{formatCurrency(order.amount)}</span>
              </div>
              {typeof order.distanceKm === "number" && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Distance</span>
                  <span className="font-medium">{order.distanceKm.toFixed(2)} km</span>
                </div>
              )}
              <div className="pt-1">
                <p className="text-muted-foreground">Delivery address</p>
                <p className="mt-0.5 flex items-start gap-1 font-medium">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  {order.address}
                </p>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* ── Map ── */}
      <section className="relative h-screen">
        <div ref={mapContainerRef} className="h-full w-full" />
      </section>
    </div>
  )
}

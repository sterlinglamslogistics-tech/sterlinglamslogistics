"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Spinner } from "@/components/ui/spinner"
import { Search } from "lucide-react"
import { subscribeDriversRealtime, subscribeOrdersRealtime } from "@/lib/firestore"
import { loadGoogleMaps } from "@/lib/google-maps"
import { useAuth } from "@/components/auth-provider"
import type { Driver, Order } from "@/lib/data"

type LatLng = { lat: number; lng: number }

const LAGOS_CENTER: LatLng = { lat: 6.5244, lng: 3.3792 }

const HUB: LatLng = {
  lat: Number(process.env.NEXT_PUBLIC_HUB_LAT) || 6.4642667,
  lng: Number(process.env.NEXT_PUBLIC_HUB_LNG) || 3.5554814,
}

export default function RoutesPage() {
  const { user } = useAuth()
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [orderCoords, setOrderCoords] = useState<Record<string, LatLng>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")

  const firstOrdersLoadedRef = useRef(false)
  const firstDriversLoadedRef = useRef(false)

  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const orderMarkersRef = useRef<google.maps.Marker[]>([])
  const driverMarkersMapRef = useRef<Map<string, google.maps.Marker>>(new Map())
  const hubMarkerRef = useRef<google.maps.Marker | null>(null)
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null)
  const orderInfoWindowRef = useRef<google.maps.InfoWindow | null>(null)

  useEffect(() => {
    if (!user) return

    const unsubscribeOrders = subscribeOrdersRealtime((orderData) => {
      setOrders(orderData)
      firstOrdersLoadedRef.current = true
      if (firstDriversLoadedRef.current) setIsLoading(false)
    })

    const unsubscribeDrivers = subscribeDriversRealtime((driverData) => {
      setDrivers(driverData)
      firstDriversLoadedRef.current = true
      if (firstOrdersLoadedRef.current) setIsLoading(false)
    })

    return () => {
      unsubscribeOrders()
      unsubscribeDrivers()
    }
  }, [user])

  const visibleOrders = useMemo(
    () => orders.filter((o) => o.status !== "delivered" && o.status !== "cancelled"),
    [orders]
  )

  const activeDrivers = useMemo(
    () => drivers.filter((d) => d.status !== "offline" && d.lastLocation),
    [drivers]
  )

  const filteredOrders = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    if (!q) return visibleOrders
    return visibleOrders.filter(
      (o) =>
        o.orderNumber.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        o.address.toLowerCase().includes(q)
    )
  }, [searchTerm, visibleOrders])

  const unassignedOrders = useMemo(() => filteredOrders.filter((o) => !o.assignedDriver), [filteredOrders])
  const assignedOrders = useMemo(() => filteredOrders.filter((o) => Boolean(o.assignedDriver)), [filteredOrders])

  // Geocode order addresses – use stored lat/lng instantly, only geocode missing ones
  const jsGeocoderRef = useRef<google.maps.Geocoder | null>(null)
  const jsGeocachRef = useRef<Map<string, LatLng>>(new Map())

  useEffect(() => {
    let cancelled = false

    // Phase 1: Instantly use any orders that already have lat/lng from Firestore
    const instant: Record<string, LatLng> = {}
    const needsGeocode: Order[] = []

    for (const order of visibleOrders) {
      if (typeof order.lat === "number" && typeof order.lng === "number") {
        instant[order.id] = { lat: order.lat, lng: order.lng }
      } else if (order.address?.trim()) {
        const cacheKey = order.address.trim().toLowerCase()
        const cached = jsGeocachRef.current.get(cacheKey)
        if (cached) {
          instant[order.id] = cached
        } else {
          needsGeocode.push(order)
        }
      }
    }

    // Show stored coords immediately
    if (Object.keys(instant).length > 0) {
      setOrderCoords((prev) => ({ ...prev, ...instant }))
    }

    // Phase 2: Geocode missing ones in parallel batches and save coords to Firestore
    if (needsGeocode.length === 0) return

    async function geocodeMissing() {
      await loadGoogleMaps()
      if (!jsGeocoderRef.current) {
        jsGeocoderRef.current = new google.maps.Geocoder()
      }
      const geocoder = jsGeocoderRef.current
      const cache = jsGeocachRef.current
      const BATCH_SIZE = 10
      const newCoords: Record<string, LatLng> = {}

      for (let i = 0; i < needsGeocode.length; i += BATCH_SIZE) {
        if (cancelled) break
        const batch = needsGeocode.slice(i, i + BATCH_SIZE)

        const results = await Promise.allSettled(
          batch.map((order) =>
            new Promise<{ id: string; coords: LatLng | null }>((resolve) => {
              const addr = order.address!.trim()
              geocoder.geocode(
                { address: `${addr}, Lagos, Nigeria`, region: "NG" },
                (results, status) => {
                  if (status === google.maps.GeocoderStatus.OK && results?.[0]) {
                    const loc = results[0].geometry.location
                    resolve({ id: order.id, coords: { lat: loc.lat(), lng: loc.lng() } })
                  } else {
                    resolve({ id: order.id, coords: null })
                  }
                }
              )
            })
          )
        )

        if (cancelled) break

        const batchCoords: Record<string, LatLng> = {}
        for (const r of results) {
          if (r.status === "fulfilled" && r.value.coords) {
            const { id, coords } = r.value
            const order = needsGeocode.find((o) => o.id === id)
            if (order) cache.set(order.address!.trim().toLowerCase(), coords)
            batchCoords[id] = coords
            newCoords[id] = coords
          }
        }

        // Update map progressively after each batch
        if (Object.keys(batchCoords).length > 0) {
          setOrderCoords((prev) => ({ ...prev, ...batchCoords }))
        }
      }

      // Save geocoded coords to Firestore in background so next load is instant
      if (!cancelled) {
        const { updateDoc, doc } = await import("firebase/firestore")
        const { db } = await import("@/lib/firebase")
        if (db) {
          for (const [orderId, coords] of Object.entries(newCoords)) {
            try {
              await updateDoc(doc(db, "orders", orderId), { lat: coords.lat, lng: coords.lng })
            } catch { /* non-critical */ }
          }
        }
      }
    }

    geocodeMissing()
    return () => { cancelled = true }
  }, [visibleOrders])

  useEffect(() => {
    if (!visibleOrders.length) { setSelectedOrderId(null); return }
    const next =
      visibleOrders.find((o) => o.assignedDriver && orderCoords[o.id]) ??
      visibleOrders.find((o) => orderCoords[o.id]) ??
      visibleOrders[0]
    setSelectedOrderId((cur) => (cur && visibleOrders.some((o) => o.id === cur) ? cur : next.id))
  }, [visibleOrders, orderCoords])

  const selectedOrder = useMemo(() => visibleOrders.find((o) => o.id === selectedOrderId) ?? null, [selectedOrderId, visibleOrders])
  const selectedDriver = useMemo(() => {
    if (!selectedOrder?.assignedDriver) return null
    return drivers.find((d) => d.id === selectedOrder.assignedDriver) ?? null
  }, [drivers, selectedOrder])
  const selectedDestination = selectedOrder ? orderCoords[selectedOrder.id] : null

  // ── Helper: build filled‑circle SVG marker with single-line label ──
  function makeLabeledMarkerIcon(
    bgColor: string,
    label: string,
    size: number = 42,
    fontSize: number = 10,
  ): google.maps.Icon {
    const half = size / 2
    const r = half - 4
    const escaped = label.replace(/&/g, "&amp;").replace(/</g, "&lt;")
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
      <defs>
        <filter id="s" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1" stdDeviation="2" flood-opacity="0.3"/>
        </filter>
      </defs>
      <circle cx="${half}" cy="${half}" r="${r}" fill="${bgColor}" stroke="white" stroke-width="3" filter="url(%23s)"/>
      <text x="${half}" y="${half + 1}" text-anchor="middle" dominant-baseline="central"
        font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif" font-weight="700" font-size="${fontSize}" fill="white" letter-spacing="0.2">${escaped}</text>
    </svg>`
    return {
      url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
      scaledSize: new google.maps.Size(size, size),
      anchor: new google.maps.Point(half, half),
    }
  }

  // ── Helper: build two-line date marker (month + day) ──
  function makeDateMarkerIcon(
    bgColor: string,
    month: string,
    day: string,
    size: number = 48,
    isSelected: boolean = false,
  ): google.maps.Icon {
    const half = size / 2
    const r = half - 3
    const strokeW = isSelected ? 3.5 : 2.5
    const monthSize = Math.round(size * 0.22)
    const daySize = Math.round(size * 0.32)
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
      <defs>
        <filter id="ds" x="-30%" y="-20%" width="160%" height="160%">
          <feDropShadow dx="0" dy="1.5" stdDeviation="2.5" flood-opacity="0.35"/>
        </filter>
      </defs>
      <circle cx="${half}" cy="${half}" r="${r}" fill="${bgColor}" stroke="white" stroke-width="${strokeW}" filter="url(%23ds)"/>
      <text x="${half}" y="${half - daySize * 0.32}" text-anchor="middle" dominant-baseline="central"
        font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif" font-weight="600" font-size="${monthSize}" fill="white" opacity="0.95">${month}</text>
      <text x="${half}" y="${half + monthSize * 0.55}" text-anchor="middle" dominant-baseline="central"
        font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif" font-weight="800" font-size="${daySize}" fill="white">${day}</text>
    </svg>`
    return {
      url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
      scaledSize: new google.maps.Size(size, size),
      anchor: new google.maps.Point(half, half),
    }
  }

  function formatShortDate(date: unknown): string {
    if (!date) return ""
    const d = date instanceof Date ? date : new Date(date as string)
    if (Number.isNaN(d.getTime())) return ""
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  }

  function formatShortTime(date: unknown): string {
    if (!date) return ""
    const d = date instanceof Date ? date : new Date(date as string)
    if (Number.isNaN(d.getTime())) return ""
    const t = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
    return t.replace("AM", "a").replace("PM", "p").replace(" ", " ")
  }

  function getDateParts(date: unknown): { month: string; day: string; time: string; isToday: boolean } {
    const todayStr = new Date().toDateString()
    if (!date) return { month: "", day: "", time: "", isToday: false }
    const d = date instanceof Date ? date : new Date(date as string)
    if (Number.isNaN(d.getTime())) return { month: "", day: "", time: "", isToday: false }
    const month = d.toLocaleDateString("en-US", { month: "short" })
    const day = String(d.getDate())
    const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
      .replace("AM", "a").replace("PM", "p").replace(" ", " ")
    return { month, day, time, isToday: d.toDateString() === todayStr }
  }

  // ── Status → color map (Shipday‑style teal / red) ──
  function orderColor(order: Order): string {
    if (order.status === "in-transit") return "#f97316"  // orange
    if (order.status === "picked-up") return "#8b5cf6"   // purple
    if (order.status === "started" || order.assignedDriver) return "#2dd4bf" // teal (assigned/started)
    return "#ef4444"                                      // red (unassigned)
  }

  // ── Init Google Map ── (re-run when isLoading changes so we catch the container after it mounts)
  useEffect(() => {
    let mounted = true

    async function initMap() {
      if (!mapContainerRef.current || mapRef.current) return
      await loadGoogleMaps()
      if (!mounted || !mapContainerRef.current) return

      const map = new google.maps.Map(mapContainerRef.current, {
        center: LAGOS_CENTER,
        zoom: 11,
        minZoom: 8,
        disableDefaultUI: false,
        zoomControl: true,
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: false,
        styles: [
          { featureType: "poi", stylers: [{ visibility: "off" }] },
          { featureType: "transit", stylers: [{ visibility: "simplified" }] },
        ],
      })
      mapRef.current = map
      orderInfoWindowRef.current = new google.maps.InfoWindow()
    }

    initMap()

    return () => {
      mounted = false
      orderMarkersRef.current.forEach((m) => m.setMap(null))
      orderMarkersRef.current = []
      for (const [, m] of driverMarkersMapRef.current) m.setMap(null)
      driverMarkersMapRef.current.clear()
      if (hubMarkerRef.current) hubMarkerRef.current.setMap(null)
      if (directionsRendererRef.current) directionsRendererRef.current.setMap(null)
      mapRef.current = null
    }
  }, [isLoading])

  // Track whether we've already fit bounds for the current data set
  const hasFitBoundsRef = useRef(false)
  const prevDataKeyRef = useRef("")

  // ── Update order markers + hub + route (Shipday-style) ──
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    // Clear previous order markers + hub + directions
    orderMarkersRef.current.forEach((m) => m.setMap(null))
    orderMarkersRef.current = []
    if (hubMarkerRef.current) { hubMarkerRef.current.setMap(null); hubMarkerRef.current = null }
    if (directionsRendererRef.current) {
      directionsRendererRef.current.setMap(null)
      directionsRendererRef.current = null
    }

    // Detect whether the underlying data changed (not just selection)
    const dataKey = `${visibleOrders.map(o => o.id).join(",")}_${Object.keys(orderCoords).sort().join(",")}`
    const dataChanged = dataKey !== prevDataKeyRef.current
    prevDataKeyRef.current = dataKey
    if (dataChanged) hasFitBoundsRef.current = false

    const bounds = new google.maps.LatLngBounds()
    let hasPoints = false

    // ── Hub marker with order count ──
    hubMarkerRef.current = new google.maps.Marker({
      map,
      position: HUB,
      title: `Store Hub (${visibleOrders.length} orders)`,
      icon: makeLabeledMarkerIcon("#f59e0b", String(visibleOrders.length), 48, 16),
      zIndex: 1000,
    })
    bounds.extend(HUB)
    hasPoints = true

    // ── Order markers: two-line date pins (Mon\nDD) ──
    visibleOrders.forEach((order) => {
      const coords = orderCoords[order.id]
      if (!coords) return

      const isSelected = selectedOrderId === order.id
      const color = orderColor(order)

      const { month, day, time, isToday } = getDateParts(order.createdAt)
      const size = isSelected ? 54 : 46

      // Use two-line date icon for dates, single-line for today's time
      const icon = isToday && time
        ? makeLabeledMarkerIcon(color, time, size, isSelected ? 12 : 10)
        : month && day
          ? makeDateMarkerIcon(color, month, day, size, isSelected)
          : makeLabeledMarkerIcon(color, "New", size, isSelected ? 12 : 10)

      const marker = new google.maps.Marker({
        map,
        position: coords,
        title: `${order.orderNumber} – ${order.customerName}`,
        icon,
        zIndex: isSelected ? 999 : 10,
      })

      marker.addListener("click", () => {
        setSelectedOrderId(order.id)
        const iw = orderInfoWindowRef.current
        if (iw) {
          iw.setContent(`
            <div style="font-family:system-ui;min-width:160px">
              <div style="font-weight:700;font-size:13px;margin-bottom:2px">#${order.orderNumber}</div>
              <div style="font-size:12px;color:#555">${order.customerName}</div>
              <div style="font-size:11px;color:#888;margin-top:4px">${order.address}</div>
              <div style="font-size:11px;margin-top:6px;color:${color};font-weight:600">${order.assignedDriver ? "Assigned" : "Unassigned"} · ${order.status}</div>
            </div>
          `)
          iw.open(map, marker)
        }
      })

      orderMarkersRef.current.push(marker)
      bounds.extend(coords)
      hasPoints = true
    })

    // ── Directions route for selected assigned order ──
    if (selectedDriver?.lastLocation && selectedDestination) {
      const directionsService = new google.maps.DirectionsService()
      const directionsRenderer = new google.maps.DirectionsRenderer({
        map,
        suppressMarkers: true,
        polylineOptions: { strokeColor: "#0ea5e9", strokeWeight: 4, strokeOpacity: 0.9 },
      })
      directionsRendererRef.current = directionsRenderer

      directionsService.route(
        {
          origin: { lat: selectedDriver.lastLocation.lat, lng: selectedDriver.lastLocation.lng },
          destination: selectedDestination,
          travelMode: google.maps.TravelMode.DRIVING,
        },
        (result, status) => {
          if (status === google.maps.DirectionsStatus.OK && result) {
            directionsRenderer.setDirections(result)
          }
        }
      )
    }

    // Only fit bounds when data actually changes, not on selection clicks
    if (!hasFitBoundsRef.current && hasPoints) {
      const lagosBounds = new google.maps.LatLngBounds(
        { lat: 6.35, lng: 3.0 },
        { lat: 6.75, lng: 3.75 },
      )
      const lagosFilteredBounds = new google.maps.LatLngBounds()
      let lagosPoints = 0
      visibleOrders.forEach((order) => {
        const coords = orderCoords[order.id]
        if (!coords) return
        if (lagosBounds.contains(coords)) {
          lagosFilteredBounds.extend(coords)
          lagosPoints++
        }
      })
      // Include driver positions in bounds
      activeDrivers.forEach((driver) => {
        if (!driver.lastLocation) return
        const pos = { lat: driver.lastLocation.lat, lng: driver.lastLocation.lng }
        if (lagosBounds.contains(pos)) {
          lagosFilteredBounds.extend(pos)
          lagosPoints++
        }
      })
      lagosFilteredBounds.extend(HUB)

      if (lagosPoints > 0) {
        map.fitBounds(lagosFilteredBounds, 36)
      } else {
        map.setCenter(LAGOS_CENTER)
        map.setZoom(11)
      }
      hasFitBoundsRef.current = true
    }
  }, [activeDrivers, orderCoords, selectedDestination, selectedDriver, selectedOrderId, visibleOrders])

  // ── Live driver markers — smoothly animate position changes ──
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const currentIds = new Set(activeDrivers.filter((d) => d.lastLocation).map((d) => d.id))

    // Remove markers for drivers who went offline
    for (const [id, marker] of driverMarkersMapRef.current) {
      if (!currentIds.has(id)) {
        marker.setMap(null)
        driverMarkersMapRef.current.delete(id)
      }
    }

    // Add or animate existing driver markers
    activeDrivers.forEach((driver) => {
      if (!driver.lastLocation) return
      const newPos = { lat: driver.lastLocation.lat, lng: driver.lastLocation.lng }
      const existing = driverMarkersMapRef.current.get(driver.id)

      if (existing) {
        // Smoothly animate to new position
        const start = existing.getPosition()!
        const end = new google.maps.LatLng(newPos.lat, newPos.lng)
        const steps = 30
        const duration = 1000
        const stepMs = duration / steps
        let step = 0
        const animate = () => {
          step++
          const t = step / steps
          const lat = start.lat() + (end.lat() - start.lat()) * t
          const lng = start.lng() + (end.lng() - start.lng()) * t
          existing.setPosition({ lat, lng })
          if (step < steps) setTimeout(animate, stepMs)
        }
        animate()
        // Update icon (selection state may have changed)
        const isSelectedDrv = Boolean(selectedDriver && selectedDriver.id === driver.id)
        const size = isSelectedDrv ? 48 : 42
        existing.setIcon(makeLabeledMarkerIcon("#3b82f6", driver.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase(), size, isSelectedDrv ? 12 : 10))
        existing.setZIndex(isSelectedDrv ? 998 : 20)
      } else {
        // Create new marker for this driver
        const isSelectedDrv = Boolean(selectedDriver && selectedDriver.id === driver.id)
        const size = isSelectedDrv ? 48 : 42

        const marker = new google.maps.Marker({
          map,
          position: newPos,
          title: driver.name,
          icon: makeLabeledMarkerIcon("#3b82f6", driver.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase(), size, isSelectedDrv ? 12 : 10),
          zIndex: isSelectedDrv ? 998 : 20,
        })

        marker.addListener("click", () => {
          const iw = orderInfoWindowRef.current
          if (iw) {
            iw.setContent(`
              <div style="font-family:system-ui;min-width:140px">
                <div style="font-weight:700;font-size:13px">${driver.name}</div>
                <div style="font-size:12px;color:#555">${driver.phone ?? ""}</div>
                <div style="font-size:11px;color:#3b82f6;font-weight:600;margin-top:4px">${driver.status}</div>
              </div>
            `)
            iw.open(map, marker)
          }
        })

        driverMarkersMapRef.current.set(driver.id, marker)
      }
    })
  }, [activeDrivers, selectedDriver])

  const focusOrderOnMap = (order: Order) => {
    setSelectedOrderId(order.id)
    const map = mapRef.current
    const coords = orderCoords[order.id]
    if (!map || !coords) return
    map.panTo(coords)
    map.setZoom(14)
  }

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner />
      </div>
    )
  }

  return (
    <div className="grid h-[calc(100vh-3.5rem)] gap-0 overflow-hidden xl:grid-cols-[360px_minmax(0,1fr)]">
      <aside className="flex h-full min-h-0 flex-col border-r bg-card">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h1 className="text-lg font-semibold text-foreground">Orders ({filteredOrders.length})</h1>
          <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setSearchTerm("")}>
            {searchTerm ? "Clear" : ""}
          </button>
        </div>

        <div className="px-4 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search orders"
              className="h-10 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-3">
          {/* Unassigned orders */}
          <div>
            <p className="mb-2 text-sm font-semibold text-foreground">Unassigned orders ({unassignedOrders.length})</p>
            <div className="space-y-2">
              {unassignedOrders.length === 0 && (
                <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">No unassigned orders</p>
              )}
              {unassignedOrders.map((order) => (
                <button
                  key={order.id}
                  type="button"
                  onClick={() => focusOrderOnMap(order)}
                  className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition ${selectedOrderId === order.id ? "border-red-400 bg-red-50 shadow-sm" : "hover:bg-secondary/40"}`}
                >
                  <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border border-red-300">
                    <div className={`h-2.5 w-2.5 rounded-sm ${selectedOrderId === order.id ? "bg-red-500" : ""}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-foreground">#{order.orderNumber}</p>
                    <p className="text-sm text-foreground">{order.customerName}</p>
                    <p className="truncate text-xs text-muted-foreground">{order.address}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Assigned orders */}
          <div>
            <p className="mb-2 text-sm font-semibold text-foreground">Assigned orders ({assignedOrders.length})</p>
            <div className="space-y-2">
              {assignedOrders.length === 0 && (
                <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">No assigned orders</p>
              )}
              {assignedOrders.map((order) => {
                const driver = drivers.find((d) => d.id === order.assignedDriver)
                return (
                  <button
                    key={order.id}
                    type="button"
                    onClick={() => focusOrderOnMap(order)}
                    className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition ${selectedOrderId === order.id ? "border-blue-400 bg-blue-50 shadow-sm" : "hover:bg-secondary/40"}`}
                  >
                    <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border border-blue-300">
                      <div className={`h-2.5 w-2.5 rounded-sm ${selectedOrderId === order.id ? "bg-blue-500" : ""}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-foreground">#{order.orderNumber}</p>
                      <p className="text-sm text-foreground">{order.customerName}</p>
                      <p className="truncate text-xs text-muted-foreground">{order.address}</p>
                      {driver && (
                        <p className="mt-1 truncate text-xs font-medium text-blue-600">
                          Driver: {driver.name}
                        </p>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </aside>

      <section className="relative h-full overflow-hidden bg-card">
        <div ref={mapContainerRef} className="h-full w-full" />

        {/* Legend — bottom-right, Shipday-style */}
        <div className="pointer-events-none absolute bottom-4 right-4 flex items-center gap-3 rounded-lg bg-white/95 px-4 py-2 text-xs shadow-md">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-full bg-amber-500" /> Hub
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-full bg-red-500" /> Unassigned
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-full bg-teal-400" /> Assigned
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-full bg-orange-500" /> In Transit
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-full bg-blue-500" /> Driver
          </span>
        </div>

        {/* Selected order summary — bottom-left */}
        {selectedOrder && (
          <div className="pointer-events-none absolute bottom-4 left-4 max-w-xs rounded-lg bg-white/95 p-3 text-xs shadow-md">
            <p className="font-bold text-foreground">#{selectedOrder.orderNumber} · {selectedOrder.customerName}</p>
            <p className="mt-0.5 text-muted-foreground">{selectedOrder.address}</p>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: orderColor(selectedOrder) }} />
              <span className="font-medium capitalize" style={{ color: orderColor(selectedOrder) }}>{selectedOrder.status}</span>
              {selectedOrder.distanceKm != null && (
                <span className="text-muted-foreground">· {selectedOrder.distanceKm.toFixed(1)} km</span>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Spinner } from "@/components/ui/spinner"
import { Search } from "lucide-react"
import { subscribeDriversRealtime, subscribeOrdersRealtime } from "@/lib/firestore"
import type { Driver, Order } from "@/lib/data"

type LatLng = { lat: number; lng: number }

const LAGOS_CENTER: LatLng = { lat: 6.5244, lng: 3.3792 }

const HUB: LatLng = {
  lat: Number(process.env.NEXT_PUBLIC_HUB_LAT) || 6.4642667,
  lng: Number(process.env.NEXT_PUBLIC_HUB_LNG) || 3.5554814,
}

const geocodeCache = new Map<string, LatLng>()

async function geocodeAddress(address: string): Promise<LatLng | null> {
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

function createPinIcon(
  L: typeof import("leaflet"),
  color: string,
  size = 14,
  selected = false
) {
  const ring = selected ? "0 0 0 4px rgba(0,0,0,0.12)," : ""
  return L.divIcon({
    className: "",
    html: `<div style=\"width:${size}px;height:${size}px;border-radius:9999px;background:${color};border:2px solid #ffffff;box-shadow:${ring} 0 2px 8px rgba(0,0,0,0.35);\"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

export default function RoutesPage() {
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [orderCoords, setOrderCoords] = useState<Record<string, LatLng>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")

  const firstOrdersLoadedRef = useRef(false)
  const firstDriversLoadedRef = useRef(false)

  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<import("leaflet").Map | null>(null)
  const orderLayerRef = useRef<import("leaflet").LayerGroup | null>(null)
  const driverLayerRef = useRef<import("leaflet").LayerGroup | null>(null)
  const routeLineRef = useRef<import("leaflet").Polyline | null>(null)

  useEffect(() => {
    const unsubscribeOrders = subscribeOrdersRealtime((orderData) => {
      setOrders(orderData)
      firstOrdersLoadedRef.current = true
      if (firstDriversLoadedRef.current) {
        setIsLoading(false)
      }
    })

    const unsubscribeDrivers = subscribeDriversRealtime((driverData) => {
      setDrivers(driverData)
      firstDriversLoadedRef.current = true
      if (firstOrdersLoadedRef.current) {
        setIsLoading(false)
      }
    })

    return () => {
      unsubscribeOrders()
      unsubscribeDrivers()
    }
  }, [])

  const visibleOrders = useMemo(
    () => orders.filter((order) => order.status !== "delivered" && order.status !== "cancelled"),
    [orders]
  )

  const activeDrivers = useMemo(
    () => drivers.filter((driver) => driver.status !== "offline" && driver.lastLocation),
    [drivers]
  )

  const filteredOrders = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    if (!q) return visibleOrders
    return visibleOrders.filter((order) => {
      return (
        order.orderNumber.toLowerCase().includes(q) ||
        order.customerName.toLowerCase().includes(q) ||
        order.address.toLowerCase().includes(q)
      )
    })
  }, [searchTerm, visibleOrders])

  const unassignedOrders = useMemo(
    () => filteredOrders.filter((order) => !order.assignedDriver),
    [filteredOrders]
  )

  const assignedOrders = useMemo(
    () => filteredOrders.filter((order) => Boolean(order.assignedDriver)),
    [filteredOrders]
  )

  useEffect(() => {
    let cancelled = false

    async function refreshGeocodedOrders() {
      const geocoded = await Promise.all(
        visibleOrders.map(async (order) => {
          const coords = await geocodeAddress(order.address)
          return { id: order.id, coords }
        })
      )

      if (cancelled) return

      const nextCoords: Record<string, LatLng> = {}
      geocoded.forEach((entry) => {
        if (entry.coords) {
          nextCoords[entry.id] = entry.coords
        }
      })

      setOrderCoords(nextCoords)
    }

    refreshGeocodedOrders()

    return () => {
      cancelled = true
    }
  }, [visibleOrders])

  useEffect(() => {
    if (!visibleOrders.length) {
      setSelectedOrderId(null)
      return
    }

    const nextSelectedOrder =
      visibleOrders.find((order) => order.assignedDriver && orderCoords[order.id]) ??
      visibleOrders.find((order) => orderCoords[order.id]) ??
      visibleOrders[0]

    setSelectedOrderId((current) => {
      if (current && visibleOrders.some((order) => order.id === current)) {
        return current
      }
      return nextSelectedOrder.id
    })
  }, [visibleOrders, orderCoords])

  const selectedOrder = useMemo(
    () => visibleOrders.find((order) => order.id === selectedOrderId) ?? null,
    [selectedOrderId, visibleOrders]
  )

  const selectedDriver = useMemo(() => {
    if (!selectedOrder?.assignedDriver) return null
    return drivers.find((driver) => driver.id === selectedOrder.assignedDriver) ?? null
  }, [drivers, selectedOrder])

  const selectedDestination = selectedOrder ? orderCoords[selectedOrder.id] : null

  useEffect(() => {
    if (isLoading) return

    let mounted = true

    async function initMap() {
      if (!mapContainerRef.current || mapRef.current) return

      const L = await import("leaflet")
      if (!mounted || !mapContainerRef.current) return

      const map = L.map(mapContainerRef.current, {
        zoomControl: true,
      }).setView([LAGOS_CENTER.lat, LAGOS_CENTER.lng], 12)

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map)

      orderLayerRef.current = L.layerGroup().addTo(map)
      driverLayerRef.current = L.layerGroup().addTo(map)
      mapRef.current = map

      // Store / hub marker
      const storeIcon = L.divIcon({
        className: "",
        html: `<div style="width:44px;height:52px;position:relative;">
  <div style="width:44px;height:44px;background:#374151;border-radius:9999px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 10px rgba(0,0,0,0.4);border:3px solid #fff;">
    <svg xmlns='http://www.w3.org/2000/svg' width='22' height='22' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'>
      <path d='M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'/>
      <line x1='9' y1='22' x2='9' y2='12'/>
      <line x1='15' y1='12' x2='15' y2='22'/>
      <rect x='9' y='12' width='6' height='10'/>
    </svg>
  </div>
  <div style="position:absolute;bottom:0;left:50%;transform:translateX(-50%);width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-top:10px solid #374151;"></div>
</div>`,
        iconSize: [44, 52],
        iconAnchor: [22, 52],
      })
      L.marker([HUB.lat, HUB.lng], { icon: storeIcon })
        .bindPopup("<strong>Store / Hub</strong>")
        .addTo(map)

      window.requestAnimationFrame(() => map.invalidateSize())
    }

    initMap()

    return () => {
      mounted = false
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
      orderLayerRef.current = null
      driverLayerRef.current = null
      routeLineRef.current = null
    }
  }, [isLoading])

  useEffect(() => {
    let cancelled = false

    async function updateMap() {
      const map = mapRef.current
      const orderLayer = orderLayerRef.current
      const driverLayer = driverLayerRef.current
      if (!map || !orderLayer || !driverLayer) return

      const L = await import("leaflet")
      if (cancelled) return

      orderLayer.clearLayers()
      driverLayer.clearLayers()

      if (routeLineRef.current) {
        map.removeLayer(routeLineRef.current)
        routeLineRef.current = null
      }

      const allPoints: Array<[number, number]> = []

      visibleOrders.forEach((order) => {
        const coords = orderCoords[order.id]
        if (!coords) return

        const point: [number, number] = [coords.lat, coords.lng]
        allPoints.push(point)

        const isAssigned = Boolean(order.assignedDriver)
        const isSelected = selectedOrderId === order.id
        const iconColor = isAssigned ? "#2563eb" : "#dc2626"

        const marker = L.marker(point, {
          icon: createPinIcon(L, iconColor, isSelected ? 18 : 14, isSelected),
        }).addTo(orderLayer)

        marker.bindPopup(
          `<strong>${order.orderNumber}</strong><br/>${order.customerName}<br/>${isAssigned ? "Assigned" : "Unassigned"}<br/>${order.address}`
        )

        marker.on("click", () => {
          setSelectedOrderId(order.id)
        })
      })

      activeDrivers.forEach((driver) => {
        if (!driver.lastLocation) return

        const point: [number, number] = [driver.lastLocation.lat, driver.lastLocation.lng]
        allPoints.push(point)

        const isSelectedDriver = Boolean(selectedDriver && selectedDriver.id === driver.id)

        const marker = L.marker(point, {
          icon: createPinIcon(L, "#111111", isSelectedDriver ? 18 : 14, isSelectedDriver),
        }).addTo(driverLayer)

        marker.bindPopup(`<strong>${driver.name}</strong><br/>Driver location`)
      })

      if (selectedDriver?.lastLocation && selectedDestination) {
        try {
          const from = `${selectedDriver.lastLocation.lng},${selectedDriver.lastLocation.lat}`
          const to = `${selectedDestination.lng},${selectedDestination.lat}`
          const osrm = `https://router.project-osrm.org/route/v1/driving/${from};${to}?overview=full&geometries=geojson`
          const res = await fetch(osrm)
          if (res.ok) {
            const data = (await res.json()) as {
              routes?: Array<{ geometry?: { coordinates: Array<[number, number]> } }>
            }
            const coords = data.routes?.[0]?.geometry?.coordinates
            if (coords && coords.length > 1) {
              const latLngs: Array<[number, number]> = coords.map(([lng, lat]) => [lat, lng])
              routeLineRef.current = L.polyline(latLngs, {
                color: "#0ea5e9",
                weight: 4,
                opacity: 0.9,
              }).addTo(map)
            }
          }
        } catch {
          // Keep pins visible even if route service fails.
        }
      }

      if (selectedDriver?.lastLocation && selectedDestination) {
        const focusPoints: Array<[number, number]> = [
          [selectedDriver.lastLocation.lat, selectedDriver.lastLocation.lng],
          [selectedDestination.lat, selectedDestination.lng],
        ]
        map.fitBounds(L.latLngBounds(focusPoints), { padding: [36, 36] })
      } else if (allPoints.length > 1) {
        map.fitBounds(L.latLngBounds(allPoints), { padding: [36, 36], maxZoom: 14 })
      } else if (allPoints.length === 1) {
        map.setView(allPoints[0], 14)
      } else {
        map.setView([LAGOS_CENTER.lat, LAGOS_CENTER.lng], 12)
      }

      window.requestAnimationFrame(() => map.invalidateSize())
    }

    updateMap()

    return () => {
      cancelled = true
    }
  }, [activeDrivers, orderCoords, selectedDestination, selectedDriver, selectedOrderId, visibleOrders])

  const focusOrderOnMap = (order: Order) => {
    setSelectedOrderId(order.id)

    const map = mapRef.current
    const coords = orderCoords[order.id]
    if (!map || !coords) return

    map.flyTo([coords.lat, coords.lng], 14, {
      duration: 0.6,
    })
  }

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner />
      </div>
    )
  }

  return (
    <div className="grid h-[calc(100vh-5.5rem)] gap-4 overflow-hidden xl:grid-cols-[360px_minmax(0,1fr)]">
      <aside className="flex h-full min-h-0 flex-col rounded-xl border bg-card">
        <div className="border-b px-4 py-3">
          <h1 className="text-2xl font-semibold text-foreground">Orders ({filteredOrders.length})</h1>
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

        <div className="grid grid-cols-3 gap-2 border-b px-4 pb-3 text-xs">
          <div className="rounded-md bg-blue-500/10 px-2 py-1 text-blue-700">Assigned: {assignedOrders.length}</div>
          <div className="rounded-md bg-red-500/10 px-2 py-1 text-red-700">Unassigned: {unassignedOrders.length}</div>
          <div className="rounded-md bg-black/10 px-2 py-1 text-black">Drivers: {activeDrivers.length}</div>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
          <div>
            <p className="mb-2 text-sm font-medium text-red-700">Unassigned Orders</p>
            <div className="space-y-2">
              {unassignedOrders.length === 0 && (
                <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">No unassigned orders</p>
              )}
              {unassignedOrders.map((order) => (
                <button
                  key={order.id}
                  type="button"
                  onClick={() => focusOrderOnMap(order)}
                  className={`w-full rounded-lg border p-3 text-left transition ${selectedOrderId === order.id ? "border-red-500 bg-red-50" : "hover:bg-secondary/40"}`}
                >
                  <p className="text-sm font-semibold text-foreground">{order.orderNumber}</p>
                  <p className="text-sm text-foreground">{order.customerName}</p>
                  <p className="truncate text-xs text-muted-foreground">{order.address}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-blue-700">Assigned Orders</p>
            <div className="space-y-2">
              {assignedOrders.length === 0 && (
                <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">No assigned orders</p>
              )}
              {assignedOrders.map((order) => (
                <button
                  key={order.id}
                  type="button"
                  onClick={() => focusOrderOnMap(order)}
                  className={`w-full rounded-lg border p-3 text-left transition ${selectedOrderId === order.id ? "border-blue-500 bg-blue-50" : "hover:bg-secondary/40"}`}
                >
                  <p className="text-sm font-semibold text-foreground">{order.orderNumber}</p>
                  <p className="text-sm text-foreground">{order.customerName}</p>
                  <p className="truncate text-xs text-muted-foreground">{order.address}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </aside>

      <section className="relative h-full overflow-hidden rounded-xl border bg-card">
        <div ref={mapContainerRef} className="h-full w-full" />

        <div className="pointer-events-none absolute left-4 top-4 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-white/95 px-3 py-1 shadow-sm">
            <span className="inline-block h-2 w-2 rounded-full bg-blue-600" /> Assigned delivery location
          </span>
          <span className="rounded-full bg-white/95 px-3 py-1 shadow-sm">
            <span className="inline-block h-2 w-2 rounded-full bg-red-600" /> Unassigned delivery location
          </span>
          <span className="rounded-full bg-white/95 px-3 py-1 shadow-sm">
            <span className="inline-block h-2 w-2 rounded-full bg-black" /> Driver location
          </span>
        </div>

        {selectedOrder && (
          <div className="pointer-events-none absolute bottom-4 left-4 right-4 rounded-lg bg-white/95 p-3 text-xs shadow-md">
            <p className="font-medium text-foreground">Selected: {selectedOrder.orderNumber}</p>
            <p className="text-muted-foreground">{selectedOrder.address}</p>
            <p className="mt-1 text-muted-foreground">
              {selectedOrder.assignedDriver ? "Assigned order pin is blue." : "Unassigned order pin is red."} Driver pin is black.
            </p>
          </div>
        )}
      </section>
    </div>
  )
}

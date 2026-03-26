"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Spinner } from "@/components/ui/spinner"
import { Search } from "lucide-react"
import { subscribeDriversRealtime, subscribeOrdersRealtime } from "@/lib/firestore"
import { loadGoogleMaps, geocodeAddress } from "@/lib/google-maps"
import type { Driver, Order } from "@/lib/data"

type LatLng = { lat: number; lng: number }

const LAGOS_CENTER: LatLng = { lat: 6.5244, lng: 3.3792 }

const HUB: LatLng = {
  lat: Number(process.env.NEXT_PUBLIC_HUB_LAT) || 6.4642667,
  lng: Number(process.env.NEXT_PUBLIC_HUB_LNG) || 3.5554814,
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
  const mapRef = useRef<google.maps.Map | null>(null)
  const orderMarkersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([])
  const driverMarkersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([])
  const hubMarkerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null)
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null)

  useEffect(() => {
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
  }, [])

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
      geocoded.forEach((e) => { if (e.coords) nextCoords[e.id] = e.coords })
      setOrderCoords(nextCoords)
    }
    refreshGeocodedOrders()
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

  // ── Init Google Map ──
  useEffect(() => {
    if (isLoading) return
    let mounted = true

    async function initMap() {
      if (!mapContainerRef.current || mapRef.current) return
      await loadGoogleMaps()
      if (!mounted || !mapContainerRef.current) return

      const map = new google.maps.Map(mapContainerRef.current, {
        center: LAGOS_CENTER,
        zoom: 12,
        mapId: "routes-map",
        disableDefaultUI: false,
        zoomControl: true,
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: false,
      })
      mapRef.current = map

      // Hub marker
      const hubEl = document.createElement("div")
      hubEl.innerHTML = `<div style="width:44px;height:52px;position:relative;">
        <div style="width:44px;height:44px;background:#374151;border-radius:9999px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 10px rgba(0,0,0,0.4);border:3px solid #fff;">
          <svg xmlns='http://www.w3.org/2000/svg' width='22' height='22' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'>
            <path d='M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'/>
            <polyline points='9 22 9 12 15 12 15 22'/>
          </svg>
        </div>
        <div style="position:absolute;bottom:0;left:50%;transform:translateX(-50%);width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-top:10px solid #374151;"></div>
      </div>`

      hubMarkerRef.current = new google.maps.marker.AdvancedMarkerElement({
        map,
        position: HUB,
        content: hubEl,
        title: "Store / Hub",
      })
    }

    initMap()

    return () => {
      mounted = false
      orderMarkersRef.current.forEach((m) => (m.map = null))
      orderMarkersRef.current = []
      driverMarkersRef.current.forEach((m) => (m.map = null))
      driverMarkersRef.current = []
      if (hubMarkerRef.current) hubMarkerRef.current.map = null
      if (directionsRendererRef.current) directionsRendererRef.current.setMap(null)
      mapRef.current = null
    }
  }, [isLoading])

  // ── Update markers + route ──
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    orderMarkersRef.current.forEach((m) => (m.map = null))
    orderMarkersRef.current = []
    driverMarkersRef.current.forEach((m) => (m.map = null))
    driverMarkersRef.current = []
    if (directionsRendererRef.current) {
      directionsRendererRef.current.setMap(null)
      directionsRendererRef.current = null
    }

    const bounds = new google.maps.LatLngBounds()
    let hasPoints = false

    visibleOrders.forEach((order) => {
      const coords = orderCoords[order.id]
      if (!coords) return

      const isAssigned = Boolean(order.assignedDriver)
      const isSelected = selectedOrderId === order.id
      const color = isAssigned ? "#2563eb" : "#dc2626"
      const size = isSelected ? 18 : 14

      const el = document.createElement("div")
      el.style.cssText = `width:${size}px;height:${size}px;border-radius:9999px;background:${color};border:2px solid #fff;box-shadow:${isSelected ? "0 0 0 4px rgba(0,0,0,0.12)," : ""} 0 2px 8px rgba(0,0,0,0.35);cursor:pointer;`

      const marker = new google.maps.marker.AdvancedMarkerElement({
        map,
        position: coords,
        content: el,
        title: `${order.orderNumber} - ${order.customerName}`,
      })
      marker.addListener("click", () => setSelectedOrderId(order.id))
      orderMarkersRef.current.push(marker)
      bounds.extend(coords)
      hasPoints = true
    })

    activeDrivers.forEach((driver) => {
      if (!driver.lastLocation) return
      const pos = { lat: driver.lastLocation.lat, lng: driver.lastLocation.lng }
      const isSelectedDriver = Boolean(selectedDriver && selectedDriver.id === driver.id)
      const size = isSelectedDriver ? 18 : 14

      const el = document.createElement("div")
      el.style.cssText = `width:${size}px;height:${size}px;border-radius:9999px;background:#111;border:2px solid #fff;box-shadow:${isSelectedDriver ? "0 0 0 4px rgba(0,0,0,0.12)," : ""} 0 2px 8px rgba(0,0,0,0.35);`

      const marker = new google.maps.marker.AdvancedMarkerElement({
        map,
        position: pos,
        content: el,
        title: driver.name,
      })
      driverMarkersRef.current.push(marker)
      bounds.extend(pos)
      hasPoints = true
    })

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

      const focusBounds = new google.maps.LatLngBounds()
      focusBounds.extend({ lat: selectedDriver.lastLocation.lat, lng: selectedDriver.lastLocation.lng })
      focusBounds.extend(selectedDestination)
      map.fitBounds(focusBounds, 36)
    } else if (hasPoints) {
      map.fitBounds(bounds, 36)
    } else {
      map.setCenter(LAGOS_CENTER)
      map.setZoom(12)
    }
  }, [activeDrivers, orderCoords, selectedDestination, selectedDriver, selectedOrderId, visibleOrders])

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

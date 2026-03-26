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
  const orderMarkersRef = useRef<google.maps.Marker[]>([])
  const driverMarkersRef = useRef<google.maps.Marker[]>([])
  const hubMarkerRef = useRef<google.maps.Marker | null>(null)
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
        disableDefaultUI: false,
        zoomControl: true,
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: false,
      })
      mapRef.current = map

      // Hub marker
      const hubSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="52"><circle cx="22" cy="22" r="20" fill="%23374151" stroke="white" stroke-width="3"/><path d="M13 24l9-7 9 7v8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 13 32z" fill="none" stroke="white" stroke-width="1.8"/><polyline points="19,33.5 19,27 25,27 25,33.5" fill="none" stroke="white" stroke-width="1.8"/><polygon points="22,50 16,40 28,40" fill="%23374151"/></svg>`
      hubMarkerRef.current = new google.maps.Marker({
        map,
        position: HUB,
        title: "Store / Hub",
        icon: {
          url: `data:image/svg+xml;charset=UTF-8,${hubSvg}`,
          scaledSize: new google.maps.Size(44, 52),
          anchor: new google.maps.Point(22, 50),
        },
      })
    }

    initMap()

    return () => {
      mounted = false
      orderMarkersRef.current.forEach((m) => m.setMap(null))
      orderMarkersRef.current = []
      driverMarkersRef.current.forEach((m) => m.setMap(null))
      driverMarkersRef.current = []
      if (hubMarkerRef.current) hubMarkerRef.current.setMap(null)
      if (directionsRendererRef.current) directionsRendererRef.current.setMap(null)
      mapRef.current = null
    }
  }, [isLoading])

  // ── Update markers + route ──
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    orderMarkersRef.current.forEach((m) => m.setMap(null))
    orderMarkersRef.current = []
    driverMarkersRef.current.forEach((m) => m.setMap(null))
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
      const scale = isSelected ? 9 : 7

      const marker = new google.maps.Marker({
        map,
        position: coords,
        title: `${order.orderNumber} - ${order.customerName}`,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: color,
          fillOpacity: 1,
          strokeColor: "#fff",
          strokeWeight: 2,
          scale,
        },
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
      const scale = isSelectedDriver ? 9 : 7

      const marker = new google.maps.Marker({
        map,
        position: pos,
        title: driver.name,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: "#111",
          fillOpacity: 1,
          strokeColor: "#fff",
          strokeWeight: 2,
          scale,
        },
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

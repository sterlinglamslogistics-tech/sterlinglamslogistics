"use client"

import { useEffect, useState, useRef, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Menu, List, MapPin, Navigation, Phone, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { useDriver } from "@/components/driver-context"
import { formatCurrency } from "@/lib/data"
import type { Order } from "@/lib/data"
import { cn } from "@/lib/utils"
import { loadGoogleMaps, geocodeAddress } from "@/lib/google-maps"

export default function DriverMapPage() {
  const router = useRouter()
  const { session, driver, orders, isOnline, loadingSession, setDrawerOpen, refreshOrders } = useDriver()
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const markersRef = useRef<google.maps.Marker[]>([])
  const driverMarkerRef = useRef<google.maps.Marker | null>(null)
  const hubMarkerRef = useRef<google.maps.Marker | null>(null)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [mapReady, setMapReady] = useState(false)

  // Redirect if no session
  useEffect(() => {
    if (!loadingSession && !session) {
      router.replace("/driver")
    }
  }, [loadingSession, session, router])

  const activeOrders = useMemo(() => {
    if (!isOnline) return []
    return orders
      .filter(
        (o) => o.status === "started" || o.status === "picked-up" || o.status === "in-transit"
      )
      .sort((a, b) => {
        const aTime = a.startedAt ? new Date(a.startedAt as any).getTime() : 0
        const bTime = b.startedAt ? new Date(b.startedAt as any).getTime() : 0
        return aTime - bTime
      })
  }, [orders, isOnline])

  // Stable key so effect only reruns when order list actually changes
  const ordersKey = useMemo(
    () => activeOrders.map((o) => `${o.id}:${o.status}`).join(","),
    [activeOrders]
  )

  // Poll for new orders every 15 seconds
  useEffect(() => {
    if (!session || !isOnline) return
    const interval = setInterval(() => refreshOrders(), 15000)
    return () => clearInterval(interval)
  }, [session, isOnline, refreshOrders])

  // Initialize Google Map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return

    let cancelled = false

    async function initMap() {
      await loadGoogleMaps()
      if (cancelled || !mapContainerRef.current) return

      const hubLat = Number(process.env.NEXT_PUBLIC_HUB_LAT) || 6.4541
      const hubLng = Number(process.env.NEXT_PUBLIC_HUB_LNG) || 3.4347

      const map = new google.maps.Map(mapContainerRef.current!, {
        center: { lat: hubLat, lng: hubLng },
        zoom: 13,
        disableDefaultUI: true,
        zoomControl: true,
        styles: [
          { featureType: "poi", stylers: [{ visibility: "off" }] },
          { featureType: "poi.park", stylers: [{ visibility: "simplified" }] },
          { featureType: "transit", stylers: [{ visibility: "simplified" }] },
        ],
      })

      // Store / Hub marker
      const hubSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><circle cx="16" cy="16" r="14" fill="%23e91e8c" stroke="white" stroke-width="2"/><text x="16" y="21" text-anchor="middle" fill="white" font-size="14" font-weight="bold" font-family="sans-serif">S</text></svg>`
      hubMarkerRef.current = new google.maps.Marker({
        map,
        position: { lat: hubLat, lng: hubLng },
        title: "Sterlin Glams Store",
        icon: {
          url: `data:image/svg+xml;charset=UTF-8,${hubSvg}`,
          scaledSize: new google.maps.Size(32, 32),
          anchor: new google.maps.Point(16, 16),
        },
      })

      mapRef.current = map
      setMapReady(true)
    }

    initMap()

    return () => {
      cancelled = true
    }
  }, [])

  // Update ORDER markers only when orders change (not on GPS updates)
  useEffect(() => {
    if (!mapReady || !mapRef.current) return

    let cancelled = false

    async function updateOrderMarkers() {
      const map = mapRef.current!

      // Clear old order markers
      for (const m of markersRef.current) {
        m.setMap(null)
      }
      markersRef.current = []

      const orderMeta: Array<{ order: Order; num: number; time: string }> = []

      for (let i = 0; i < activeOrders.length; i++) {
        if (cancelled) return
        const order = activeOrders[i]
        const num = i + 1

        const ts = order.startedAt ?? order.createdAt
        let timeStr = ""
        if (ts) {
          const d = ts instanceof Date ? ts : new Date(ts as string)
          if (!Number.isNaN(d.getTime())) {
            timeStr = d.toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit", hour12: true }).toUpperCase()
          }
        }

        const coords = await geocodeAddress(order.address)
        if (!coords || cancelled) continue

        const markerSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44"><circle cx="22" cy="22" r="20" fill="%23222222" stroke="white" stroke-width="3"/><text x="22" y="28" text-anchor="middle" fill="white" font-size="18" font-weight="bold" font-family="sans-serif">${num}</text></svg>`

        const marker = new google.maps.Marker({
          map,
          position: coords,
          title: `${order.orderNumber} - ${order.customerName}`,
          icon: {
            url: `data:image/svg+xml;charset=UTF-8,${markerSvg}`,
            scaledSize: new google.maps.Size(44, 44),
            anchor: new google.maps.Point(22, 22),
          },
        })

        orderMeta.push({ order, num, time: timeStr })
        const meta = orderMeta[orderMeta.length - 1]
        marker.addListener("click", () =>
          setSelectedOrder({ ...meta.order, _mapNum: meta.num, _mapTime: meta.time } as Order & { _mapNum: number; _mapTime: string })
        )
        markersRef.current.push(marker)
      }
    }

    updateOrderMarkers()

    return () => {
      cancelled = true
    }
  }, [mapReady, ordersKey, isOnline])

  // Update DRIVER location marker independently (runs on GPS updates without touching order markers)
  useEffect(() => {
    if (!mapReady || !mapRef.current) return

    if (driverMarkerRef.current) {
      driverMarkerRef.current.setMap(null)
      driverMarkerRef.current = null
    }

    if (driver?.lastLocation) {
      const driverSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36"><circle cx="18" cy="18" r="12" fill="%233b82f6" stroke="white" stroke-width="3"/></svg>`
      driverMarkerRef.current = new google.maps.Marker({
        map: mapRef.current,
        position: { lat: driver.lastLocation.lat, lng: driver.lastLocation.lng },
        title: "Your location",
        icon: {
          url: `data:image/svg+xml;charset=UTF-8,${driverSvg}`,
          scaledSize: new google.maps.Size(36, 36),
          anchor: new google.maps.Point(18, 18),
        },
      })
    }
  }, [mapReady, driver?.lastLocation])

  if (loadingSession || !session) return null

  return (
    <div className="relative h-[calc(100vh-80px)]">
      {/* Header */}
      <div className="absolute inset-x-0 top-0 z-[20] flex items-center justify-between bg-background/90 backdrop-blur px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="rounded-lg p-1.5 hover:bg-muted"
          >
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-bold">Map</h1>
        </div>
        <button
          type="button"
          onClick={() => router.push("/driver/dashboard")}
          className="rounded-lg p-1.5 hover:bg-muted"
        >
          <List className="h-5 w-5" />
        </button>
      </div>

      {/* Map */}
      <div ref={mapContainerRef} className="h-full w-full" />

      {/* My location button */}
      {driver?.lastLocation && (
        <button
          type="button"
          onClick={() => {
            if (mapRef.current && driver.lastLocation) {
              mapRef.current.panTo({ lat: driver.lastLocation.lat, lng: driver.lastLocation.lng })
              mapRef.current.setZoom(15)
            }
          }}
          className="absolute bottom-24 right-4 z-[20] flex h-10 w-10 items-center justify-center rounded-full bg-background shadow-lg border"
        >
          <Navigation className="h-5 w-5 text-blue-600" />
        </button>
      )}

      {/* Order detail bottom sheet */}
      {selectedOrder && (() => {
        const sel = selectedOrder as Order & { _mapNum?: number; _mapTime?: string }
        const statusLabel = sel.status === "started" ? "Started" : sel.status === "picked-up" ? "Picked Up" : "In Transit"
        const statusColor = sel.status === "started" ? "bg-orange-100 text-orange-700 border-orange-200" : sel.status === "picked-up" ? "bg-blue-100 text-blue-700 border-blue-200" : "bg-yellow-100 text-yellow-700 border-yellow-200"
        return (
          <div className="absolute inset-x-0 bottom-0 z-[20] animate-in slide-in-from-bottom-4">
            <div className="mx-3 mb-2 rounded-2xl border bg-background p-4 shadow-2xl">
              <div className="mb-3 flex justify-center">
                <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
              </div>

              {/* Status + Nav/Phone */}
              <div className="mb-2 flex items-center justify-between">
                <Badge variant="outline" className={cn("text-xs font-semibold", statusColor)}>
                  {statusLabel}
                </Badge>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const encoded = encodeURIComponent(sel.address)
                      window.location.href = `https://www.google.com/maps/dir/?api=1&destination=${encoded}`
                    }}
                    className="rounded-lg p-1.5 hover:bg-muted"
                  >
                    <Navigation className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => { window.location.href = `tel:${sel.phone}` }}
                    className="rounded-lg p-1.5 hover:bg-muted"
                  >
                    <Phone className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Order number */}
              <p className="text-sm text-muted-foreground">#{sel.orderNumber}</p>

              {/* Customer + marker + time */}
              <div className="mt-2 flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold">{sel.customerName}{sel._mapNum ? ` (#${sel._mapNum})` : ""}</p>
                  <p className="text-sm text-muted-foreground">{sel.address}</p>
                </div>
                {sel._mapTime && (
                  <span className="shrink-0 text-sm font-medium text-muted-foreground">{sel._mapTime}</span>
                )}
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

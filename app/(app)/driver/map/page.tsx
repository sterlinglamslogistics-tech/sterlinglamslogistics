"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Menu, List, MapPin, Navigation, Phone, X, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { useDriver } from "@/components/driver-context"
import { formatCurrency } from "@/lib/data"
import type { Order } from "@/lib/data"
import { cn } from "@/lib/utils"

export default function DriverMapPage() {
  const router = useRouter()
  const { session, driver, orders, isOnline, loadingSession, setDrawerOpen } = useDriver()
  const mapRef = useRef<HTMLDivElement>(null)
  const leafletMapRef = useRef<unknown>(null)
  const markersRef = useRef<unknown[]>([])
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [mapReady, setMapReady] = useState(false)

  // Redirect if no session
  useEffect(() => {
    if (!loadingSession && !session) {
      router.replace("/driver")
    }
  }, [loadingSession, session, router])

  const activeOrders = orders.filter(
    (o) => o.status === "started" || o.status === "picked-up" || o.status === "in-transit"
  )

  // Initialize Leaflet map
  useEffect(() => {
    if (!mapRef.current || leafletMapRef.current) return

    let cancelled = false

    async function initMap() {
      const L = (await import("leaflet")).default

      if (cancelled || !mapRef.current) return

      // Fix Leaflet default icon paths
      delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      })

      const hubLat = Number(process.env.NEXT_PUBLIC_HUB_LAT) || 6.4541
      const hubLng = Number(process.env.NEXT_PUBLIC_HUB_LNG) || 3.4347

      const map = L.map(mapRef.current!, {
        zoomControl: false,
      }).setView([hubLat, hubLng], 13)

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
      }).addTo(map)

      // Store location marker
      const storeIcon = L.divIcon({
        html: `<div style="background:#e91e8c;color:#fff;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:bold;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3);">S</div>`,
        className: "",
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      })
      L.marker([hubLat, hubLng], { icon: storeIcon }).addTo(map).bindPopup("Sterlin Glams Store")

      leafletMapRef.current = map
      setMapReady(true)
    }

    initMap()

    return () => {
      cancelled = true
    }
  }, [])

  // Update markers when orders change
  useEffect(() => {
    if (!mapReady || !leafletMapRef.current) return

    let cancelled = false

    async function updateMarkers() {
      const L = (await import("leaflet")).default
      const map = leafletMapRef.current as import("leaflet").Map

      // Clear old markers
      for (const m of markersRef.current) {
        map.removeLayer(m as import("leaflet").Layer)
      }
      markersRef.current = []

      // We'll use the geocode from Nominatim for order addresses
      for (let i = 0; i < activeOrders.length; i++) {
        if (cancelled) return
        const order = activeOrders[i]
        const num = i + 1

        try {
          const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(order.address)}`
          const res = await fetch(url, { headers: { Accept: "application/json" } })
          if (!res.ok) continue
          const data = (await res.json()) as Array<{ lat: string; lon: string }>
          if (!data.length) continue

          const lat = Number(data[0].lat)
          const lng = Number(data[0].lon)
          if (Number.isNaN(lat) || Number.isNaN(lng)) continue

          const markerIcon = L.divIcon({
            html: `<div style="background:#1f1f1f;color:#fff;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:bold;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3);">${num}</div>`,
            className: "",
            iconSize: [28, 28],
            iconAnchor: [14, 14],
          })

          const marker = L.marker([lat, lng], { icon: markerIcon }).addTo(map)
          marker.on("click", () => setSelectedOrder(order))
          markersRef.current.push(marker)
        } catch {
          // Skip if geocoding fails
        }
      }

      // Add driver location marker
      if (driver?.lastLocation) {
        const driverIcon = L.divIcon({
          html: `<div style="background:#3b82f6;border-radius:50%;width:16px;height:16px;border:3px solid #fff;box-shadow:0 0 0 3px rgba(59,130,246,.4),0 2px 6px rgba(0,0,0,.3);"></div>`,
          className: "",
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        })
        const driverMarker = L.marker(
          [driver.lastLocation.lat, driver.lastLocation.lng],
          { icon: driverIcon }
        ).addTo(map)
        markersRef.current.push(driverMarker)
      }
    }

    updateMarkers()

    return () => {
      cancelled = true
    }
  }, [mapReady, activeOrders, driver?.lastLocation])

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
      <div ref={mapRef} className="h-full w-full" />

      {/* My location button */}
      {driver?.lastLocation && (
        <button
          type="button"
          onClick={() => {
            if (leafletMapRef.current && driver.lastLocation) {
              (leafletMapRef.current as import("leaflet").Map).setView(
                [driver.lastLocation.lat, driver.lastLocation.lng],
                15
              )
            }
          }}
          className="absolute bottom-24 right-4 z-[20] flex h-10 w-10 items-center justify-center rounded-full bg-background shadow-lg border"
        >
          <Navigation className="h-5 w-5 text-blue-600" />
        </button>
      )}

      {/* Order detail bottom sheet */}
      {selectedOrder && (
        <div className="absolute inset-x-0 bottom-0 z-[20] animate-in slide-in-from-bottom-4">
          <div className="mx-3 mb-2 rounded-2xl border bg-background p-4 shadow-2xl">
            <div className="mb-3 flex justify-center">
              <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
            </div>

            <div className="mb-2 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-blue-500/15 text-blue-600 border-blue-500/20 text-xs">
                    {selectedOrder.status === "started" ? "Started" : selectedOrder.status === "picked-up" ? "Picked Up" : "In Transit"}
                  </Badge>
                  <button
                    type="button"
                    onClick={() => {
                      const encoded = encodeURIComponent(selectedOrder.address)
                      window.location.href = `https://www.google.com/maps/dir/?api=1&destination=${encoded}`
                    }}
                    className="rounded-lg p-1 hover:bg-muted"
                  >
                    <Navigation className="h-4 w-4 text-blue-600" />
                  </button>
                  <button
                    type="button"
                    onClick={() => { window.location.href = `tel:${selectedOrder.phone}` }}
                    className="rounded-lg p-1 hover:bg-muted"
                  >
                    <Phone className="h-4 w-4 text-green-600" />
                  </button>
                </div>
                <p className="mt-1 font-semibold">{selectedOrder.orderNumber}</p>
                <p className="text-sm text-muted-foreground">{selectedOrder.customerName}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="rounded-lg p-1 hover:bg-muted"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{selectedOrder.address}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

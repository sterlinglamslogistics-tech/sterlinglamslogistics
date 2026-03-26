"use client"

import { useEffect, useMemo, useRef, useState, use } from "react"
import { Phone, MessageSquare, ChevronDown, ChevronUp, MapPin, Package, Clock, Star } from "lucide-react"
import { useSearchParams } from "next/navigation"
import { Spinner } from "@/components/ui/spinner"
import { subscribeDriverRealtime, subscribeOrderByTrackingRealtime, updateOrder } from "@/lib/firestore"
import { formatCurrency } from "@/lib/data"
import type { Driver, Order } from "@/lib/data"
import { loadGoogleMaps, geocodeAddress } from "@/lib/google-maps"

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

function parseRating(value: string | null) {
  if (!value) return null
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 5) return null
  return parsed
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

function animateMarkerTo(
  marker: google.maps.marker.AdvancedMarkerElement,
  target: { lat: number; lng: number },
  frameRef: { current: number | null },
  durationMs = 900
) {
  if (frameRef.current !== null) {
    window.cancelAnimationFrame(frameRef.current)
    frameRef.current = null
  }

  const pos = marker.position as google.maps.LatLngLiteral | google.maps.LatLng | null
  const fromLat = pos ? (typeof (pos as google.maps.LatLng).lat === "function" ? (pos as google.maps.LatLng).lat() : (pos as google.maps.LatLngLiteral).lat) : target.lat
  const fromLng = pos ? (typeof (pos as google.maps.LatLng).lng === "function" ? (pos as google.maps.LatLng).lng() : (pos as google.maps.LatLngLiteral).lng) : target.lng

  if (Math.abs(fromLat - target.lat) < 0.000001 && Math.abs(fromLng - target.lng) < 0.000001) {
    marker.position = target
    return
  }

  const startedAt = performance.now()
  const step = (now: number) => {
    const progress = Math.min((now - startedAt) / durationMs, 1)
    const eased = 1 - Math.pow(1 - progress, 3)
    const lat = fromLat + (target.lat - fromLat) * eased
    const lng = fromLng + (target.lng - fromLng) * eased
    marker.position = { lat, lng }

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
  const searchParams = useSearchParams()
  const [order, setOrder] = useState<Order | null>(null)
  const [driver, setDriver] = useState<Driver | null>(null)
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState(() => Date.now())
  const [destinationCoord, setDestinationCoord] = useState<{ lat: number; lng: number } | null>(null)
  const [updatesOpen, setUpdatesOpen] = useState(false)
  const [orderOpen, setOrderOpen] = useState(false)
  const [liveRoute, setLiveRoute] = useState<{ distanceKm: number; durationMs: number; fetchedAt: number } | null>(null)
  const [ratingState, setRatingState] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [showRatingPage, setShowRatingPage] = useState(false)
  const [serviceRating, setServiceRating] = useState(0)
  const [driverRating, setDriverRating] = useState(0)
  const [feedback, setFeedback] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const activeDriverSubscriptionRef = useRef<(() => void) | null>(null)
  const activeDriverIdRef = useRef<string | null>(null)
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const driverMarkerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null)
  const destinationMarkerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null)
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null)
  const driverAnimFrameRef = useRef<number | null>(null)
  const ratingSyncRef = useRef<string | null>(null)

  const requestedRating = useMemo(() => parseRating(searchParams.get("rating")), [searchParams])

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

  // Auto-switch to rating page 5 seconds after delivery
  useEffect(() => {
    if (!order || order.status !== "delivered") return
    if (submitted) return
    const timer = setTimeout(() => setShowRatingPage(true), 5000)
    return () => clearTimeout(timer)
  }, [order?.status, submitted])

  useEffect(() => {
    if (!order || order.status !== "delivered" || !requestedRating) return

    const syncKey = `${order.id}:${requestedRating}`
    if (ratingSyncRef.current === syncKey) {
      return
    }

    if (order.customerRating === requestedRating) {
      ratingSyncRef.current = syncKey
      setRatingState("saved")
      return
    }

    let cancelled = false
    setRatingState("saving")

    updateOrder(order.id, {
      customerRating: requestedRating,
      customerRatedAt: new Date(),
    })
      .then(() => {
        if (cancelled) return
        ratingSyncRef.current = syncKey
        setRatingState("saved")
      })
      .catch((error) => {
        console.error("Failed to save customer rating:", error)
        if (cancelled) return
        setRatingState("error")
      })

    return () => {
      cancelled = true
    }
  }, [order, requestedRating])

  const etaMs = useMemo(() => {
    if (!order || order.status === "delivered") return 0
    // Use Google Directions duration (ticks down from when it was last fetched)
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

      await loadGoogleMaps()
      if (!mounted || !mapContainerRef.current) return

      const map = new google.maps.Map(mapContainerRef.current, {
        center: { lat: HUB.lat, lng: HUB.lng },
        zoom: 13,
        mapId: "tracking-map",
        disableDefaultUI: false,
        zoomControl: true,
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: false,
      })

      mapRef.current = map
    }

    initMap()

    return () => {
      mounted = false
      if (driverMarkerRef.current) { driverMarkerRef.current.map = null; driverMarkerRef.current = null }
      if (destinationMarkerRef.current) { destinationMarkerRef.current.map = null; destinationMarkerRef.current = null }
      if (directionsRendererRef.current) { directionsRendererRef.current.setMap(null); directionsRendererRef.current = null }
      if (driverAnimFrameRef.current !== null) {
        window.cancelAnimationFrame(driverAnimFrameRef.current)
        driverAnimFrameRef.current = null
      }
      mapRef.current = null
    }
  }, [loading])

  useEffect(() => {
    let cancelled = false

    async function renderMapData() {
      const map = mapRef.current
      if (!map) return

      await loadGoogleMaps()
      if (cancelled) return

      // Clear old directions route
      if (directionsRendererRef.current) {
        directionsRendererRef.current.setMap(null)
        directionsRendererRef.current = null
      }

      const bounds = new google.maps.LatLngBounds()
      let hasPoints = false

      // Driver marker
      if (driver?.lastLocation) {
        const pos = { lat: driver.lastLocation.lat, lng: driver.lastLocation.lng }
        bounds.extend(pos)
        hasPoints = true

        if (!driverMarkerRef.current) {
          const driverEl = document.createElement("div")
          driverEl.innerHTML = `<div style="width:44px;height:44px;background:#1a1a2e;border-radius:9999px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 10px rgba(0,0,0,0.4);border:3px solid #fff;"><svg xmlns='http://www.w3.org/2000/svg' width='22' height='22' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'/><polyline points='9 22 9 12 15 12 15 22'/></svg></div>`

          driverMarkerRef.current = new google.maps.marker.AdvancedMarkerElement({
            map,
            position: pos,
            content: driverEl,
            title: driver.name,
          })
        } else {
          animateMarkerTo(driverMarkerRef.current, pos, driverAnimFrameRef)
        }
      } else if (driverMarkerRef.current) {
        if (driverAnimFrameRef.current !== null) {
          window.cancelAnimationFrame(driverAnimFrameRef.current)
          driverAnimFrameRef.current = null
        }
        driverMarkerRef.current.map = null
        driverMarkerRef.current = null
      }

      // Destination marker
      if (destinationCoord) {
        bounds.extend(destinationCoord)
        hasPoints = true

        if (!destinationMarkerRef.current) {
          const destEl = document.createElement("div")
          destEl.innerHTML = `<div style="width:36px;height:46px;display:flex;flex-direction:column;align-items:center;">
  <div style="width:36px;height:36px;background:#1a1a2e;border-radius:9999px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 10px rgba(0,0,0,0.4);border:3px solid #fff;">
    <svg xmlns='http://www.w3.org/2000/svg' width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'>
      <path d='M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z'/>
      <circle cx='12' cy='10' r='3'/>
    </svg>
  </div>
  <div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:10px solid #1a1a2e;margin-top:-2px;"></div>
</div>`

          destinationMarkerRef.current = new google.maps.marker.AdvancedMarkerElement({
            map,
            position: destinationCoord,
            content: destEl,
            title: "Delivery destination",
          })
        } else {
          destinationMarkerRef.current.position = destinationCoord
        }
      } else if (destinationMarkerRef.current) {
        destinationMarkerRef.current.map = null
        destinationMarkerRef.current = null
      }

      // Route via Directions API
      if (driver?.lastLocation && destinationCoord) {
        const directionsService = new google.maps.DirectionsService()
        const directionsRenderer = new google.maps.DirectionsRenderer({
          map,
          suppressMarkers: true,
          polylineOptions: { strokeColor: "#374151", strokeWeight: 5, strokeOpacity: 0.75 },
        })
        directionsRendererRef.current = directionsRenderer

        directionsService.route(
          {
            origin: { lat: driver.lastLocation.lat, lng: driver.lastLocation.lng },
            destination: destinationCoord,
            travelMode: google.maps.TravelMode.DRIVING,
          },
          (result, status) => {
            if (cancelled) return
            if (status === google.maps.DirectionsStatus.OK && result) {
              directionsRenderer.setDirections(result)
              const leg = result.routes?.[0]?.legs?.[0]
              if (leg) {
                setLiveRoute({
                  distanceKm: (leg.distance?.value ?? 0) / 1000,
                  durationMs: (leg.duration?.value ?? 0) * 1000,
                  fetchedAt: Date.now(),
                })
              }
            }
          }
        )
      } else {
        if (!cancelled) setLiveRoute(null)
      }

      // Fit bounds
      if (hasPoints) {
        map.fitBounds(bounds, 24)
      } else {
        map.setCenter({ lat: HUB.lat, lng: HUB.lng })
        map.setZoom(13)
      }
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

  // ── Rating / Feedback page ──
  if (showRatingPage && order.status === "delivered" && !submitted) {
    async function handleSubmitRating() {
      setSubmitting(true)
      try {
        const updates: Record<string, unknown> = {}
        if (serviceRating > 0) {
          updates.customerRating = serviceRating
          updates.customerRatedAt = new Date()
        }
        if (driverRating > 0) {
          updates.driverRating = driverRating
        }
        if (feedback.trim()) {
          updates.customerFeedback = feedback.trim()
        }
        if (Object.keys(updates).length > 0) {
          await updateOrder(order.id, updates)
        }
        setSubmitted(true)
        setShowRatingPage(false)
      } catch {
        // allow retry
      } finally {
        setSubmitting(false)
      }
    }

    return (
      <div className="flex min-h-screen flex-col items-center bg-background px-6 py-8">
        {/* Logo */}
        <div className="mb-4">
          <img
            src="/placeholder-logo.png"
            alt="Sterlin Glams Logistics"
            className="h-32 w-auto"
          />
        </div>

        <h2 className="text-lg font-bold text-foreground">Sterlin Glams</h2>
        <button
          type="button"
          onClick={() => {
            setShowRatingPage(false)
            setSubmitted(true)
          }}
          className="mb-6 text-sm font-medium text-green-600 hover:underline"
        >
          Delivery details
        </button>

        {/* Overall service rating */}
        <div className="mb-2 flex items-center gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setServiceRating(i + 1)}
              className="transition-transform active:scale-110"
            >
              <Star
                className={`h-10 w-10 ${
                  i < serviceRating
                    ? "fill-yellow-400 text-yellow-400"
                    : "fill-yellow-400/20 text-yellow-400/40"
                }`}
              />
            </button>
          ))}
        </div>

        <div className="my-6 h-px w-full bg-border" />

        {/* Driver service rating */}
        <h3 className="mb-4 text-lg font-bold text-foreground">How was the driver service?</h3>

        <div className="mb-4 flex items-center gap-4">
          {/* Driver avatar */}
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted text-lg font-bold text-muted-foreground">
            {driver?.name?.split(" ").map((n) => n[0]).join("").slice(0, 2) ?? "D"}
          </div>
          <div className="flex-1">
            <p className="font-semibold text-foreground">{driver?.name ?? "Driver"}</p>
            <p className="text-xs text-muted-foreground">Your driver</p>
          </div>
          <div className="flex items-center gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setDriverRating(i + 1)}
                className="transition-transform active:scale-110"
              >
                <Star
                  className={`h-7 w-7 ${
                    i < driverRating
                      ? "fill-yellow-400 text-yellow-400"
                      : "fill-yellow-400/20 text-yellow-400/40"
                  }`}
                />
              </button>
            ))}
          </div>
        </div>

        <div className="my-4 h-px w-full bg-border" />

        {/* Feedback */}
        <textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="We always appreciate your feedback to make our service better."
          className="mb-6 w-full rounded-xl border bg-background p-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-green-500/50"
          rows={4}
        />

        {/* Submit */}
        <button
          type="button"
          disabled={submitting}
          onClick={handleSubmitRating}
          className="w-full rounded-xl bg-green-700 py-4 text-base font-semibold text-white hover:bg-green-800 disabled:opacity-60"
        >
          {submitting ? "Submitting..." : "Submit"}
        </button>
      </div>
    )
  }

  // ── Submitted thank you (briefly, then back to tracking) ──
  if (submitted && order.status === "delivered") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6">
        <div className="flex items-center gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              className={`h-8 w-8 ${
                i < (serviceRating || order.customerRating || 0)
                  ? "fill-yellow-400 text-yellow-400"
                  : "text-muted"
              }`}
            />
          ))}
        </div>
        <p className="text-lg font-semibold">Thank you for your feedback!</p>
        <button
          type="button"
          onClick={() => setSubmitted(false)}
          className="text-sm text-green-600 hover:underline"
        >
          View delivery details
        </button>
      </div>
    )
  }

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

          {order.status === "delivered" && (
            <div className="mt-4 rounded-2xl border border-[hsl(330,30%,86%)] bg-[hsl(330,45%,98%)] p-4">
              <div className="flex items-center gap-1 text-[hsl(330,82%,45%)]">
                {Array.from({ length: 5 }).map((_, index) => {
                  const filled = index < (order.customerRating ?? requestedRating ?? 0)
                  return (
                    <Star
                      key={index}
                      className={`h-4 w-4 ${filled ? "fill-current" : "text-[hsl(330,18%,75%)]"}`}
                    />
                  )
                })}
              </div>
              <p className="mt-2 text-sm font-medium text-foreground">
                {order.customerRating
                  ? `Customer rating: ${order.customerRating}/5`
                  : requestedRating
                    ? "Saving your rating..."
                    : "Rate your delivery from the email to save feedback."}
              </p>
              {ratingState === "saving" && (
                <p className="mt-1 text-xs text-muted-foreground">Syncing your rating to Firestore...</p>
              )}
              {ratingState === "saved" && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Thanks. Your rating was saved on {formatTime(order.customerRatedAt ?? new Date())}.
                </p>
              )}
              {ratingState === "error" && (
                <p className="mt-1 text-xs text-red-600">We could not save your rating. Refresh and try again.</p>
              )}
            </div>
          )}

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

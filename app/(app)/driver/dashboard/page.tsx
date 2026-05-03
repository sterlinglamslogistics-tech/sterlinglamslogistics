"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  MapPin,
  Phone,
  Navigation,
  Loader2,
  Menu,
  ScanLine,
  Truck,
  RefreshCw,
} from "lucide-react"
import { formatCurrency } from "@/lib/data"
import type { Order } from "@/lib/data"
import { toast } from "@/hooks/use-toast"
import { useDriver } from "@/components/driver-context"
import { driverFetch } from "@/lib/driver-client"
import Image from "next/image"

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    started: "bg-blue-500/15 text-blue-600 border-blue-500/20",
    "picked-up": "bg-primary/15 text-primary border-primary/20",
    "in-transit": "bg-warning/15 text-warning border-warning/20",
    delivered: "bg-success/15 text-success border-success/20",
    unassigned: "bg-muted-foreground/15 text-muted-foreground border-muted-foreground/20",
    failed: "bg-destructive/15 text-destructive border-destructive/20",
    cancelled: "bg-destructive/15 text-destructive border-destructive/20",
  }
  const labelMap: Record<string, string> = {
    started: "Started",
    "picked-up": "Picked Up",
    "in-transit": "In Transit",
    delivered: "Delivered",
    unassigned: "Unassigned",
    failed: "Failed",
    cancelled: "Cancelled",
  }
  return (
    <Badge variant="outline" className={map[status] ?? ""}>
      {labelMap[status] ?? status}
    </Badge>
  )
}

export default function DriverDashboard() {
  const router = useRouter()
  const {
    session,
    driver,
    orders,
    isOnline,
    justWentOnline,
    consumeJustWentOnline,
    loadingSession,
    loadingOrders,
    setDrawerOpen,
    goOnline,
    refreshOrders,
    optimizeRoute,
  } = useDriver()
  const [showOnlineToast, setShowOnlineToast] = useState(false)
  const [routeModalOpen, setRouteModalOpen] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null)
  const [pullDistance, setPullDistance] = useState(0)
  const touchStartY = useRef(0)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const PULL_THRESHOLD = 60
  // Optimize route flow: "check" | "confirm" | "choose-last" | "optimizing" | "done" | null
  const [optimizeStep, setOptimizeStep] = useState<"check" | "confirm" | "choose-last" | "optimizing" | "done" | null>(null)
  const [selectedLastStop, setSelectedLastStop] = useState<string | null>(null)
  const [optimizeResult, setOptimizeResult] = useState<boolean>(false)

  // Redirect to login if no session
  useEffect(() => {
    if (!loadingSession && !session) {
      router.replace("/driver")
    }
  }, [loadingSession, session, router])

  // Show "You are online" toast only once per Go Online action
  useEffect(() => {
    if (justWentOnline) {
      setShowOnlineToast(true)
      consumeJustWentOnline()
      const timer = setTimeout(() => setShowOnlineToast(false), 3000)
      return () => clearTimeout(timer)
    }
  }, [justWentOnline, consumeJustWentOnline])

  const handlePullRefresh = useCallback(async () => {
    setIsRefreshing(true)
    setPullDistance(0)
    await refreshOrders()
    // Keep spinner visible briefly so user sees it
    setTimeout(() => setIsRefreshing(false), 600)
  }, [refreshOrders])

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY
  }, [])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (isRefreshing) return
    const el = scrollContainerRef.current
    // Only allow pull when scrolled to the very top
    if (el && el.scrollTop > 0) return
    const diff = e.touches[0].clientY - touchStartY.current
    if (diff > 0) {
      setPullDistance(Math.min(diff * 0.5, 80))
    }
  }, [isRefreshing])

  const onTouchEnd = useCallback(() => {
    if (pullDistance >= PULL_THRESHOLD) {
      handlePullRefresh()
    } else {
      setPullDistance(0)
    }
  }, [pullDistance, handlePullRefresh])

  function handleNavigate(address: string) {
    const encoded = encodeURIComponent(address)
    window.location.href = `https://www.google.com/maps/dir/?api=1&destination=${encoded}`
  }

  function handleCall(phone: string) {
    window.location.href = `tel:${phone}`
  }

  async function handleMarkPickedUp(order: Order) {
    if (!session || pendingOrderId) return
    setPendingOrderId(order.id)
    try {
      const res = await driverFetch(`/api/driver/orders/${encodeURIComponent(order.id)}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driverId: session.id, status: "picked-up" }),
      })
      if (!res.ok) throw new Error("Failed to mark picked-up")
      await refreshOrders()
      toast({ title: "Picked up", description: `${order.orderNumber} marked as picked up.` })
    } catch {
      toast({ title: "Error", description: "Failed to update order.", variant: "destructive" })
    } finally {
      setPendingOrderId(null)
    }
  }

  async function handleMarkOnTheWay(order: Order) {
    if (!session || pendingOrderId) return
    setPendingOrderId(order.id)
    try {
      const res = await driverFetch(`/api/driver/orders/${encodeURIComponent(order.id)}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driverId: session.id, status: "in-transit" }),
      })
      if (!res.ok) throw new Error("Failed to mark in-transit")
      await refreshOrders()
      // Customer WhatsApp + SMS + email are dispatched server-side from the
      // /api/driver/orders/[orderId]/status route after the in-transit update.
      toast({ title: "In transit", description: `${order.orderNumber} is now on the way.` })
    } catch {
      toast({ title: "Error", description: "Failed to update order.", variant: "destructive" })
    } finally {
      setPendingOrderId(null)
    }
  }

  function handleViewOrder(order: Order) {
    router.push(`/driver/order/${order.id}`)
  }

  const activeOrders = orders.filter(
    (o) => o.status === "started" || o.status === "picked-up" || o.status === "in-transit"
  )

  if (loadingSession || !session) return null

  // Offline state - Welcome screen (Screenshot 1)
  if (!isOnline) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6">
        <div className="mb-6 flex h-28 w-28 items-center justify-center rounded-full bg-green-100 text-4xl font-bold text-green-700">
          {driver?.name?.charAt(0)?.toUpperCase() ?? "D"}
        </div>
        <h1 className="mb-1 text-2xl font-bold">
          Hello, {driver?.name?.split(" ")[0]?.toLowerCase() ?? "driver"}
        </h1>
        <p className="mb-2 text-sm text-muted-foreground">Welcome back</p>
        <p className="mb-8 text-center text-sm text-muted-foreground">
          Start taking orders
        </p>
        <button
          type="button"
          onClick={goOnline}
          className="rounded-full bg-green-600 px-16 py-4 text-base font-semibold text-white shadow-lg hover:bg-green-700 active:scale-95 transition-transform"
        >
          Go Online
        </button>
      </div>
    )
  }

  // Online state - Orders list (Screenshot 2)
  return (
    <div
      ref={scrollContainerRef}
      className="mx-auto max-w-md px-4 pb-8 h-[calc(100vh-80px)] overflow-y-auto"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Pull-to-refresh indicator */}
      <div
        className="flex justify-center overflow-hidden transition-all duration-200"
        style={{ height: isRefreshing ? 48 : pullDistance > 0 ? pullDistance : 0 }}
      >
        <div className="flex items-center justify-center py-2">
          <RefreshCw
            className={`h-6 w-6 text-muted-foreground ${isRefreshing ? "animate-spin" : ""}`}
            style={{
              transform: isRefreshing ? undefined : `rotate(${pullDistance * 3}deg)`,
              opacity: isRefreshing ? 1 : Math.min(pullDistance / PULL_THRESHOLD, 1),
            }}
          />
        </div>
      </div>
      {/* Header */}
      <div className="sticky top-0 z-40 flex items-center justify-between bg-background py-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="rounded-lg p-1.5 hover:bg-muted"
          >
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-bold">Orders</h1>
        </div>
        <div className="flex items-center gap-1">
          {activeOrders.length > 0 && (
            <button
              type="button"
              onClick={() => setRouteModalOpen(true)}
              className="rounded-lg p-2 hover:bg-muted"
              title="Route Options"
            >
              <Navigation className="h-5 w-5" />
            </button>
          )}
          <button type="button" className="rounded-lg p-2 hover:bg-muted">
            <ScanLine className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Online toast notification */}
      {showOnlineToast && (
        <div className="mb-3 rounded-xl bg-green-600 px-4 py-2.5 text-center text-sm font-medium text-white shadow-lg animate-in fade-in slide-in-from-top-2">
          You are online and accepting orders
        </div>
      )}

      {/* Orders list */}
      {loadingOrders ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : activeOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Truck className="mb-3 h-12 w-12 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No active orders</p>
          <p className="text-xs text-muted-foreground">New orders will appear here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {activeOrders.map((order) => (
            <div
              key={order.id}
              className="rounded-xl border bg-card p-4 shadow-sm"
            >
              <div className="mb-2 flex items-start justify-between">
                <div className="flex-1" onClick={() => handleViewOrder(order)}>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">{order.orderNumber}</p>
                    <StatusBadge status={order.status} />
                  </div>
                  <p className="text-sm text-muted-foreground">{order.customerName}</p>
                </div>
                {order.status !== "started" && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleNavigate(order.address)}
                      className="rounded-lg p-1.5 hover:bg-muted"
                    >
                      <Navigation className="h-4 w-4 text-blue-600" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCall(order.phone)}
                      className="rounded-lg p-1.5 hover:bg-muted"
                    >
                      <Phone className="h-4 w-4 text-green-600" />
                    </button>
                  </div>
                )}
              </div>

              <div className="mb-3 flex items-start gap-2 text-sm text-muted-foreground">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{order.address}</span>
              </div>

              {/* Action button */}
              {order.status === "started" && (
                <button
                  type="button"
                  disabled={pendingOrderId === order.id}
                  onClick={() => handleMarkPickedUp(order)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 py-3 text-sm font-semibold text-white hover:bg-orange-600 active:scale-[0.98] transition-transform disabled:opacity-60 disabled:pointer-events-none"
                >
                  {pendingOrderId === order.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Mark as Picked Up <span className="text-base">→</span></>}
                </button>
              )}
              {order.status === "picked-up" && (
                <button
                  type="button"
                  disabled={pendingOrderId === order.id}
                  onClick={() => handleMarkOnTheWay(order)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 active:scale-[0.98] transition-transform disabled:opacity-60 disabled:pointer-events-none"
                >
                  {pendingOrderId === order.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Mark as On the Way <span className="text-base">→</span></>}
                </button>
              )}
              {order.status === "in-transit" && (
                <button
                  type="button"
                  onClick={() => router.push(`/driver/delivery/${order.id}`)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 py-3 text-sm font-semibold text-white hover:bg-green-700 active:scale-[0.98] transition-transform"
                >
                  Complete Delivery
                  <span className="text-base">→</span>
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Route Options Modal */}
      {routeModalOpen && !optimizeStep && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/50"
            onClick={() => setRouteModalOpen(false)}
          />
          <div className="fixed inset-x-4 top-1/2 z-50 mx-auto max-w-sm -translate-y-1/2 rounded-2xl border-2 border-yellow-400 bg-background p-6 shadow-2xl">
            <h3 className="mb-5 text-center text-lg font-bold">Route Options</h3>
            <div className="space-y-3">
              <button
                type="button"
                className="w-full rounded-xl bg-green-600 py-3 text-sm font-semibold text-white hover:bg-green-700"
                onClick={() => {
                  toast({ title: "Picking up all orders..." })
                  setRouteModalOpen(false)
                }}
              >
                Pick Up all orders
              </button>
              <button
                type="button"
                className="w-full rounded-xl bg-green-600 py-3 text-sm font-semibold text-white hover:bg-green-700"
                onClick={() => {
                  // Start the optimize route flow
                  setRouteModalOpen(false)
                  const allPickedUp = activeOrders.every(
                    (o) => o.status === "picked-up" || o.status === "in-transit"
                  )
                  setOptimizeStep(allPickedUp ? "confirm" : "check")
                }}
              >
                Optimize Route
              </button>
              <button
                type="button"
                className="w-full rounded-xl bg-green-600 py-3 text-sm font-semibold text-white hover:bg-green-700"
                onClick={() => {
                  toast({ title: "Customers notified" })
                  setRouteModalOpen(false)
                }}
              >
                Notify Customers
              </button>
              <button
                type="button"
                className="w-full rounded-xl border-2 border-muted-foreground/30 py-3 text-sm font-semibold text-muted-foreground hover:bg-muted"
                onClick={() => setRouteModalOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </>
      )}

      {/* Optimize Step 1: "all orders must be picked up" */}
      {optimizeStep === "check" && (
        <>
          <div className="fixed inset-0 z-50 bg-black/50" />
          <div className="fixed inset-x-6 top-1/2 z-50 mx-auto max-w-sm -translate-y-1/2 rounded-2xl border-2 border-yellow-400 bg-background p-6 shadow-2xl">
            <p className="mb-6 text-center text-base font-semibold">
              For route optimization, all orders must be picked up
            </p>
            <button
              type="button"
              className="w-full rounded-xl bg-green-600 py-3 text-sm font-semibold text-white hover:bg-green-700"
              onClick={() => setOptimizeStep(null)}
            >
              OK
            </button>
          </div>
        </>
      )}

      {/* Optimize Step 2: "Do you want to re-optimize route?" */}
      {optimizeStep === "confirm" && (
        <>
          <div className="fixed inset-0 z-50 bg-black/50" />
          <div className="fixed inset-x-6 top-1/2 z-50 mx-auto max-w-sm -translate-y-1/2 rounded-2xl bg-background p-6 shadow-2xl">
            <p className="mb-6 text-center text-base font-semibold">
              Do you want to re-optimize route?
            </p>
            <div className="space-y-3">
              <button
                type="button"
                className="w-full rounded-xl bg-green-600 py-3 text-sm font-semibold text-white hover:bg-green-700"
                onClick={() => {
                  setSelectedLastStop(null)
                  setOptimizeStep("choose-last")
                }}
              >
                Yes
              </button>
              <button
                type="button"
                className="w-full rounded-xl border py-3 text-sm font-semibold text-foreground hover:bg-muted"
                onClick={() => setOptimizeStep(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      )}

      {/* Optimize Step 3: "Choose the last stop" bottom sheet */}
      {optimizeStep === "choose-last" && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/50"
            onClick={() => setOptimizeStep(null)}
          />
          <div className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-md animate-in slide-in-from-bottom-4">
            <div className="rounded-t-2xl bg-background px-5 pb-6 pt-4 shadow-2xl">
              <div className="mb-4 flex justify-center">
                <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
              </div>
              <h3 className="mb-4 text-center text-base font-bold">
                Choose the last stop (optional)
              </h3>
              <div className="mb-4 max-h-60 space-y-3 overflow-y-auto">
                {activeOrders.map((order) => (
                  <button
                    key={order.id}
                    type="button"
                    className="flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors hover:bg-muted"
                    onClick={() => setSelectedLastStop(order.id)}
                  >
                    <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-muted-foreground/40">
                      {selectedLastStop === order.id && (
                        <div className="h-3 w-3 rounded-full bg-green-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{order.address}</p>
                    </div>
                  </button>
                ))}
              </div>
              <div className="space-y-3">
                <button
                  type="button"
                  className="w-full rounded-xl border py-3 text-sm font-semibold text-foreground hover:bg-muted"
                  onClick={async () => {
                    setOptimizeStep("optimizing")
                    const ok = await optimizeRoute(selectedLastStop)
                    setOptimizeResult(ok)
                    setOptimizeStep("done")
                  }}
                >
                  Choose
                </button>
                <button
                  type="button"
                  className="w-full rounded-xl bg-green-600 py-3 text-sm font-semibold text-white hover:bg-green-700"
                  onClick={async () => {
                    setSelectedLastStop(null)
                    setOptimizeStep("optimizing")
                    const ok = await optimizeRoute(null)
                    setOptimizeResult(ok)
                    setOptimizeStep("done")
                  }}
                >
                  Skip
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Optimize Step 4: Optimizing in progress */}
      {optimizeStep === "optimizing" && (
        <>
          <div className="fixed inset-0 z-50 bg-black/50" />
          <div className="fixed inset-x-6 top-1/2 z-50 mx-auto max-w-sm -translate-y-1/2 rounded-2xl bg-background p-6 shadow-2xl">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-green-600" />
              <p className="text-center text-base font-semibold">
                Optimizing your route...
              </p>
            </div>
          </div>
        </>
      )}

      {/* Optimize Step 5: Done confirmation */}
      {optimizeStep === "done" && (
        <>
          <div className="fixed inset-0 z-50 bg-black/50" />
          <div className="fixed inset-x-6 top-1/2 z-50 mx-auto max-w-sm -translate-y-1/2 rounded-2xl border-2 border-yellow-400 bg-background p-6 shadow-2xl">
            <p className="mb-6 text-center text-base font-semibold">
              {optimizeResult ? "Route optimized! Orders resorted." : "Could not optimize route. Make sure orders have addresses."}
            </p>
            <button
              type="button"
              className="w-full rounded-xl bg-green-600 py-3 text-sm font-semibold text-white hover:bg-green-700"
              onClick={() => {
                setOptimizeStep(null)
              }}
            >
              OK
            </button>
          </div>
        </>
      )}
    </div>
  )
}

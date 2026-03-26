"use client"

import { useState, useEffect, useCallback } from "react"
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
} from "lucide-react"
import { updateOrder, updateDriver } from "@/lib/firestore"
import { formatCurrency } from "@/lib/data"
import type { Order } from "@/lib/data"
import { toast } from "@/hooks/use-toast"
import { notifyOrderEvent } from "@/lib/notify-client"
import { useDriver } from "@/components/driver-context"
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
    loadingSession,
    loadingOrders,
    setDrawerOpen,
    goOnline,
    refreshOrders,
  } = useDriver()
  const [showOnlineToast, setShowOnlineToast] = useState(false)
  const [routeModalOpen, setRouteModalOpen] = useState(false)

  // Redirect to login if no session
  useEffect(() => {
    if (!loadingSession && !session) {
      router.replace("/driver")
    }
  }, [loadingSession, session, router])

  // Show "You are online" toast when going online
  useEffect(() => {
    if (isOnline) {
      setShowOnlineToast(true)
      const timer = setTimeout(() => setShowOnlineToast(false), 3000)
      return () => clearTimeout(timer)
    }
  }, [isOnline])

  function handleNavigate(address: string) {
    const encoded = encodeURIComponent(address)
    window.location.href = `https://www.google.com/maps/dir/?api=1&destination=${encoded}`
  }

  function handleCall(phone: string) {
    window.location.href = `tel:${phone}`
  }

  async function handleMarkPickedUp(order: Order) {
    if (!session) return
    try {
      const pickedUpAt = new Date()
      await updateOrder(order.id, { status: "picked-up", pickedUpAt })
      await updateDriver(session.id, { status: "on-delivery" })
      await refreshOrders()
      toast({ title: "Picked up", description: `${order.orderNumber} marked as picked up.` })
    } catch {
      toast({ title: "Error", description: "Failed to update order.", variant: "destructive" })
    }
  }

  async function handleMarkOnTheWay(order: Order) {
    if (!session) return
    try {
      const inTransitAt = new Date()
      await updateOrder(order.id, { status: "in-transit", inTransitAt })
      await refreshOrders()
      notifyOrderEvent("out_for_delivery", {
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        customerPhone: order.phone,
        customerEmail: order.customerEmail,
        address: order.address,
        driverName: session?.name,
        items: order.items,
      })
      toast({ title: "In transit", description: `${order.orderNumber} is now on the way.` })
    } catch {
      toast({ title: "Error", description: "Failed to update order.", variant: "destructive" })
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
    <div className="mx-auto max-w-md px-4 pb-8">
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
                  onClick={() => handleMarkPickedUp(order)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 py-3 text-sm font-semibold text-white hover:bg-orange-600 active:scale-[0.98] transition-transform"
                >
                  Mark as Picked Up
                  <span className="text-base">→</span>
                </button>
              )}
              {order.status === "picked-up" && (
                <button
                  type="button"
                  onClick={() => handleMarkOnTheWay(order)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 active:scale-[0.98] transition-transform"
                >
                  Mark as On the Way
                  <span className="text-base">→</span>
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

      {/* Route Options Modal (Screenshot 4) */}
      {routeModalOpen && (
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
                  toast({ title: "Route optimized" })
                  setRouteModalOpen(false)
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
    </div>
  )
}

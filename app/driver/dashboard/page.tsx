"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import {
  MapPin,
  Phone,
  Navigation,
  CheckCircle2,
  Clock,
  Package,
  Loader2,
  Truck,
  RefreshCw,
} from "lucide-react"
import { fetchDriverById, fetchOrdersByDriver, updateOrder, updateDriver, updateDriverLocation } from "@/lib/firestore"
import { formatCurrency } from "@/lib/data"
import type { Order } from "@/lib/data"
import { toast } from "@/hooks/use-toast"
import { notifyOrderEvent } from "@/lib/notify-client"

interface DriverSession {
  id: string
  name: string
  phone: string
}

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
  const [session, setSession] = useState<DriverSession | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [isAvailable, setIsAvailable] = useState(false)
  const watchIdRef = useRef<number | null>(null)
  const [updatingAvailability, setUpdatingAvailability] = useState(false)

  // Check auth on mount
  useEffect(() => {
    const raw = localStorage.getItem("driverSession")
    if (!raw) {
      router.replace("/driver")
      return
    }
    const parsed = JSON.parse(raw) as DriverSession
    setSession(parsed)
  }, [router])

  const loadOrders = useCallback(async () => {
    if (!session) return
    try {
      const data = await fetchOrdersByDriver(session.id)
      // show active deliveries first
      const sorted = data.sort((a, b) => {
        const priority: Record<string, number> = {
          started: 0,
          "picked-up": 1,
          "in-transit": 2,
          delivered: 3,
          failed: 4,
          cancelled: 5,
          unassigned: 6,
        }
        return (priority[a.status] ?? 5) - (priority[b.status] ?? 5)
      })
      setOrders(sorted)
    } catch {
      toast({ title: "Error", description: "Failed to load deliveries.", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [session])

  useEffect(() => {
    if (session) loadOrders()
  }, [session, loadOrders])

  useEffect(() => {
    async function loadDriverAvailability() {
      if (!session) return
      const driver = await fetchDriverById(session.id)
      if (!driver) return
      setIsAvailable(driver.status === "available")
    }
    loadDriverAvailability()
  }, [session])

  // Auto-start GPS tracking as soon as the driver session is available
  useEffect(() => {
    if (!session) return
    if (!navigator.geolocation) return
    if (watchIdRef.current !== null) return // already watching

    watchIdRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        try {
          await updateDriverLocation(session.id, pos.coords.latitude, pos.coords.longitude)
        } catch {
          // silently ignore location push failures
        }
      },
      () => {
        // silently ignore GPS permission/unavailable errors
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    )

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
    }
  }, [session])

  async function handleRefresh() {
    setRefreshing(true)
    await loadOrders()
    setRefreshing(false)
  }

  function handleNavigate(address: string) {
    const encoded = encodeURIComponent(address)
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encoded}`, "_blank")
  }

  function handleCall(phone: string) {
    window.open(`tel:${phone}`)
  }

  async function handleMarkPickedUp(order: Order) {
    if (!session) return
    try {
      const pickedUpAt = new Date()
      await updateOrder(order.id, { status: "picked-up", pickedUpAt })
      await updateDriver(session.id, { status: "on-delivery" })
      setOrders((prev) =>
        prev.map((o) => (o.id === order.id ? { ...o, status: "picked-up", pickedUpAt } : o))
      )
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
      setOrders((prev) =>
        prev.map((o) => (o.id === order.id ? { ...o, status: "in-transit", inTransitAt } : o))
      )
      notifyOrderEvent("out_for_delivery", {
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        customerPhone: order.phone,
        customerEmail: order.customerEmail,
      })
      toast({ title: "In transit", description: `${order.orderNumber} is now on the way.` })
    } catch {
      toast({ title: "Error", description: "Failed to update order.", variant: "destructive" })
    }
  }

  async function handleMarkDelivered(order: Order) {
    router.push(`/driver/delivery/${order.id}`)
  }

  async function handleAvailabilityToggle(checked: boolean) {
    if (!session) return
    setUpdatingAvailability(true)
    try {
      await updateDriver(session.id, { status: checked ? "available" : "offline" })
      setIsAvailable(checked)
      toast({
        title: checked ? "You are now available" : "You are now offline",
        description: checked
          ? "Dispatch can now assign deliveries to you."
          : "You will not appear in available driver list.",
      })
    } catch {
      toast({ title: "Error", description: "Failed to update availability.", variant: "destructive" })
    } finally {
      setUpdatingAvailability(false)
    }
  }

  const activeOrders = orders.filter(
    (o) => o.status === "started" || o.status === "picked-up" || o.status === "in-transit"
  )
  const completedOrders = orders.filter((o) => o.status === "delivered")
  const hasTransitOrder = orders.some((o) => o.status === "in-transit")

  if (!session) return null

  return (
    <div className="mx-auto max-w-md px-4 pb-8">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between bg-background py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <Truck className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold">{session.name}</h1>
            <p className="text-xs text-muted-foreground">Driver</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Availability Toggle */}
      <div className="mb-4 flex items-center justify-between rounded-xl border bg-card px-4 py-3">
        <div>
          <p className="text-sm font-semibold">Availability</p>
          <p className="text-xs text-muted-foreground">
            {hasTransitOrder
              ? "Unavailable while delivery is in transit"
              : isAvailable
                ? "Visible to dispatch"
                : "Hidden from dispatch"}
          </p>
        </div>
        <Switch
          checked={isAvailable}
          disabled={updatingAvailability || hasTransitOrder}
          onCheckedChange={handleAvailabilityToggle}
          aria-label="Toggle availability"
        />
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-3 gap-3">
        <div className="rounded-xl border bg-card p-3 text-center">
          <Package className="mx-auto mb-1 h-5 w-5 text-blue-500" />
          <p className="text-2xl font-bold">{activeOrders.length}</p>
          <p className="text-xs text-muted-foreground">Active</p>
        </div>
        <div className="rounded-xl border bg-card p-3 text-center">
          <CheckCircle2 className="mx-auto mb-1 h-5 w-5 text-green-500" />
          <p className="text-2xl font-bold">{completedOrders.length}</p>
          <p className="text-xs text-muted-foreground">Delivered</p>
        </div>
        <div className="rounded-xl border bg-card p-3 text-center">
          <Clock className="mx-auto mb-1 h-5 w-5 text-orange-500" />
          <p className="text-2xl font-bold">{orders.length}</p>
          <p className="text-xs text-muted-foreground">Total</p>
        </div>
      </div>

      {/* Active Deliveries */}
      <div className="mb-6">
        <h2 className="mb-3 text-lg font-semibold">Active Deliveries</h2>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : activeOrders.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-card p-8 text-center">
            <Package className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No active deliveries</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeOrders.map((order) => (
              <div key={order.id} className="rounded-xl border bg-card p-4 shadow-sm">
                <div className="mb-2 flex items-start justify-between">
                  <div>
                    <p className="font-semibold">{order.orderNumber}</p>
                    <p className="text-sm text-muted-foreground">{order.customerName}</p>
                  </div>
                  <StatusBadge status={order.status} />
                </div>

                <div className="mb-3 space-y-1">
                  <div className="flex items-start gap-2 text-sm">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <span>{order.address}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{order.phone}</span>
                  </div>
                  <p className="text-sm font-medium">{formatCurrency(order.amount)}</p>
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => handleNavigate(order.address)}
                  >
                    <Navigation className="mr-1 h-3 w-3" /> Navigate
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => handleCall(order.phone)}
                  >
                    <Phone className="mr-1 h-3 w-3" /> Call
                  </Button>
                </div>

                <div className="mt-2">
                  {order.status === "started" ? (
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={() => handleMarkPickedUp(order)}
                    >
                      <Truck className="mr-1 h-3 w-3" /> Mark as Picked Up
                    </Button>
                  ) : order.status === "picked-up" ? (
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={() => handleMarkOnTheWay(order)}
                    >
                      <Navigation className="mr-1 h-3 w-3" /> Mark as On the Way
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="w-full bg-green-600 hover:bg-green-700"
                      onClick={() => handleMarkDelivered(order)}
                    >
                      <CheckCircle2 className="mr-1 h-3 w-3" /> Delivered
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Completed Deliveries */}
      {completedOrders.length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-semibold">Completed</h2>
          <div className="space-y-2">
            {completedOrders.map((order) => (
              <div key={order.id} className="flex items-center justify-between rounded-xl border bg-card p-3 opacity-75">
                <div>
                  <p className="text-sm font-medium">{order.orderNumber}</p>
                  <p className="text-xs text-muted-foreground">{order.customerName}</p>
                </div>
                <StatusBadge status={order.status} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

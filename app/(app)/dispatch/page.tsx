"use client"

import { useState, useEffect, useCallback } from "react"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { GripVertical } from "lucide-react"
import { fetchDrivers, fetchOrders, fetchDriversByStatus, updateOrder, saveOptimizedRouteOrder } from "@/lib/firestore"
import { formatCurrency } from "@/lib/data"
import type { Order, Driver } from "@/lib/data"
import { notifyOrderEvent } from "@/lib/notify-client"

/* ── helpers ─────────────────────────────────────────────── */

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, string> = {
    unassigned: "bg-warning/15 text-warning border-warning/20",
    started: "bg-primary/15 text-primary border-primary/20",
    "picked-up": "bg-blue-500/15 text-blue-600 border-blue-500/20",
    "in-transit": "bg-chart-2/15 text-chart-2 border-chart-2/20",
    delivered: "bg-success/15 text-success border-success/20",
    failed: "bg-destructive/15 text-destructive border-destructive/20",
    cancelled: "bg-destructive/15 text-destructive border-destructive/20",
  }

  const labelMap: Record<string, string> = {
    unassigned: "Unassigned",
    started: "Started",
    "picked-up": "Picked Up",
    "in-transit": "In Transit",
    delivered: "Delivered",
    failed: "Failed",
    cancelled: "Cancelled",
  }

  return (
    <Badge variant="outline" className={variants[status] ?? ""}>
      {labelMap[status] ?? status}
    </Badge>
  )
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

function formatTs(val: unknown): string {
  if (!val) return ""
  const d = val instanceof Date ? val : typeof val === "object" && "toDate" in (val as Record<string, unknown>) ? (val as { toDate(): Date }).toDate() : new Date(val as string)
  return d.toLocaleString("en-NG", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
}

/* ── timeline card ───────────────────────────────────────── */

function OrderTimeline({ order }: { order: Order }) {
  const pickupLabel = order.pickupName || "Pickup"
  const pickupAddr = order.pickupAddress || "—"
  const deliveryAddr = order.address || "—"

  return (
    <div className="relative flex gap-3 px-3 py-3">
      {/* dots + dashed line */}
      <div className="flex flex-col items-center pt-1">
        <span className="z-10 size-2.5 rounded-full bg-muted-foreground/50" />
        <span className="my-0.5 w-px flex-1 border-l border-dashed border-muted-foreground/30" />
        <span className="z-10 size-2.5 rounded-full bg-emerald-500" />
      </div>

      {/* text */}
      <div className="flex flex-1 flex-col gap-3 min-w-0">
        {/* pickup */}
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{pickupLabel}</p>
          <p className="truncate text-xs text-muted-foreground">{pickupAddr}</p>
          {order.startedAt ? <p className="mt-0.5 text-[11px] text-muted-foreground/70">{formatTs(order.startedAt)}</p> : null}
        </div>
        {/* delivery */}
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{order.customerName}</p>
          <p className="truncate text-xs text-muted-foreground">{deliveryAddr}</p>
          {order.deliveredAt ? <p className="mt-0.5 text-[11px] text-muted-foreground/70">{formatTs(order.deliveredAt)}</p> : null}
        </div>
      </div>
    </div>
  )
}

/* ── page ─────────────────────────────────────────────────── */

export default function DispatchPage() {
  const [orderList, setOrderList] = useState<Order[]>([])
  const [availableDrivers, setAvailableDrivers] = useState<Driver[]>([])
  const [allDrivers, setAllDrivers] = useState<Driver[]>([])
  const [selectedDrivers, setSelectedDrivers] = useState<Record<string, string>>({})
  const [activeDriverId, setActiveDriverId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)

  const loadAvailableDrivers = useCallback(async () => {
    const drivers = await fetchDriversByStatus("available")
    setAvailableDrivers(drivers)
  }, [])

  const loadAllDrivers = useCallback(async () => {
    const drivers = await fetchDrivers()
    setAllDrivers(drivers)
  }, [])

  useEffect(() => {
    async function loadData() {
      try {
        setIsLoading(true)
        const [orders, drivers, all] = await Promise.all([
          fetchOrders(),
          fetchDriversByStatus("available"),
          fetchDrivers(),
        ])
        setOrderList(orders)
        setAvailableDrivers(drivers)
        setAllDrivers(all)
        setError(null)
      } catch (err) {
        console.error("Error loading data:", err)
        setError("Failed to load data. Check your Firebase connection.")
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [])

  useEffect(() => {
    const id = window.setInterval(() => {
      loadAvailableDrivers().catch((err) => {
        console.error("Error refreshing available drivers:", err)
      })
      loadAllDrivers().catch((err) => {
        console.error("Error refreshing drivers:", err)
      })
    }, 10000)
    return () => window.clearInterval(id)
  }, [loadAvailableDrivers, loadAllDrivers])

  useEffect(() => {
    if (allDrivers.length === 0) {
      setActiveDriverId(null)
      return
    }

    if (!activeDriverId || !allDrivers.some((d) => d.id === activeDriverId)) {
      setActiveDriverId(allDrivers[0].id)
    }
  }, [allDrivers, activeDriverId])

  const pendingOrders = orderList.filter((o) => o.status === "unassigned")
  const assignedOrders = orderList
    .filter(
      (o) =>
        o.assignedDriver === activeDriverId &&
        o.status !== "unassigned" &&
        o.status !== "delivered" &&
        o.status !== "cancelled" &&
        o.status !== "failed"
    )
    .sort((a, b) => (a.routeOrder ?? Infinity) - (b.routeOrder ?? Infinity))

  function handleSelectDriver(orderId: string, driverId: string) {
    setSelectedDrivers((prev) => ({ ...prev, [orderId]: driverId }))
  }

  async function handleDispatch(orderId: string, preferredDriverId?: string) {
    const driverId = preferredDriverId ?? selectedDrivers[orderId]
    if (!driverId) return

    try {
      setIsSaving(true)
      const startedAt = new Date()
      const targetOrder = orderList.find((o) => o.id === orderId)
      await updateOrder(orderId, {
        assignedDriver: driverId,
        status: "started",
        startedAt,
      })

      setOrderList((prev) =>
        prev.map((order) =>
          order.id === orderId
            ? { ...order, assignedDriver: driverId, status: "started", startedAt }
            : order
        )
      )
      setSelectedDrivers((prev) => {
        const next = { ...prev }
        delete next[orderId]
        return next
      })

      if (targetOrder) {
        notifyOrderEvent("order_accepted", {
          orderId: targetOrder.id,
          orderNumber: targetOrder.orderNumber,
          customerName: targetOrder.customerName,
          customerPhone: targetOrder.phone,
          customerEmail: targetOrder.customerEmail,
        })
      }

      await loadAvailableDrivers()
    } catch (err) {
      console.error("Error dispatching order:", err)
      setError("Failed to dispatch order")
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDrop(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex) return
    const reordered = [...assignedOrders]
    const [moved] = reordered.splice(fromIndex, 1)
    reordered.splice(toIndex, 0, moved)
    const orderedIds = reordered.map((o) => o.id)
    // optimistic local update
    setOrderList((prev) => {
      const next = [...prev]
      for (let i = 0; i < orderedIds.length; i++) {
        const idx = next.findIndex((o) => o.id === orderedIds[i])
        if (idx !== -1) next[idx] = { ...next[idx], routeOrder: i }
      }
      return next
    })
    await saveOptimizedRouteOrder(orderedIds)
  }

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Dispatch</h1>
        <p className="mt-1 text-sm text-muted-foreground">Dispatch center for drivers and order assignment</p>
        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      </div>

      <div className="grid gap-0 rounded-lg border bg-card xl:grid-cols-[260px_1fr_1fr]">
        {/* ── Drivers sidebar ────────────────────────────── */}
        <div className="border-r">
          <div className="border-b px-4 py-3 text-lg font-semibold text-foreground">Drivers</div>
          <div className="max-h-[75vh] overflow-y-auto">
            {allDrivers.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">No drivers found.</p>
            ) : (
              allDrivers.map((driver) => {
                const isActive = activeDriverId === driver.id
                const activeCount = orderList.filter(
                  (o) =>
                    o.assignedDriver === driver.id &&
                    o.status !== "unassigned" &&
                    o.status !== "delivered" &&
                    o.status !== "cancelled" &&
                    o.status !== "failed"
                ).length

                return (
                  <button
                    key={driver.id}
                    onClick={() => setActiveDriverId(driver.id)}
                    className={`flex w-full items-center gap-3 border-l-[3px] px-3 py-3 text-left transition-colors ${
                      isActive
                        ? "border-l-emerald-500 bg-emerald-500/5"
                        : "border-l-transparent hover:bg-secondary/50"
                    }`}
                  >
                    <Avatar className="size-9 shrink-0">
                      <AvatarFallback className={isActive ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : ""}>
                        {getInitials(driver.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{driver.name}</p>
                    </div>
                    {activeCount > 0 && (
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-white">
                        {activeCount}
                      </span>
                    )}
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* ── Assigned orders ────────────────────────────── */}
        <div className="border-r">
          <div className="border-b px-4 py-3 text-lg font-semibold text-foreground">
            Assigned Orders
          </div>
          <div className="max-h-[75vh] space-y-3 overflow-y-auto p-3">
            {assignedOrders.length === 0 ? (
              <p className="px-1 py-4 text-sm text-muted-foreground">No active orders for this driver.</p>
            ) : (
              assignedOrders.map((order, idx) => (
                <div
                  key={order.id}
                  draggable
                  onDragStart={() => setDragIdx(idx)}
                  onDragOver={(e) => { e.preventDefault(); setDragOverIdx(idx) }}
                  onDragEnd={() => { setDragIdx(null); setDragOverIdx(null) }}
                  onDrop={() => { if (dragIdx !== null) handleDrop(dragIdx, idx); setDragIdx(null); setDragOverIdx(null) }}
                  className={`overflow-hidden rounded-lg border bg-background shadow-sm transition-opacity ${
                    dragIdx === idx ? "opacity-50" : ""
                  } ${dragOverIdx === idx && dragIdx !== idx ? "ring-2 ring-emerald-500/50" : ""}`}
                >
                  {/* card header */}
                  <div className="flex items-center gap-2 border-b px-3 py-2.5">
                    <StatusBadge status={order.status} />
                    <span className="text-sm font-semibold text-foreground">{order.orderNumber}</span>
                    <span className="ml-auto text-sm font-semibold text-foreground">{formatCurrency(order.amount)}</span>

                    <Select
                      value={selectedDrivers[order.id] ?? ""}
                      onValueChange={(value) => handleSelectDriver(order.id, value)}
                    >
                      <SelectTrigger className="h-7 w-[110px] text-xs">
                        <SelectValue placeholder="Reassign" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableDrivers.map((d) => (
                          <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <button
                      className="rounded-md px-2 py-1.5 text-muted-foreground hover:bg-secondary cursor-grab active:cursor-grabbing"
                      onMouseDown={(e) => e.currentTarget.closest("[draggable]")?.setAttribute("draggable", "true")}
                    >
                      <GripVertical className="size-4" />
                    </button>
                  </div>

                  {/* pickup → delivery timeline */}
                  <OrderTimeline order={order} />
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── Unassigned / New orders ────────────────────── */}
        <div>
          <div className="border-b px-4 py-3 text-lg font-semibold text-foreground">
            Unassigned Orders
          </div>
          <div className="max-h-[75vh] space-y-3 overflow-y-auto p-3">
            {pendingOrders.length === 0 ? (
              <p className="px-1 py-4 text-sm text-muted-foreground">No pending orders.</p>
            ) : (
              pendingOrders.map((order) => (
                <div key={order.id} className="overflow-hidden rounded-lg border bg-background shadow-sm">
                  {/* card header */}
                  <div className="flex items-center gap-2 border-b px-3 py-2.5">
                    <span className="text-sm font-semibold text-foreground">{order.orderNumber}</span>
                    <span className="ml-auto text-sm font-semibold text-foreground">{formatCurrency(order.amount)}</span>

                    <Select onValueChange={(value) => handleDispatch(order.id, value)}>
                      <SelectTrigger className="h-7 w-[110px] rounded-md border bg-emerald-500/10 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                        <SelectValue placeholder="+ Assign" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableDrivers.map((d) => (
                          <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* pickup → delivery timeline */}
                  <OrderTimeline order={order} />
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

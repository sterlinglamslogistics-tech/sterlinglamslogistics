"use client"

import { useState, useEffect, useCallback } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { MapPin, Send } from "lucide-react"
import { fetchDrivers, fetchOrders, fetchDriversByStatus, updateOrder } from "@/lib/firestore"
import { formatCurrency } from "@/lib/data"
import type { Order, Driver } from "@/lib/data"
import { notifyOrderEvent } from "@/lib/notify-client"

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

export default function DispatchPage() {
  const [orderList, setOrderList] = useState<Order[]>([])
  const [availableDrivers, setAvailableDrivers] = useState<Driver[]>([])
  const [allDrivers, setAllDrivers] = useState<Driver[]>([])
  const [selectedDrivers, setSelectedDrivers] = useState<Record<string, string>>({})
  const [activeDriverId, setActiveDriverId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  function getDriverDisplayName(driverId: string | null) {
    if (!driverId) return "Unassigned"
    return allDrivers.find((d) => d.id === driverId)?.name ?? "Unknown"
  }

  const pendingOrders = orderList.filter((o) => o.status === "unassigned")
  const assignedOrders = orderList.filter(
    (o) =>
      o.assignedDriver === activeDriverId &&
      o.status !== "unassigned" &&
      o.status !== "delivered" &&
      o.status !== "cancelled" &&
      o.status !== "failed"
  )

  const activeDriver = allDrivers.find((d) => d.id === activeDriverId) ?? null

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
        const assignedDriverObj = allDrivers.find((d) => d.id === driverId)
        notifyOrderEvent("order_accepted", {
          orderId: targetOrder.id,
          orderNumber: targetOrder.orderNumber,
          customerName: targetOrder.customerName,
          customerPhone: targetOrder.phone,
          customerEmail: targetOrder.customerEmail,
          address: targetOrder.address,
          driverName: assignedDriverObj?.name,
          items: targetOrder.items,
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

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner />
      </div>
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

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Dispatch
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Dispatch center for drivers and order assignment
        </p>
        {error && (
          <p className="mt-2 text-sm text-destructive">{error}</p>
        )}
      </div>

      <div className="grid gap-0 rounded-lg border bg-card xl:grid-cols-[280px_1fr_1fr]">
        {/* Sector 1: Drivers */}
        <div className="border-r">
          <div className="border-b px-4 py-3 text-xl font-semibold text-foreground">Drivers</div>
          <div className="max-h-[70vh] space-y-1 overflow-y-auto p-2">
            {allDrivers.length === 0 ? (
              <p className="px-2 py-3 text-sm text-muted-foreground">No drivers found in database.</p>
            ) : (
              allDrivers.map((driver) => {
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
                    className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left transition-colors ${
                      activeDriverId === driver.id ? "border-primary bg-primary/5" : "border-transparent hover:bg-secondary/60"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Avatar className="size-8">
                        <AvatarFallback>{getInitials(driver.name)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium text-foreground">{driver.name}</p>
                        <p className="text-xs text-muted-foreground">{driver.status.replace("-", " ")}</p>
                      </div>
                    </div>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-foreground">{activeCount}</span>
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* Sector 2: Assigned orders */}
        <div className="border-r">
          <div className="border-b px-4 py-3 text-xl font-semibold text-foreground">Assigned orders by driver</div>
          <div className="max-h-[70vh] space-y-3 overflow-y-auto p-3">
            {activeDriver && (
              <div className="rounded-md border bg-secondary/30 p-3">
                <p className="text-sm font-semibold text-foreground">{activeDriver.name}</p>
                <p className="text-xs text-muted-foreground">{activeDriver.phone}</p>
              </div>
            )}

            {assignedOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground">No assigned orders for selected driver.</p>
            ) : (
              assignedOrders.map((order) => (
                <div key={order.id} className="rounded-md border bg-background">
                  <div className="flex items-center justify-between border-b px-3 py-2">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={order.status} />
                      <p className="text-sm font-semibold text-foreground">{order.orderNumber}</p>
                    </div>
                    <p className="text-sm font-semibold text-foreground">{formatCurrency(order.amount)}</p>
                  </div>
                  <div className="space-y-2 px-3 py-3">
                    <p className="text-sm font-medium text-foreground">{order.customerName}</p>
                    <p className="flex items-start gap-2 text-xs text-muted-foreground">
                      <MapPin className="mt-0.5 h-3.5 w-3.5" /> {order.address}
                    </p>
                    <div className="flex items-center gap-2">
                      <Select
                        value={selectedDrivers[order.id] ?? order.assignedDriver ?? ""}
                        onValueChange={(value) => handleSelectDriver(order.id, value)}
                      >
                        <SelectTrigger className="h-8 flex-1 text-xs">
                          <SelectValue placeholder="Reassign driver" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableDrivers.map((driver) => (
                            <SelectItem key={driver.id} value={driver.id}>
                              {driver.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8"
                        disabled={!selectedDrivers[order.id] || isSaving}
                        onClick={() => handleDispatch(order.id)}
                      >
                        Reassign
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Sector 3: New/Pending orders */}
        <div>
          <div className="border-b px-4 py-3 text-xl font-semibold text-foreground">New Orders</div>
          <div className="max-h-[70vh] space-y-3 overflow-y-auto p-3">
            {pendingOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pending orders available.</p>
            ) : (
              pendingOrders.map((order) => (
                <div key={order.id} className="rounded-md border bg-background">
                  <div className="flex items-center justify-between border-b px-3 py-2">
                    <p className="text-sm font-semibold text-foreground">{order.orderNumber}</p>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">{formatCurrency(order.amount)}</p>
                      <Select onValueChange={(value) => handleDispatch(order.id, value)}>
                        <SelectTrigger className="h-8 w-[115px] rounded-md border bg-secondary/50 text-xs font-medium shadow-sm">
                          <SelectValue placeholder="+ Assign" />
                        </SelectTrigger>
                        <SelectContent className="shadow-xl">
                          {availableDrivers.map((driver) => (
                            <SelectItem key={driver.id} value={driver.id}>
                              {driver.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2 px-3 py-3">
                    <p className="text-sm font-medium text-foreground">{order.customerName}</p>
                    <p className="flex items-start gap-2 text-xs text-muted-foreground">
                      <MapPin className="mt-0.5 h-3.5 w-3.5" /> {order.address}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import {
  Package,
  Clock,
  Users,
  CheckCircle2,
  TrendingUp,
  ArrowUpRight,
} from "lucide-react"
import { fetchOrders, fetchDrivers } from "@/lib/firestore"
import { formatCurrency } from "@/lib/data"
import type { Order, Driver } from "@/lib/data"

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

function buildSummaryCards(orders: Order[], drivers: Driver[]) {
  return [
    {
      title: "Total Orders",
      value: orders.length.toString(),
      change: "+12%",
      icon: Package,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "Unassigned Orders",
      value: orders.filter((o) => o.status === "unassigned").length.toString(),
      change: "-3%",
      icon: Clock,
      color: "text-warning",
      bgColor: "bg-warning/10",
    },
    {
      title: "Assigned Drivers",
      value: drivers.filter((d) => d.status === "on-delivery").length.toString(),
      change: "+5%",
      icon: Users,
      color: "text-chart-2",
      bgColor: "bg-chart-2/10",
    },
    {
      title: "Completed Deliveries",
      value: orders.filter((o) => o.status === "delivered").length.toString(),
      change: "+18%",
      icon: CheckCircle2,
      color: "text-success",
      bgColor: "bg-success/10",
    },
  ]
}

export default function DashboardPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadData() {
      try {
        setIsLoading(true)
        const [ordersData, driversData] = await Promise.all([
          fetchOrders(),
          fetchDrivers(),
        ])
        setOrders(ordersData)
        setDrivers(driversData)
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

  const summaryCards = buildSummaryCards(orders, drivers)
  const recentOrders = orders.slice(0, 5)

  function getDriverDisplayName(driverId: string | null) {
    if (!driverId) return "Unassigned"
    return drivers.find((d) => d.id === driverId)?.name ?? "Unknown"
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
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Overview of your delivery operations
        </p>
        {error && (
          <p className="mt-2 text-sm text-destructive">{error}</p>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.title}
              </CardTitle>
              <div className={`flex size-9 items-center justify-center rounded-lg ${card.bgColor}`}>
                <card.icon className={`size-[18px] ${card.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-2">
                <span className="text-3xl font-bold text-foreground">{card.value}</span>
                <span className="mb-1 flex items-center text-xs font-medium text-success">
                  <TrendingUp className="mr-0.5 size-3" />
                  {card.change}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent activity */}
      <div className="grid gap-6 xl:grid-cols-3">
        {/* Recent orders */}
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Recent Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentOrders.length === 0 ? (
                <p className="text-sm text-muted-foreground">No orders yet. Add some to Firestore.</p>
              ) : (
                recentOrders.map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 p-3"
                >
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">
                        {order.orderNumber}
                      </span>
                      <StatusBadge status={order.status} />
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {order.customerName} &middot; {order.address.split(",")[0]}
                    </span>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-sm font-semibold text-foreground">
                      {formatCurrency(order.amount)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {getDriverDisplayName(order.assignedDriver)}
                    </span>
                  </div>
                </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Driver availability */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Driver Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {drivers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No drivers yet. Add some to Firestore.</p>
              ) : (
                drivers.map((driver) => {
                const statusColor: Record<string, string> = {
                  available: "bg-success",
                  "on-delivery": "bg-warning",
                  offline: "bg-muted-foreground",
                }
                return (
                  <div
                    key={driver.id}
                    className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                          {driver.name.split(" ").map((n) => n[0]).join("")}
                        </div>
                        <div
                          className={`absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border-2 border-card ${statusColor[driver.status]}`}
                        />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-foreground">{driver.name}</span>
                        <span className="text-xs text-muted-foreground capitalize">
                          {driver.status.replace("-", " ")}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <ArrowUpRight className="size-3" />
                      {driver.rating}
                    </div>
                  </div>
                )
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

"use client"

import { useEffect, useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import { Badge } from "@/components/ui/badge"
import {
  Package,
  CheckCircle2,
  Clock,
  XCircle,
  TrendingUp,
  Users,
  CalendarDays,
} from "lucide-react"
import { fetchOrders, fetchDrivers, fetchNotificationLogs } from "@/lib/firestore"
import type { Order, Driver, NotificationLog } from "@/lib/data"

type Period = "today" | "week" | "month" | "all"

const PERIOD_LABELS: Record<Period, string> = {
  today: "Today",
  week: "This Week",
  month: "This Month",
  all: "All Time",
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toDate(value: unknown): Date | null {
  if (!value) return null
  if (value instanceof Date) return value
  if (typeof value === "object" && value !== null && "toDate" in value) {
    return (value as { toDate: () => Date }).toDate()
  }
  return null
}

function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function periodStart(period: Period): Date | null {
  const now = new Date()
  if (period === "today") {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate())
  }
  if (period === "week") {
    const start = new Date(now)
    start.setDate(now.getDate() - now.getDay())
    start.setHours(0, 0, 0, 0)
    return start
  }
  if (period === "month") {
    return new Date(now.getFullYear(), now.getMonth(), 1)
  }
  return null
}

function filterOrders(orders: Order[], period: Period): Order[] {
  const start = periodStart(period)
  if (!start) return orders
  return orders.filter((o) => {
    const d = toDate(o.createdAt)
    return d !== null && d >= start
  })
}

interface DayRow {
  key: string
  label: string
  orders: number
  delivered: number
  revenue: number
}

function buildDailyBreakdown(orders: Order[], period: "week" | "month"): DayRow[] {
  const map = new Map<string, DayRow>()

  if (period === "week") {
    // Pre-fill all 7 days (Sun–Sat) so empty days still appear
    const now = new Date()
    for (let i = 0; i < 7; i++) {
      const d = new Date(now)
      d.setDate(now.getDate() - now.getDay() + i)
      d.setHours(0, 0, 0, 0)
      const key = localDateKey(d)
      map.set(key, {
        key,
        label: new Intl.DateTimeFormat("en-NG", { weekday: "short", month: "short", day: "numeric" }).format(d),
        orders: 0,
        delivered: 0,
        revenue: 0,
      })
    }
  }

  for (const order of orders) {
    const d = toDate(order.createdAt)
    if (!d) continue
    const key = localDateKey(d)
    const existing = map.get(key) ?? {
      key,
      label: new Intl.DateTimeFormat("en-NG", { month: "short", day: "numeric" }).format(d),
      orders: 0,
      delivered: 0,
      revenue: 0,
    }
    existing.orders++
    if (order.status === "delivered") {
      existing.delivered++
      existing.revenue += order.amount
    }
    map.set(key, existing)
  }

  return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key))
}

function buildStats(orders: Order[], drivers: Driver[]) {
  return [
    {
      title: "Total Orders",
      value: orders.length,
      icon: Package,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "Delivered",
      value: orders.filter((o) => o.status === "delivered").length,
      icon: CheckCircle2,
      color: "text-success",
      bgColor: "bg-success/10",
    },
    {
      title: "Unassigned",
      value: orders.filter((o) => o.status === "unassigned").length,
      icon: Clock,
      color: "text-warning",
      bgColor: "bg-warning/10",
    },
    {
      title: "Failed/Cancelled",
      value: orders.filter((o) => o.status === "failed" || o.status === "cancelled").length,
      icon: XCircle,
      color: "text-destructive",
      bgColor: "bg-destructive/10",
    },
    {
      title: "In Transit",
      value: orders.filter((o) => o.status === "in-transit").length,
      icon: TrendingUp,
      color: "text-chart-2",
      bgColor: "bg-chart-2/10",
    },
    {
      title: "Total Drivers",
      value: drivers.length,
      icon: Users,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
  ]
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
  }).format(amount)
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ReportsPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [notificationLogs, setNotificationLogs] = useState<NotificationLog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [period, setPeriod] = useState<Period>("all")

  useEffect(() => {
    async function loadData() {
      try {
        const [orderData, driverData, logData] = await Promise.all([
          fetchOrders(),
          fetchDrivers(),
          fetchNotificationLogs(15),
        ])
        setOrders(orderData)
        setDrivers(driverData)
        setNotificationLogs(logData)
      } finally {
        setIsLoading(false)
      }
    }
    loadData()
  }, [])

  const filteredOrders = useMemo(() => filterOrders(orders, period), [orders, period])

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner />
      </div>
    )
  }

  const stats = buildStats(filteredOrders, drivers)

  const deliveredCount = filteredOrders.filter((o) => o.status === "delivered").length
  const deliveryRate = filteredOrders.length
    ? Math.round((deliveredCount / filteredOrders.length) * 100)
    : 0

  const totalRevenue = filteredOrders
    .filter((o) => o.status === "delivered")
    .reduce((sum, o) => sum + o.amount, 0)

  const formatLogTime = (value: unknown) => {
    const date = toDate(value)
    if (!date) return "-"
    return new Intl.DateTimeFormat("en-NG", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date)
  }

  const eventLabel: Record<NotificationLog["event"], string> = {
    order_accepted: "Accepted",
    out_for_delivery: "Out for Delivery",
    delivered: "Delivered",
  }

  const channelBadge = (sent: boolean) =>
    sent
      ? "bg-success/15 text-success border-success/30"
      : "bg-muted text-muted-foreground border-border"

  const statusStyle = (status: string) => {
    if (status === "delivered") return "bg-success/10 text-success"
    if (status === "in-transit") return "bg-chart-2/10 text-chart-2"
    if (status === "failed" || status === "cancelled") return "bg-destructive/10 text-destructive"
    return "bg-warning/10 text-warning"
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header + period filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Reports</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Delivery statistics and performance overview
          </p>
        </div>

        <div className="flex self-start rounded-lg border border-border bg-muted/40 p-1 gap-1">
          {(["today", "week", "month", "all"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                period === p
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <div className={`flex size-9 items-center justify-center rounded-lg ${stat.bgColor}`}>
                <stat.icon className={`size-[18px] ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <span className="text-3xl font-bold text-foreground">{stat.value}</span>
              {period !== "all" && stat.title !== "Total Drivers" && (
                <p className="mt-1 text-xs text-muted-foreground">{PERIOD_LABELS[period]}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Delivery rate + Revenue */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Delivery Success Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3">
              <span className="text-4xl font-bold text-success">{deliveryRate}%</span>
              <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-success transition-all"
                  style={{ width: `${deliveryRate}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {deliveredCount} out of {filteredOrders.length} orders completed
                {period !== "all" && ` — ${PERIOD_LABELS[period].toLowerCase()}`}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Revenue from Delivered</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3">
              <span className="text-4xl font-bold text-foreground">
                {formatCurrency(totalRevenue)}
              </span>
              <p className="text-xs text-muted-foreground">
                Total revenue from delivered orders
                {period !== "all" && ` — ${PERIOD_LABELS[period].toLowerCase()}`}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* TODAY — order list */}
      {period === "today" && (
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-3">
            <CalendarDays className="size-4 text-muted-foreground" />
            <CardTitle className="text-base">Today&apos;s Orders</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground">No orders created today.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs text-muted-foreground">
                      <th className="pb-2 text-left font-medium">Order #</th>
                      <th className="pb-2 text-left font-medium">Customer</th>
                      <th className="pb-2 text-center font-medium">Status</th>
                      <th className="pb-2 text-right font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredOrders.map((order) => (
                      <tr key={order.id} className="hover:bg-muted/40 transition-colors">
                        <td className="py-2.5 pr-4 font-mono text-xs font-medium text-foreground">
                          #{order.orderNumber}
                        </td>
                        <td className="py-2.5 pr-4 text-foreground">{order.customerName}</td>
                        <td className="py-2.5 text-center">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusStyle(order.status)}`}>
                            {order.status}
                          </span>
                        </td>
                        <td className="py-2.5 text-right font-medium text-foreground">
                          {formatCurrency(order.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* WEEK / MONTH — day-by-day breakdown */}
      {(period === "week" || period === "month") && (
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-3">
            <CalendarDays className="size-4 text-muted-foreground" />
            <CardTitle className="text-base">
              {period === "week" ? "Day-by-Day Breakdown (This Week)" : "Daily Breakdown (This Month)"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filteredOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground">No orders in this period.</p>
            ) : (() => {
              const rows = buildDailyBreakdown(filteredOrders, period)
              return (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs text-muted-foreground">
                        <th className="pb-2 text-left font-medium">Date</th>
                        <th className="pb-2 text-center font-medium">Orders</th>
                        <th className="pb-2 text-center font-medium">Delivered</th>
                        <th className="pb-2 text-center font-medium">Rate</th>
                        <th className="pb-2 text-right font-medium">Revenue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {rows.map((row) => {
                        const rate = row.orders ? Math.round((row.delivered / row.orders) * 100) : 0
                        const rateColor =
                          row.orders === 0
                            ? "text-muted-foreground"
                            : rate >= 80
                            ? "text-success"
                            : rate >= 50
                            ? "text-warning"
                            : "text-destructive"
                        return (
                          <tr key={row.key} className="hover:bg-muted/40 transition-colors">
                            <td className="py-2.5 pr-4 font-medium text-foreground">{row.label}</td>
                            <td className="py-2.5 text-center text-foreground">{row.orders}</td>
                            <td className="py-2.5 text-center text-success">{row.delivered}</td>
                            <td className="py-2.5 text-center">
                              <span className={`text-xs font-medium ${rateColor}`}>
                                {row.orders === 0 ? "—" : `${rate}%`}
                              </span>
                            </td>
                            <td className="py-2.5 text-right font-medium text-foreground">
                              {row.revenue > 0 ? formatCurrency(row.revenue) : "—"}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-border font-semibold text-foreground">
                        <td className="pt-3 pr-4 text-sm">Total</td>
                        <td className="pt-3 text-center">{filteredOrders.length}</td>
                        <td className="pt-3 text-center text-success">{deliveredCount}</td>
                        <td className="pt-3 text-center text-xs font-medium">{deliveryRate}%</td>
                        <td className="pt-3 text-right">{formatCurrency(totalRevenue)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )
            })()}
          </CardContent>
        </Card>
      )}

      {/* Recent notification logs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Notification Logs</CardTitle>
        </CardHeader>
        <CardContent>
          {notificationLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No notification logs yet.</p>
          ) : (
            <div className="space-y-3">
              {notificationLogs.map((log) => (
                <div key={log.id} className="rounded-lg border border-border p-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {log.orderNumber} • {eventLabel[log.event]}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {log.customerName || "Customer"} ({log.customerPhone || "No phone"})
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">{formatLogTime(log.createdAt)}</p>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge variant="outline" className={channelBadge(log.sms.sent)}>
                      SMS: {log.sms.sent ? "Sent" : "Skipped/Failed"}
                    </Badge>
                    <Badge variant="outline" className={channelBadge(log.whatsapp.sent)}>
                      WhatsApp: {log.whatsapp.sent ? "Sent" : "Skipped/Failed"}
                    </Badge>
                    <Badge variant="outline" className={channelBadge(log.email.sent)}>
                      Email: {log.email.sent ? "Sent" : "Skipped/Failed"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

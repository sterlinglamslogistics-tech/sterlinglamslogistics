"use client"

import { useEffect, useState } from "react"
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
} from "lucide-react"
import { fetchOrders, fetchDrivers, fetchNotificationLogs } from "@/lib/firestore"
import type { Order, Driver, NotificationLog } from "@/lib/data"

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

export default function ReportsPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [notificationLogs, setNotificationLogs] = useState<NotificationLog[]>([])
  const [isLoading, setIsLoading] = useState(true)

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

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner />
      </div>
    )
  }

  const stats = buildStats(orders, drivers)
  const deliveryRate = orders.length
    ? Math.round((orders.filter((o) => o.status === "delivered").length / orders.length) * 100)
    : 0

  const totalRevenue = orders
    .filter((o) => o.status === "delivered")
    .reduce((sum, o) => sum + o.amount, 0)

  const toDate = (value: unknown): Date | null => {
    if (!value) return null
    if (value instanceof Date) return value
    if (typeof value === "object" && value !== null && "toDate" in value) {
      const maybeTs = value as { toDate: () => Date }
      return maybeTs.toDate()
    }
    return null
  }

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

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Reports
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Delivery statistics and performance overview
        </p>
      </div>

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
            </CardContent>
          </Card>
        ))}
      </div>

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
                {orders.filter((o) => o.status === "delivered").length} out of {orders.length} orders completed
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
                {new Intl.NumberFormat("en-NG", {
                  style: "currency",
                  currency: "NGN",
                  minimumFractionDigits: 0,
                }).format(totalRevenue)}
              </span>
              <p className="text-xs text-muted-foreground">
                Total revenue from successfully delivered orders
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

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
                <div
                  key={log.id}
                  className="rounded-lg border border-border p-3"
                >
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

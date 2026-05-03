"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, CheckCircle2, Loader2, Package } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { fetchOrdersByDriver } from "@/lib/firestore"
import type { Order } from "@/lib/data"
import { formatCurrency } from "@/lib/data"
import { toast } from "@/hooks/use-toast"
import { useDriver } from "@/components/driver-context"
import { cn } from "@/lib/utils"

function isToday(date: unknown): boolean {
  if (!date) return false
  const d = date instanceof Date ? date : new Date(date as string)
  if (Number.isNaN(d.getTime())) return false
  const now = new Date()
  return d.toDateString() === now.toDateString()
}

function isYesterday(date: unknown): boolean {
  if (!date) return false
  const d = date instanceof Date ? date : new Date(date as string)
  if (Number.isNaN(d.getTime())) return false
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  return d.toDateString() === yesterday.toDateString()
}

export default function DriverCompletedOrdersPage() {
  const router = useRouter()
  const { session } = useDriver()
  const [loading, setLoading] = useState(true)
  const [orders, setOrders] = useState<Order[]>([])
  const [tab, setTab] = useState<"today" | "yesterday">("today")

  useEffect(() => {
    async function loadCompletedOrders() {
      if (!session) return
      setLoading(true)
      try {
        const allOrders = await fetchOrdersByDriver(session.id)
        const completed = allOrders
          .filter((order) => order.status === "delivered")
          .sort((a, b) => {
            const aTime = a.deliveredAt ? new Date(a.deliveredAt as string).getTime() : 0
            const bTime = b.deliveredAt ? new Date(b.deliveredAt as string).getTime() : 0
            return bTime - aTime
          })
        setOrders(completed)
      } catch {
        toast({ title: "Error", description: "Failed to load completed orders.", variant: "destructive" })
      } finally {
        setLoading(false)
      }
    }

    loadCompletedOrders()
  }, [session])

  const todayOrders = orders.filter((o) => isToday(o.deliveredAt))
  const yesterdayOrders = orders.filter((o) => isYesterday(o.deliveredAt))
  const displayedOrders = tab === "today" ? todayOrders : yesterdayOrders

  return (
    <div className="mx-auto max-w-md px-4 pb-8">
      {/* Header */}
      <div className="sticky top-0 z-40 flex items-center gap-3 bg-background py-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-lg p-1.5 hover:bg-muted"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-bold">Completed Orders</h1>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex rounded-xl border bg-muted/50 p-1">
        <button
          type="button"
          onClick={() => setTab("today")}
          className={cn(
            "flex-1 rounded-lg py-2 text-sm font-medium transition-colors",
            tab === "today" ? "bg-background shadow-sm" : "text-muted-foreground"
          )}
        >
          Today ({todayOrders.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("yesterday")}
          className={cn(
            "flex-1 rounded-lg py-2 text-sm font-medium transition-colors",
            tab === "yesterday" ? "bg-background shadow-sm" : "text-muted-foreground"
          )}
        >
          Yesterday ({yesterdayOrders.length})
        </button>
      </div>

      {/* Orders list */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : displayedOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Package className="mb-3 h-16 w-16 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">
            There are currently no finished orders
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayedOrders.map((order) => (
            <div key={order.id} className="rounded-xl border bg-card p-4">
              <div className="mb-2 flex items-start justify-between">
                <div>
                  <p className="font-semibold">{order.orderNumber}</p>
                  <p className="text-sm text-muted-foreground">{order.customerName}</p>
                </div>
                <Badge variant="outline" className="bg-success/15 text-success border-success/20">
                  Delivered
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{order.address}</p>
              <p className="mt-1 text-sm font-medium">{formatCurrency(order.amount)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

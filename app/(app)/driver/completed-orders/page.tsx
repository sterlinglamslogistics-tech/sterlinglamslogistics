"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { fetchOrdersByDriver } from "@/lib/firestore"
import type { Order } from "@/lib/data"
import { formatCurrency } from "@/lib/data"
import { toast } from "@/hooks/use-toast"

interface DriverSession {
  id: string
  name: string
  phone: string
}

export default function DriverCompletedOrdersPage() {
  const router = useRouter()
  const [session, setSession] = useState<DriverSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [orders, setOrders] = useState<Order[]>([])

  useEffect(() => {
    const raw = localStorage.getItem("driverSession")
    if (!raw) {
      router.replace("/driver")
      return
    }
    setSession(JSON.parse(raw) as DriverSession)
  }, [router])

  useEffect(() => {
    async function loadCompletedOrders() {
      if (!session) return
      setLoading(true)
      try {
        const allOrders = await fetchOrdersByDriver(session.id)
        const completed = allOrders
          .filter((order) => order.status === "delivered")
          .sort((a, b) => {
            const aTime = a.deliveredAt ? new Date(a.deliveredAt as unknown as string).getTime() : 0
            const bTime = b.deliveredAt ? new Date(b.deliveredAt as unknown as string).getTime() : 0
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

  if (!session) return null

  return (
    <div className="mx-auto max-w-md px-4 pb-8 pt-4">
      <div className="mb-4">
        <h1 className="text-xl font-bold">Completed Orders</h1>
        <p className="text-sm text-muted-foreground">All successfully delivered orders.</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card p-8 text-center">
          <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No completed orders yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
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

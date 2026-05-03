"use client"

import { useState, useEffect, use } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  Navigation,
  Phone,
  MapPin,
  Clock,
  Loader2,
  Star,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { fetchOrder } from "@/lib/firestore"
import { formatCurrency } from "@/lib/data"
import type { Order } from "@/lib/data"
import { useDriver } from "@/components/driver-context"

function formatDate(date: unknown): string {
  if (!date) return ""
  const d = date instanceof Date ? date : new Date(date as string)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export default function OrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>
}) {
  const { orderId } = use(params)
  const router = useRouter()
  const { isOnline } = useDriver()
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchOrder(orderId).then((o) => {
      setOrder(o)
      setLoading(false)
    })
  }, [orderId])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!order) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
        <p className="text-muted-foreground">Order not found</p>
        <button
          type="button"
          onClick={() => router.push("/driver/dashboard")}
          className="rounded-xl bg-green-600 px-6 py-2 text-sm font-semibold text-white"
        >
          Go Back
        </button>
      </div>
    )
  }

  const statusLabel =
    order.status === "started"
      ? "Started"
      : order.status === "picked-up"
        ? "Picked Up"
        : order.status === "in-transit"
          ? "In Transit"
          : order.status === "delivered"
            ? "Delivered"
            : order.status

  const itemsTotal = order.items?.reduce((sum, item) => {
    const qty = item.qty ?? 1
    const price = item.price ?? 0
    return sum + qty * price
  }, 0) ?? 0

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
        <h1 className="flex-1 text-lg font-bold">Order Details</h1>
        {isOnline && (
          <span className="rounded-full bg-green-100 px-3 py-0.5 text-xs font-semibold text-green-700">
            ONLINE
          </span>
        )}
      </div>

      {/* Order header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-lg font-bold">{order.orderNumber}</p>
            <Badge variant="outline" className="bg-blue-500/15 text-blue-600 border-blue-500/20 text-xs">
              {statusLabel}
            </Badge>
          </div>
          <p className="text-lg font-bold text-green-600">{formatCurrency(order.amount)}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            const encoded = encodeURIComponent(order.address)
            window.location.href = `https://www.google.com/maps/dir/?api=1&destination=${encoded}`
          }}
          className="rounded-lg p-2 hover:bg-muted"
        >
          <Navigation className="h-5 w-5 text-blue-600" />
        </button>
      </div>

      {/* Placement time */}
      {!!order.createdAt && (
        <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span>Placed {formatDate(order.createdAt)}</span>
        </div>
      )}

      {/* Pick up section */}
      <div className="mb-4 rounded-xl border bg-card p-4">
        <div className="mb-3 flex items-start gap-3">
          <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600">
            <div className="h-2 w-2 rounded-full bg-white" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-muted-foreground">PICK UP</p>
            {!!order.startedAt && (
              <p className="text-sm text-muted-foreground">{formatDate(order.startedAt)}</p>
            )}
            <p className="mt-1 font-semibold">Sterlin Glams</p>
            <p className="text-sm text-muted-foreground">Store pickup location</p>
          </div>
        </div>

        <div className="ml-3 border-l-2 border-dashed border-muted-foreground/30 pl-6 py-2" />

        {/* Delivery section */}
        <div className="flex items-start gap-3">
          <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-600">
            <MapPin className="h-3 w-3 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-muted-foreground">DELIVERY</p>
            {!!order.deliveredAt && (
              <p className="text-sm text-muted-foreground">{formatDate(order.deliveredAt)}</p>
            )}
            <p className="mt-1 font-semibold">{order.customerName}</p>
            <p className="text-sm text-muted-foreground">{order.address}</p>
            <button
              type="button"
              onClick={() => { window.location.href = `tel:${order.phone}` }}
              className="mt-1 flex items-center gap-1 text-sm text-green-600"
            >
              <Phone className="h-3.5 w-3.5" />
              {order.phone}
            </button>
          </div>
        </div>
      </div>

      {/* Order Items */}
      {order.items && order.items.length > 0 && (
        <div className="mb-4 rounded-xl border bg-card p-4">
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Order Items
          </h3>
          <div className="space-y-2">
            {order.items.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded bg-green-100 text-xs font-bold text-green-700">
                    {item.qty ?? 1}
                  </span>
                  <span className="text-sm">{item.name}</span>
                </div>
                {item.price != null && (
                  <span className="text-sm font-medium">{formatCurrency(item.price)}</span>
                )}
              </div>
            ))}
          </div>

          {/* Pricing breakdown */}
          <div className="mt-4 space-y-2 border-t pt-3">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Items Total</span>
              <span>{formatCurrency(itemsTotal)}</span>
            </div>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Tax</span>
              <span>{formatCurrency(0)}</span>
            </div>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Delivery Fee</span>
              <span>{formatCurrency(0)}</span>
            </div>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Delivery Tips</span>
              <span>{formatCurrency(0)}</span>
            </div>
            <div className="flex justify-between border-t pt-2 text-sm font-bold">
              <span>Total</span>
              <span>{formatCurrency(order.amount)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Customer Rating */}
      {order.status === "delivered" && (order.customerRating || order.driverRating) && (
        <div className="mb-4 rounded-xl border bg-card p-4">
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Customer Rating
          </h3>
          {order.driverRating != null && order.driverRating > 0 && (
            <div className="mb-3">
              <p className="mb-1 text-sm font-medium text-foreground">Driver rating</p>
              <div className="flex items-center gap-1">
                {Array.from({ length: 5 }, (_, i) => (
                  <Star
                    key={i}
                    className={`h-5 w-5 ${
                      i < order.driverRating!
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-muted-foreground/30"
                    }`}
                  />
                ))}
                <span className="ml-2 text-sm font-semibold text-foreground">{order.driverRating}/5</span>
              </div>
            </div>
          )}
          {order.customerRating != null && order.customerRating > 0 && (
            <div className="mb-3">
              <p className="mb-1 text-sm font-medium text-foreground">Order rating</p>
              <div className="flex items-center gap-1">
                {Array.from({ length: 5 }, (_, i) => (
                  <Star
                    key={i}
                    className={`h-5 w-5 ${
                      i < order.customerRating!
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-muted-foreground/30"
                    }`}
                  />
                ))}
                <span className="ml-2 text-sm font-semibold text-foreground">{order.customerRating}/5</span>
              </div>
            </div>
          )}
          {order.customerFeedback && (
            <div>
              <p className="mb-1 text-sm font-medium text-foreground">Feedback</p>
              <p className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground italic">
                &ldquo;{order.customerFeedback}&rdquo;
              </p>
            </div>
          )}
        </div>
      )}

      {order.status === "delivered" && !order.customerRating && !order.driverRating && (
        <div className="mb-4 rounded-xl border border-dashed bg-card p-4 text-center">
          <Star className="mx-auto mb-2 h-6 w-6 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No customer rating yet</p>
        </div>
      )}
    </div>
  )
}

"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import type { Order, Driver } from "@/lib/data"
import { fetchDrivers, fetchOrder, deleteOrder } from "@/lib/firestore"
import { formatCurrency } from "@/lib/data"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import { MoreHorizontal, Download, Printer, Trash2 } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { Spinner } from "@/components/ui/spinner"

// replicate status badge from other pages
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
    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${variants[status] ?? ""}`}>
      {labelMap[status] ?? status}
    </span>
  )
}

export default function OrderDetailPage() {
  const params = useParams()
  const orderId = params?.orderId as string
  const [order, setOrder] = useState<Order | null>(null)
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    setLoading(true)
    Promise.all([fetchOrder(orderId), fetchDrivers()])
      .then(([o, d]) => {
        setOrder(o)
        setDrivers(d)
      })
      .finally(() => setLoading(false))
  }, [orderId])

  function getDriverDisplayName(driverId: string | null) {
    if (!driverId) return "Unassigned"
    return drivers.find((d) => d.id === driverId)?.name ?? "Unknown"
  }

  async function handleDelete() {
    if (!order) return
    try {
      await deleteOrder(order.id)
      toast({ title: "Order deleted" })
      router.push("/orders")
    } catch (e) {
      console.error(e)
      toast({ title: "Failed to delete order", variant: "destructive" })
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner />
      </div>
    )
  }

  if (!order) {
    return <p className="p-4">Order not found.</p>
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            ← Back
          </Button>
          <div>
            <h2 className="text-xl font-bold">Order #: {order.orderNumber}</h2>
            <StatusBadge status={order.status} />
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent sideOffset={4} align="end">
            <DropdownMenuItem onSelect={() => window.print()}>
              <Download className="mr-2 h-4 w-4" />
              Download PDF
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => window.print()}>
              <Printer className="mr-2 h-4 w-4" />
              Print order
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onSelect={handleDelete}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="space-y-2">
        <p>
          <span className="font-semibold">Customer:</span> {order.customerName}
        </p>
        <p>
          <span className="font-semibold">Phone:</span> {order.phone}
        </p>
        <p>
          <span className="font-semibold">Address:</span> {order.address}
        </p>
        <p>
          <span className="font-semibold">Amount:</span> {formatCurrency(order.amount)}
        </p>
        <p>
          <span className="font-semibold">Driver:</span>{" "}
          {getDriverDisplayName(order.assignedDriver)}
        </p>
      </div>
    </div>
  )
}

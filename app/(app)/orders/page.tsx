"use client"

import { useState, useEffect, useRef } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Plus, Edit, MoreHorizontal, Printer, Trash2, Send, UserPlus, MapPin, FileText, Barcode, Ban, UserPlus2 } from "lucide-react"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { fetchOrders, fetchDriversByStatus, updateOrder, createOrder, deleteOrder, fetchDrivers } from "@/lib/firestore"
import { formatCurrency } from "@/lib/data"
import type { Order, Driver } from "@/lib/data"
import { toast } from "@/hooks/use-toast"
import { notifyOrderEvent } from "@/lib/notify-client"
import { loadGoogleMaps } from "@/lib/google-maps"
import { StatusBadge } from "@/components/orders/status-badge"
import { OrderDetailDialog } from "@/components/orders/order-detail-dialog"
import { ReassignDialog } from "@/components/orders/reassign-dialog"
import { BulkAssignDialog } from "@/components/orders/bulk-assign-dialog"
import { formatOrderTime, formatDistance, handlePrintOrder, handlePrintLabel } from "@/lib/order-utils"
import { ORDER_STATUS, DRIVER_STATUS, ACTIVE_STATUSES, TERMINAL_STATUSES } from "@/lib/constants"

type OrderTab = "current" | "completed" | "incomplete" | "history"

const UNASSIGNED_DRIVER = "unassigned" as const

const orderFormSchema = z.object({
  orderNumber: z.string().min(1, "Order number is required"),
  pickupName: z.string().min(1, "Pickup name is required"),
  pickupPhone: z.string().min(1, "Pickup phone is required"),
  pickupAddress: z.string().min(1, "Pickup address is required"),
  pickupTime: z.string().min(1, "Pickup time is required"),
  customerName: z.string().min(1, "Customer name is required"),
  phone: z.string().min(1, "Phone number is required"),
  customerEmail: z
    .string()
    .trim()
    .email("Enter a valid email")
    .optional()
    .or(z.literal("")),
  address: z.string().min(1, "Address is required"),
  deliveryDate: z.string().min(1, "Delivery date is required"),
  deliveryTime: z.string().min(1, "Delivery time is required"),
  items: z.array(z.object({
    name: z.string(),
    price: z.number(),
    qty: z.number(),
    meta: z.string().optional(),
  })).optional(),
  taxRate: z.number().optional(),
  deliveryFees: z.number().optional(),
  deliveryTips: z.number().optional(),
  discount: z.number().optional(),
  deliveryInstruction: z.string().optional(),
  paymentMethod: z.string().optional(),
  assignedDriver: z.string().optional(),
})

type OrderFormData = z.infer<typeof orderFormSchema>

export default function OrdersPage() {
  const [orderList, setOrderList] = useState<Order[]>([])
  const [availableDrivers, setAvailableDrivers] = useState<Driver[]>([])
  const [allDrivers, setAllDrivers] = useState<Driver[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingOrder, setEditingOrder] = useState<Order | null>(null)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [activeTab, setActiveTab] = useState<OrderTab>("current")
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([])
  const [isBulkAssignOpen, setIsBulkAssignOpen] = useState(false)
  const [bulkDriverId, setBulkDriverId] = useState<string>(UNASSIGNED_DRIVER)
  const [reassignOrderId, setReassignOrderId] = useState<string | null>(null)

  const [addressSuggestions, setAddressSuggestions] = useState<Array<{ display_name: string; lat: string; lon: string; placeId?: string }>>([])
  const [addressSearching, setAddressSearching] = useState(false)
  const [addressPreviewCoord, setAddressPreviewCoord] = useState<{ lat: number; lng: number } | null>(null)
  const addressDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const autocompleteServiceRef = useRef<google.maps.places.AutocompleteService | null>(null)
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null)
  const placesContainerRef = useRef<HTMLDivElement | null>(null)

  const form = useForm<OrderFormData>({
    resolver: zodResolver(orderFormSchema),
    defaultValues: {
      orderNumber: "",
      pickupName: "Sterlin Glams",
      pickupPhone: "+234 9160009893",
      pickupAddress: "Sterlin Glams – Ikota Ajah Lagos",
      pickupTime: "",
      customerName: "",
      phone: "",
      customerEmail: "",
      address: "",
      deliveryDate: new Date().toISOString().split("T")[0],
      deliveryTime: "",
      items: [{ name: "", price: 0, qty: 1, meta: "" }],
      taxRate: 0,
      deliveryFees: 0,
      deliveryTips: 0,
      discount: 0,
      deliveryInstruction: "",
      paymentMethod: "",
      assignedDriver: "",
    },
  })

  useEffect(() => {
    async function loadData() {
      try {
        setIsLoading(true)
        const [ordersData, availableDriversData, allDriversData] = await Promise.all([
          fetchOrders(),
          fetchDriversByStatus(DRIVER_STATUS.AVAILABLE),
          fetchDrivers(),
        ])
        setOrderList(ordersData)
        setAvailableDrivers(availableDriversData)
        setAllDrivers(allDriversData)
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
    if (isLoading || orderList.length === 0) return

    const HUB = {
      lat: Number(process.env.NEXT_PUBLIC_HUB_LAT) || 6.4642667,
      lng: Number(process.env.NEXT_PUBLIC_HUB_LNG) || 3.5554814,
    }

    function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
      const toRad = (v: number) => (v * Math.PI) / 180
      const dLat = toRad(b.lat - a.lat)
      const dLng = toRad(b.lng - a.lng)
      const h =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
      return Number((6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))).toFixed(2))
    }

    const missing = orderList.filter(
      (o) => (typeof o.distanceKm !== "number" || Number.isNaN(o.distanceKm)) && o.address?.trim()
    )
    if (missing.length === 0) return

    let cancelled = false

    async function backfillDistances() {
      try {
        await loadGoogleMaps()
        const geocoder = new google.maps.Geocoder()

        for (const order of missing) {
          if (cancelled) break
          try {
            const result = await new Promise<google.maps.GeocoderResult[] | null>((resolve) => {
              geocoder.geocode(
                { address: order.address, region: "NG" },
                (results, status) => {
                  if (status === google.maps.GeocoderStatus.OK && results?.length) {
                    resolve(results)
                  } else {
                    resolve(null)
                  }
                }
              )
            })
            if (!result) continue

            const loc = result[0].geometry.location
            const distanceKm = haversineKm(HUB, { lat: loc.lat(), lng: loc.lng() })

            if (!cancelled) {
              setOrderList((prev) =>
                prev.map((o) => (o.id === order.id ? { ...o, distanceKm } : o))
              )
              updateOrder(order.id, { distanceKm } as Partial<Order>).catch(() => {})
            }
          } catch {
            // skip this order
          }
        }
      } catch {
        // Google Maps not available, skip
      }
    }

    backfillDistances()
    return () => { cancelled = true }
  }, [isLoading, orderList.length])

  async function handleAssignDriver(orderId: string, driverId: string) {
    try {
      setIsSaving(true)
      const startedAt = new Date()
      const targetOrder = orderList.find((o) => o.id === orderId)
      await updateOrder(orderId, {
        assignedDriver: driverId,
        status: ORDER_STATUS.STARTED,
        startedAt,
      })

      setOrderList((prev) =>
        prev.map((order) =>
          order.id === orderId
            ? { ...order, assignedDriver: driverId, status: ORDER_STATUS.STARTED, startedAt }
            : order
        )
      )

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
    } catch (err) {
      console.error("Error assigning driver:", err)
      setError("Failed to assign driver")
    } finally {
      setIsSaving(false)
    }
  }

  function getDriverDisplayName(driverId: string | null) {
    if (!driverId) return "Unassigned"
    const fromFirestore = allDrivers.find((d) => d.id === driverId)
    if (fromFirestore) return fromFirestore.name
    return "Unknown"
  }

  function openNewOrderDialog() {
    setEditingOrder(null)
    form.reset({
      orderNumber: "",
      pickupName: "Sterlin Glams",
      pickupPhone: "+234 9160009893",
      pickupAddress: "Sterlin Glams – Ikota Ajah Lagos",
      pickupTime: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
      customerName: "",
      phone: "",
      customerEmail: "",
      address: "",
      deliveryDate: new Date().toISOString().split("T")[0],
      deliveryTime: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
      items: [{ name: "", price: 0, qty: 1, meta: "" }],
      taxRate: 0,
      deliveryFees: 0,
      deliveryTips: 0,
      discount: 0,
      deliveryInstruction: "",
      paymentMethod: "",
      assignedDriver: UNASSIGNED_DRIVER,
    })
    setAddressSuggestions([])
    setAddressPreviewCoord(null)
    setIsDialogOpen(true)
  }

  function openEditOrderDialog(order: Order) {
    setEditingOrder(order)
    form.reset({
      orderNumber: order.orderNumber,
      pickupName: order.pickupName ?? "Sterlin Glams",
      pickupPhone: order.pickupPhone ?? "+234 9160009893",
      pickupAddress: order.pickupAddress ?? "Sterlin Glams – Ikota Ajah Lagos",
      pickupTime: order.pickupTime ?? "",
      customerName: order.customerName,
      phone: order.phone,
      customerEmail: order.customerEmail ?? "",
      address: order.address,
      deliveryDate: order.deliveryDate ?? "",
      deliveryTime: order.deliveryTime ?? "",
      items: order.items?.length ? order.items.map(i => ({ name: i.name, price: i.price ?? 0, qty: i.qty ?? 1, meta: i.meta ?? "" })) : [{ name: "", price: 0, qty: 1, meta: "" }],
      taxRate: order.taxRate ?? 0,
      deliveryFees: order.deliveryFees ?? 0,
      deliveryTips: order.deliveryTips ?? 0,
      discount: order.discount ?? 0,
      deliveryInstruction: order.deliveryInstruction ?? "",
      paymentMethod: order.paymentMethod ?? "",
      assignedDriver: order.assignedDriver ?? UNASSIGNED_DRIVER,
    })
    setAddressSuggestions([])
    setAddressPreviewCoord(null)
    setIsDialogOpen(true)
  }

  async function handleDeleteOrder(orderId: string) {
    try {
      await deleteOrder(orderId)
      setOrderList((prev) => prev.filter((o) => o.id !== orderId))
      setSelectedOrderIds((prev) => prev.filter((id) => id !== orderId))
      if (selectedOrder?.id === orderId) {
        setSelectedOrder(null)
      }
      toast({ title: "Order deleted" })
    } catch (err) {
      console.error("Error deleting order:", err)
      toast({ title: "Failed to delete order", variant: "destructive" })
    }
  }

  function computeTotals(data: OrderFormData) {
    const validItems = (data.items ?? []).filter(i => i.name.trim())
    const subtotal = validItems.reduce((s, i) => s + (i.price * i.qty), 0)
    const taxRate = data.taxRate ?? 0
    const tax = Math.round(subtotal * taxRate) / 100
    const deliveryFees = data.deliveryFees ?? 0
    const deliveryTips = data.deliveryTips ?? 0
    const discount = data.discount ?? 0
    const total = subtotal + tax + deliveryFees + deliveryTips - discount
    return { subtotal, tax, total: Math.max(total, 0), validItems }
  }

  async function onSubmit(data: OrderFormData) {
    try {
      setIsSaving(true)
      const { subtotal, tax, total, validItems } = computeTotals(data)

      if (editingOrder) {
        const normalizedCustomerEmail = data.customerEmail?.trim() ? data.customerEmail.trim() : null
        const nextAssignedDriver =
          data.assignedDriver === UNASSIGNED_DRIVER
            ? null
            : data.assignedDriver || null
        const nextStatus: Order["status"] = nextAssignedDriver ? editingOrder.status : ORDER_STATUS.UNASSIGNED

        await updateOrder(editingOrder.id, {
          orderNumber: data.orderNumber,
          pickupName: data.pickupName,
          pickupPhone: data.pickupPhone,
          pickupAddress: data.pickupAddress,
          pickupTime: data.pickupTime,
          customerName: data.customerName,
          phone: data.phone,
          customerEmail: normalizedCustomerEmail,
          address: data.address,
          deliveryDate: data.deliveryDate,
          deliveryTime: data.deliveryTime,
          items: validItems,
          subtotal,
          taxRate: data.taxRate ?? 0,
          tax,
          deliveryFees: data.deliveryFees ?? 0,
          deliveryTips: data.deliveryTips ?? 0,
          discount: data.discount ?? 0,
          amount: total,
          deliveryInstruction: data.deliveryInstruction ?? "",
          paymentMethod: data.paymentMethod ?? "",
          assignedDriver: nextAssignedDriver,
          status: nextStatus,
        })

        setOrderList((prev) =>
          prev.map((order) =>
            order.id === editingOrder.id
              ? {
                  ...order,
                  orderNumber: data.orderNumber,
                  pickupName: data.pickupName,
                  pickupPhone: data.pickupPhone,
                  pickupAddress: data.pickupAddress,
                  pickupTime: data.pickupTime,
                  customerName: data.customerName,
                  phone: data.phone,
                  customerEmail: normalizedCustomerEmail,
                  address: data.address,
                  deliveryDate: data.deliveryDate,
                  deliveryTime: data.deliveryTime,
                  items: validItems,
                  subtotal,
                  taxRate: data.taxRate ?? 0,
                  tax,
                  deliveryFees: data.deliveryFees ?? 0,
                  deliveryTips: data.deliveryTips ?? 0,
                  discount: data.discount ?? 0,
                  amount: total,
                  deliveryInstruction: data.deliveryInstruction ?? "",
                  paymentMethod: data.paymentMethod ?? "",
                  assignedDriver: nextAssignedDriver,
                  status: nextStatus,
                }
              : order
          )
        )
        toast({ title: "Order updated" })
      } else {
        const normalizedCustomerEmail = data.customerEmail?.trim() ? data.customerEmail.trim() : null
        const assignedDriverValue =
          data.assignedDriver === UNASSIGNED_DRIVER
            ? null
            : data.assignedDriver || null
        const initialStatus: Order["status"] = assignedDriverValue ? ORDER_STATUS.STARTED : ORDER_STATUS.UNASSIGNED

        const orderId = await createOrder({
          orderNumber: data.orderNumber,
          pickupName: data.pickupName,
          pickupPhone: data.pickupPhone,
          pickupAddress: data.pickupAddress,
          pickupTime: data.pickupTime,
          customerName: data.customerName,
          phone: data.phone,
          customerEmail: normalizedCustomerEmail,
          address: data.address,
          deliveryDate: data.deliveryDate,
          deliveryTime: data.deliveryTime,
          items: validItems,
          subtotal,
          taxRate: data.taxRate ?? 0,
          tax,
          deliveryFees: data.deliveryFees ?? 0,
          deliveryTips: data.deliveryTips ?? 0,
          discount: data.discount ?? 0,
          amount: total,
          deliveryInstruction: data.deliveryInstruction ?? "",
          paymentMethod: data.paymentMethod ?? "",
          status: initialStatus,
          assignedDriver: assignedDriverValue,
        })
        toast({ title: "Order created" })

        const newOrder: Order = {
          id: orderId,
          orderNumber: data.orderNumber,
          pickupName: data.pickupName,
          pickupPhone: data.pickupPhone,
          pickupAddress: data.pickupAddress,
          pickupTime: data.pickupTime,
          customerName: data.customerName,
          phone: data.phone,
          customerEmail: normalizedCustomerEmail,
          address: data.address,
          deliveryDate: data.deliveryDate,
          deliveryTime: data.deliveryTime,
          items: validItems,
          subtotal,
          taxRate: data.taxRate ?? 0,
          tax,
          deliveryFees: data.deliveryFees ?? 0,
          deliveryTips: data.deliveryTips ?? 0,
          discount: data.discount ?? 0,
          amount: total,
          deliveryInstruction: data.deliveryInstruction ?? "",
          paymentMethod: data.paymentMethod ?? "",
          status: initialStatus,
          assignedDriver: assignedDriverValue,
          createdAt: new Date(),
          startedAt: initialStatus === ORDER_STATUS.STARTED ? new Date() : undefined,
        }

        setOrderList((prev) => [newOrder, ...prev])
      }

      setIsDialogOpen(false)
      setError(null)
    } catch (err) {
      console.error("Error saving order:", err)
      setError(editingOrder ? "Failed to update order" : "Failed to create order")
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

  const currentOrders = orderList.filter(
    (o) => ACTIVE_STATUSES.includes(o.status)
  )
  const completedOrders = orderList.filter((o) => o.status === ORDER_STATUS.DELIVERED)
  const incompleteOrders = orderList.filter((o) => o.status === ORDER_STATUS.CANCELLED || o.status === ORDER_STATUS.FAILED)
  const historyOrders = orderList.filter(
    (o) => TERMINAL_STATUSES.includes(o.status)
  )

  const visibleOrders =
    activeTab === "current"
      ? currentOrders
      : activeTab === "completed"
        ? completedOrders
        : activeTab === "incomplete"
          ? incompleteOrders
          : historyOrders

  const visibleOrderIds = visibleOrders.map((o) => o.id)
  const selectedVisibleCount = visibleOrderIds.filter((id) => selectedOrderIds.includes(id)).length
  const allVisibleSelected = visibleOrderIds.length > 0 && selectedVisibleCount === visibleOrderIds.length
  const someVisibleSelected = selectedVisibleCount > 0 && !allVisibleSelected

  function toggleOrderSelection(orderId: string, checked: boolean) {
    setSelectedOrderIds((prev) =>
      checked ? [...new Set([...prev, orderId])] : prev.filter((id) => id !== orderId)
    )
  }

  function toggleSelectAllVisible(checked: boolean) {
    if (!checked) {
      setSelectedOrderIds((prev) => prev.filter((id) => !visibleOrderIds.includes(id)))
      return
    }
    setSelectedOrderIds((prev) => [...new Set([...prev, ...visibleOrderIds])])
  }

  function openBulkAssignDialog() {
    if (selectedOrderIds.length === 0) {
      toast({ title: "Select orders first" })
      return
    }
    setBulkDriverId(UNASSIGNED_DRIVER)
    setIsBulkAssignOpen(true)
  }

  async function handleBulkAssign() {
    if (selectedOrderIds.length === 0 || bulkDriverId === UNASSIGNED_DRIVER) return
    try {
      setIsSaving(true)
      await Promise.all(
        selectedOrderIds.map((id) =>
          updateOrder(id, {
            assignedDriver: bulkDriverId,
            status: ORDER_STATUS.STARTED,
            startedAt: new Date(),
          })
        )
      )

      setOrderList((prev) =>
        prev.map((order) =>
          selectedOrderIds.includes(order.id)
            ? { ...order, assignedDriver: bulkDriverId, status: ORDER_STATUS.STARTED, startedAt: new Date() }
            : order
        )
      )

      const selectedOrders = orderList.filter((o) => selectedOrderIds.includes(o.id))
      const bulkDriverObj = allDrivers.find((d) => d.id === bulkDriverId)
      for (const item of selectedOrders) {
        notifyOrderEvent("order_accepted", {
          orderId: item.id,
          orderNumber: item.orderNumber,
          customerName: item.customerName,
          customerPhone: item.phone,
          customerEmail: item.customerEmail,
          address: item.address,
          driverName: bulkDriverObj?.name,
          items: item.items,
        })
      }

      setIsBulkAssignOpen(false)
      toast({ title: "Orders assigned", description: `${selectedOrderIds.length} orders updated.` })
    } catch {
      toast({ title: "Failed to assign orders", variant: "destructive" })
    } finally {
      setIsSaving(false)
    }
  }

  function handleBulkSendEta() {
    if (selectedOrderIds.length === 0) {
      toast({ title: "Select orders first" })
      return
    }
    toast({ title: "ETA sent", description: `ETA sent for ${selectedOrderIds.length} orders.` })
  }

  async function handleCancelOrder(order: Order) {
    if (!window.confirm(`Cancel order ${order.orderNumber}?`)) return
    try {
      setIsSaving(true)
      await updateOrder(order.id, { status: "cancelled", assignedDriver: null })
      setOrderList((prev) =>
        prev.map((o) => o.id === order.id ? { ...o, status: "cancelled", assignedDriver: null } : o)
      )
      toast({ title: "Order cancelled", description: `${order.orderNumber} has been cancelled.` })
    } catch {
      toast({ title: "Failed to cancel order", variant: "destructive" })
    } finally {
      setIsSaving(false)
    }
  }

  async function handleUnassignOrder(orderId: string) {
    try {
      setIsSaving(true)
      await updateOrder(orderId, { assignedDriver: null, status: "unassigned", startedAt: null })
      setOrderList((prev) =>
        prev.map((o) => o.id === orderId ? { ...o, assignedDriver: null, status: "unassigned", startedAt: null } : o)
      )
      setReassignOrderId(null)
      toast({ title: "Order unassigned" })
    } catch {
      toast({ title: "Failed to unassign order", variant: "destructive" })
    } finally {
      setIsSaving(false)
    }
  }

  function getDriverActiveOrderCount(driverId: string) {
    return orderList.filter(
      (o) => o.assignedDriver === driverId && !["unassigned", "delivered", "cancelled", "failed"].includes(o.status)
    ).length
  }

  async function handleBulkDelete() {
    if (selectedOrderIds.length === 0) {
      toast({ title: "Select orders first" })
      return
    }
    const shouldDelete = window.confirm(`Delete ${selectedOrderIds.length} selected orders?`)
    if (!shouldDelete) return

    try {
      setIsSaving(true)
      await Promise.all(selectedOrderIds.map((id) => deleteOrder(id)))
      setOrderList((prev) => prev.filter((order) => !selectedOrderIds.includes(order.id)))
      setSelectedOrderIds([])
      toast({ title: "Orders deleted", description: "Selected orders were removed." })
    } catch {
      toast({ title: "Failed to delete selected orders", variant: "destructive" })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Orders
        </h1>
        <div className="mt-4 flex items-center gap-5 overflow-x-auto border-b border-border pb-0.5">
          {(["current", "completed", "incomplete", "history"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`border-b-2 pb-3 text-lg transition-colors ${
                activeTab === tab
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {tab === "current" && (
                <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-sm text-primary-foreground">{currentOrders.length}</span>
              )}
            </button>
          ))}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage and track all delivery orders
        </p>
        {error && (
          <p className="mt-2 text-sm text-destructive">{error}</p>
        )}
      </div>

      {activeTab === "current" && (
        <div className="flex justify-between items-start">
          <div></div>
          <div className="flex flex-col items-end gap-2">
            <Button onClick={openNewOrderDialog}>
              <Plus className="mr-2 h-4 w-4" />
              New Order
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={openBulkAssignDialog} disabled={selectedOrderIds.length === 0 || isSaving} title="Assign Orders">
                <UserPlus className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={handleBulkSendEta} disabled={selectedOrderIds.length === 0 || isSaving} title="Send ETA">
                <Send className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={() => window.print()} disabled={selectedOrderIds.length === 0} title="Print Label">
                <Printer className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={handleBulkDelete} disabled={selectedOrderIds.length === 0 || isSaving} title="Delete Orders">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        </div>
      )}

      <div>
        {visibleOrders.length === 0 ? (
          <div className="flex h-32 items-center justify-center">
            <p className="text-sm text-muted-foreground">No orders in this section.</p>
          </div>
        ) : (
          <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-12">
                <Checkbox
                  checked={allVisibleSelected ? true : someVisibleSelected ? "indeterminate" : false}
                  onCheckedChange={(checked) => toggleSelectAllVisible(checked === true)}
                  aria-label="Select all visible orders"
                />
              </TableHead>
              <TableHead>Order Number</TableHead>
              <TableHead>Customer Name</TableHead>
              <TableHead className="hidden md:table-cell">Phone</TableHead>
              <TableHead className="hidden lg:table-cell">Address</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden sm:table-cell">Driver</TableHead>
              <TableHead>Track</TableHead>
              <TableHead>Distance</TableHead>
              <TableHead>Placement Time</TableHead>
              <TableHead>Start Time</TableHead>
              <TableHead>Pick up Time</TableHead>
              {(activeTab === "completed" || activeTab === "history") && <TableHead>Delivery Time</TableHead>}
              {activeTab !== "completed" && activeTab !== "history" && <TableHead>Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleOrders.map((order) => (
              <TableRow key={order.id}>
                <TableCell>
                  <Checkbox
                    checked={selectedOrderIds.includes(order.id)}
                    onCheckedChange={(checked) => toggleOrderSelection(order.id, checked === true)}
                    aria-label={`Select order ${order.orderNumber}`}
                  />
                </TableCell>
                <TableCell className="font-medium text-foreground">
                  <button
                    onClick={() => setSelectedOrder(order)}
                    className="underline hover:text-primary"
                  >
                    {order.orderNumber}
                  </button>
                </TableCell>
                <TableCell className="text-foreground">{order.customerName}</TableCell>
                <TableCell className="hidden text-muted-foreground md:table-cell">
                  {order.phone}
                </TableCell>
                <TableCell className="hidden max-w-[200px] truncate text-muted-foreground lg:table-cell">
                  {order.address}
                </TableCell>
                <TableCell className="font-medium text-foreground">
                  {formatCurrency(order.amount)}
                </TableCell>
                <TableCell>
                  <StatusBadge status={order.status} />
                </TableCell>
                <TableCell className="hidden text-muted-foreground sm:table-cell">
                  {order.assignedDriver ? (
                    <span>{getDriverDisplayName(order.assignedDriver)}</span>
                  ) : (
                    <Select onValueChange={(value) => handleAssignDriver(order.id, value)}>
                      <SelectTrigger className="h-9 w-[130px] rounded-md border bg-secondary/50 text-sm font-medium shadow-sm">
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
                  )}
                </TableCell>
                <TableCell>
                  {order.assignedDriver ? (
                    <Button asChild size="sm" variant="outline" className="h-8">
                      <Link
                        href={`/track/${encodeURIComponent(order.orderNumber)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Track
                      </Link>
                    </Button>
                  ) : null}
                </TableCell>
                <TableCell className="text-muted-foreground">{formatDistance(order.distanceKm)}</TableCell>
                <TableCell className="text-muted-foreground">{formatOrderTime(order.createdAt)}</TableCell>
                <TableCell className="text-muted-foreground">{formatOrderTime(order.startedAt)}</TableCell>
                <TableCell className="text-muted-foreground">{formatOrderTime(order.pickedUpAt)}</TableCell>
                {(activeTab === "completed" || activeTab === "history") && (
                  <TableCell className="text-muted-foreground">{formatOrderTime(order.deliveredAt)}</TableCell>
                )}
                {activeTab !== "completed" && activeTab !== "history" && (
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {order.assignedDriver && (
                          <DropdownMenuItem onClick={() => setReassignOrderId(order.id)}>
                            <UserPlus2 className="mr-2 h-4 w-4" /> Reassign
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => setSelectedOrder(order)}>
                          <FileText className="mr-2 h-4 w-4" /> Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openEditOrderDialog(order)}>
                          <Edit className="mr-2 h-4 w-4" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handlePrintOrder(order, getDriverDisplayName)}>
                          <Printer className="mr-2 h-4 w-4" /> Print order
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handlePrintLabel(order)}>
                          <Barcode className="mr-2 h-4 w-4" /> Print label
                        </DropdownMenuItem>
                        {order.assignedDriver && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleCancelOrder(order)}>
                              <Ban className="mr-2 h-4 w-4" /> Cancel order
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        )}
      </div>

      {/* Extracted dialog components */}
      <ReassignDialog
        reassignOrderId={reassignOrderId}
        orderList={orderList}
        allDrivers={allDrivers}
        isSaving={isSaving}
        onClose={() => setReassignOrderId(null)}
        onAssignDriver={handleAssignDriver}
        onUnassignOrder={handleUnassignOrder}
        getDriverActiveOrderCount={getDriverActiveOrderCount}
      />

      <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) { setAddressSuggestions([]); setAddressPreviewCoord(null) } }}>
        <DialogContent className="w-[95vw] max-w-[1200px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-center text-2xl font-bold">
              {editingOrder ? "Edit Order" : "New Order"}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {editingOrder ? "Edit order details" : "Create a new order"}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <div className="grid gap-10 md:grid-cols-2">
                {/* ─── Left Column ─── */}
                <div className="space-y-6">
                  <FormField control={form.control} name="orderNumber" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Order Number: <span className="text-destructive">*</span></FormLabel>
                      <FormControl><Input placeholder="Enter order number" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <fieldset className="space-y-4">
                    <legend className="text-lg font-semibold">Pick-up From:</legend>
                    <FormField control={form.control} name="pickupName" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name: <span className="text-destructive">*</span></FormLabel>
                        <FormControl><Input placeholder="Enter pickup name" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="pickupPhone" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone No: <span className="text-destructive">*</span></FormLabel>
                        <FormControl><Input placeholder="+234 000-000-0000" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="pickupAddress" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Address: <span className="text-destructive">*</span></FormLabel>
                        <FormControl><Input placeholder="Enter pickup address" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="pickupTime" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Pickup Time: <span className="text-destructive">*</span></FormLabel>
                        <FormControl><Input type="time" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </fieldset>

                  <fieldset className="space-y-4">
                    <legend className="text-lg font-semibold">Deliver to:</legend>
                    <FormField control={form.control} name="customerName" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name: <span className="text-destructive">*</span></FormLabel>
                        <FormControl><Input placeholder="Enter customer name" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="phone" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone No: <span className="text-destructive">*</span></FormLabel>
                        <FormControl><Input placeholder="+234 000-000-0000" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="customerEmail" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email:</FormLabel>
                        <FormControl><Input placeholder="Enter an email" type="email" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="address" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Address: <span className="text-destructive">*</span></FormLabel>
                        <FormControl>
                          <div className="relative">
                            <div ref={placesContainerRef} className="hidden" />
                            <input
                              type="text"
                              autoComplete="off"
                              placeholder="Enter a location"
                              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                              value={field.value}
                              onChange={(e) => {
                                const val = e.target.value
                                field.onChange(val)
                                setAddressPreviewCoord(null)
                                if (addressDebounceRef.current) clearTimeout(addressDebounceRef.current)
                                if (val.trim().length < 3) { setAddressSuggestions([]); return }
                                addressDebounceRef.current = setTimeout(async () => {
                                  setAddressSearching(true)
                                  try {
                                    await loadGoogleMaps()
                                    if (!autocompleteServiceRef.current) {
                                      autocompleteServiceRef.current = new google.maps.places.AutocompleteService()
                                    }
                                    autocompleteServiceRef.current.getPlacePredictions(
                                      { input: val, componentRestrictions: { country: "ng" } },
                                      (predictions, status) => {
                                        if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
                                          setAddressSuggestions(predictions.slice(0, 5).map(p => ({
                                            display_name: p.description,
                                            lat: "",
                                            lon: "",
                                            placeId: p.place_id,
                                          })))
                                        } else {
                                          setAddressSuggestions([])
                                        }
                                        setAddressSearching(false)
                                      }
                                    )
                                  } catch {
                                    setAddressSearching(false)
                                  }
                                }, 300)
                              }}
                            />
                            {(addressSearching || addressSuggestions.length > 0) && (
                              <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-y-auto rounded-md border bg-popover shadow-lg">
                                {addressSearching && (
                                  <div className="px-3 py-2 text-xs text-muted-foreground">Searching…</div>
                                )}
                                {addressSuggestions.map((s, i) => (
                                  <button
                                    key={i}
                                    type="button"
                                    className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                                    onClick={async () => {
                                      field.onChange(s.display_name)
                                      setAddressSuggestions([])
                                      if (s.placeId) {
                                        try {
                                          await loadGoogleMaps()
                                          if (!placesServiceRef.current && placesContainerRef.current) {
                                            placesServiceRef.current = new google.maps.places.PlacesService(placesContainerRef.current)
                                          }
                                          placesServiceRef.current?.getDetails(
                                            { placeId: s.placeId, fields: ["geometry"] },
                                            (place, detailStatus) => {
                                              if (detailStatus === google.maps.places.PlacesServiceStatus.OK && place?.geometry?.location) {
                                                setAddressPreviewCoord({ lat: place.geometry.location.lat(), lng: place.geometry.location.lng() })
                                              }
                                            }
                                          )
                                        } catch { /* ignore */ }
                                      }
                                    }}
                                  >
                                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                    <span className="line-clamp-2">{s.display_name}</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <div className="grid grid-cols-2 gap-3">
                      <FormField control={form.control} name="deliveryDate" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Delivery Date: <span className="text-destructive">*</span></FormLabel>
                          <FormControl><Input type="date" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="deliveryTime" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Delivery Time: <span className="text-destructive">*</span></FormLabel>
                          <FormControl><Input type="time" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                  </fieldset>
                </div>

                {/* ─── Right Column: Order Details ─── */}
                <div className="space-y-5">
                  <p className="text-lg font-semibold">Order Details <span className="text-muted-foreground font-normal text-sm">(Optional)</span></p>

                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Items:</p>
                    {(form.watch("items") ?? []).map((_, idx) => (
                      <div key={idx} className="space-y-1">
                        <div className="grid grid-cols-[1fr_120px_80px_28px] gap-3 items-end">
                          <Input
                            placeholder="Item name"
                            value={form.watch(`items.${idx}.name`)}
                            onChange={(e) => {
                              const items = [...(form.getValues("items") ?? [])]
                              items[idx] = { ...items[idx], name: e.target.value }
                              form.setValue("items", items)
                            }}
                          />
                          <Input
                            type="number"
                            placeholder="Price"
                            value={form.watch(`items.${idx}.price`) || ""}
                            onChange={(e) => {
                              const items = [...(form.getValues("items") ?? [])]
                              items[idx] = { ...items[idx], price: parseFloat(e.target.value) || 0 }
                              form.setValue("items", items)
                            }}
                          />
                          <Input
                            type="number"
                            placeholder="Qty"
                            value={form.watch(`items.${idx}.qty`) || ""}
                            onChange={(e) => {
                              const items = [...(form.getValues("items") ?? [])]
                              items[idx] = { ...items[idx], qty: parseInt(e.target.value) || 1 }
                              form.setValue("items", items)
                            }}
                          />
                          <button
                            type="button"
                            className="flex h-9 items-center justify-center rounded-md text-destructive hover:bg-destructive/10"
                            onClick={() => {
                              const items = [...(form.getValues("items") ?? [])]
                              if (items.length > 1) {
                                items.splice(idx, 1)
                                form.setValue("items", items)
                              }
                            }}
                          >×</button>
                        </div>
                        <Input
                          placeholder="Attributes (e.g. +pa_color : blue)"
                          className="h-7 text-xs"
                          value={form.watch(`items.${idx}.meta`) || ""}
                          onChange={(e) => {
                            const items = [...(form.getValues("items") ?? [])]
                            items[idx] = { ...items[idx], meta: e.target.value }
                            form.setValue("items", items)
                          }}
                        />
                      </div>
                    ))}
                    <button
                      type="button"
                      className="text-xs text-primary hover:underline"
                      onClick={() => {
                        const items = [...(form.getValues("items") ?? []), { name: "", price: 0, qty: 1, meta: "" }]
                        form.setValue("items", items)
                      }}
                    >+ Add item</button>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">Subtotal (₦):</span>
                    <span className="font-medium">{(form.watch("items") ?? []).reduce((s, i) => s + (i.price * i.qty), 0)}</span>
                  </div>

                  <div className="flex items-center justify-between gap-4 text-sm">
                    <span className="font-medium">Tax Rate %:</span>
                    <Input type="number" step="0.01" className="h-9 w-48 text-right" placeholder="Enter tax rate" {...form.register("taxRate", { valueAsNumber: true })} />
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">Tax (₦):</span>
                    <span>{Math.round((form.watch("items") ?? []).reduce((s, i) => s + (i.price * i.qty), 0) * (form.watch("taxRate") ?? 0)) / 100}</span>
                  </div>

                  <div className="flex items-center justify-between gap-4 text-sm">
                    <span className="font-medium">Delivery Fees (₦):</span>
                    <Input type="number" className="h-9 w-48 text-right" placeholder="Enter delivery fees" {...form.register("deliveryFees", { valueAsNumber: true })} />
                  </div>

                  <div className="flex items-center justify-between gap-4 text-sm">
                    <span className="font-medium">Delivery Tips (₦):</span>
                    <Input type="number" className="h-9 w-48 text-right" placeholder="Enter delivery tips amount" {...form.register("deliveryTips", { valueAsNumber: true })} />
                  </div>

                  <div className="flex items-center justify-between gap-4 text-sm">
                    <span className="font-medium">Discount (₦):</span>
                    <Input type="number" className="h-9 w-48 text-right" placeholder="Enter discount amount" {...form.register("discount", { valueAsNumber: true })} />
                  </div>

                  <div className="flex items-center justify-between text-base font-bold border-t pt-3">
                    <span>Total(₦):</span>
                    <span>{(() => {
                      const items = form.watch("items") ?? []
                      const sub = items.reduce((s, i) => s + (i.price * i.qty), 0)
                      const tax = Math.round(sub * (form.watch("taxRate") ?? 0)) / 100
                      return Math.max(sub + tax + (form.watch("deliveryFees") ?? 0) + (form.watch("deliveryTips") ?? 0) - (form.watch("discount") ?? 0), 0)
                    })()}</span>
                  </div>

                  <div className="space-y-1">
                    <span className="text-sm font-medium">Delivery Instruction:</span>
                    <Textarea placeholder="Enter delivery instructions" className="resize-none" rows={3} {...form.register("deliveryInstruction")} />
                  </div>

                  <div className="flex items-center justify-between gap-4 text-sm">
                    <span className="font-medium">Payment Method:</span>
                    <Input className="h-9 w-48" placeholder="" {...form.register("paymentMethod")} />
                  </div>

                  <p className="text-right text-sm text-destructive">* Required</p>
                </div>
              </div>

              <DialogFooter className="mt-6">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSaving} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  {isSaving ? "Saving..." : "Save"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <BulkAssignDialog
        open={isBulkAssignOpen}
        onOpenChange={setIsBulkAssignOpen}
        selectedCount={selectedOrderIds.length}
        availableDrivers={availableDrivers}
        bulkDriverId={bulkDriverId}
        onDriverChange={setBulkDriverId}
        onAssign={handleBulkAssign}
        isSaving={isSaving}
      />

      <OrderDetailDialog
        order={selectedOrder}
        onClose={() => setSelectedOrder(null)}
        onDelete={handleDeleteOrder}
        getDriverDisplayName={getDriverDisplayName}
      />
    </div>
  )
}

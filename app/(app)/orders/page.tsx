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
import { Badge } from "@/components/ui/badge"
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Plus, Edit, MoreHorizontal, Download, Printer, Trash2, Send, UserPlus, MapPin } from "lucide-react"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { fetchOrders, fetchDriversByStatus, updateOrder, createOrder, deleteOrder, fetchDrivers } from "@/lib/firestore"
import { formatCurrency } from "@/lib/data"
import type { Order, Driver } from "@/lib/data"
import { toast } from "@/hooks/use-toast"
import { notifyOrderEvent } from "@/lib/notify-client"

type OrderTab = "current" | "completed" | "incomplete" | "history"

// special value used in the form to represent no driver assignment
const UNASSIGNED_DRIVER = "unassigned" as const

const orderFormSchema = z.object({
  orderNumber: z.string().min(1, "Order number is required"),
  customerName: z.string().min(1, "Customer name is required"),
  phone: z.string().min(1, "Phone number is required"),
  customerEmail: z
    .string()
    .trim()
    .email("Enter a valid email")
    .optional()
    .or(z.literal("")),
  address: z.string().min(1, "Address is required"),
  amount: z.number().min(0, "Amount must be positive"),
  assignedDriver: z.string().optional(),
})

type OrderFormData = z.infer<typeof orderFormSchema>

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

  // Address autocomplete
  const [addressSuggestions, setAddressSuggestions] = useState<Array<{ display_name: string; lat: string; lon: string }>>([])
  const [addressSearching, setAddressSearching] = useState(false)
  const [addressPreviewCoord, setAddressPreviewCoord] = useState<{ lat: number; lng: number } | null>(null)
  const addressDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const form = useForm<OrderFormData>({
    resolver: zodResolver(orderFormSchema),
    defaultValues: {
      orderNumber: "",
      customerName: "",
      phone: "",
      customerEmail: "",
      address: "",
      amount: 0,
      assignedDriver: "",
    },
  })

  useEffect(() => {
    async function loadData() {
      try {
        setIsLoading(true)
        const [ordersData, availableDriversData, allDriversData] = await Promise.all([
          fetchOrders(),
          fetchDriversByStatus("available"),
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

  async function handleAssignDriver(orderId: string, driverId: string) {
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

  function parseFirestoreDate(value: unknown): Date | null {
    if (!value) return null
    if (value instanceof Date) return value
    if (typeof value === "object" && value !== null) {
      const maybeObj = value as { toDate?: () => Date; seconds?: number }
      if (typeof maybeObj.toDate === "function") return maybeObj.toDate()
      if (typeof maybeObj.seconds === "number") return new Date(maybeObj.seconds * 1000)
    }
    return null
  }

  function formatOrderTime(value: unknown) {
    const date = parseFirestoreDate(value)
    if (!date) return "--"
    return new Intl.DateTimeFormat("en-NG", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date)
  }

  function formatDistance(distanceKm: unknown) {
    if (typeof distanceKm !== "number" || Number.isNaN(distanceKm)) return "--"
    return `${distanceKm.toFixed(2)} km`
  }
  function openNewOrderDialog() {
    setEditingOrder(null)
    form.reset({
      orderNumber: "",
      customerName: "",
      phone: "",
      customerEmail: "",
      address: "",
      amount: 0,
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
      customerName: order.customerName,
      phone: order.phone,
      customerEmail: order.customerEmail ?? "",
      address: order.address,
      amount: order.amount,
      assignedDriver: order.assignedDriver ?? UNASSIGNED_DRIVER,
    })
    setAddressSuggestions([])
    setAddressPreviewCoord(null)
    setIsDialogOpen(true)
  }

  function openOrderDialog(order: Order) {
    setSelectedOrder(order)
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

  async function onSubmit(data: OrderFormData) {
    try {
      setIsSaving(true)

      if (editingOrder) {
        // Update existing order
        const normalizedCustomerEmail = data.customerEmail?.trim() ? data.customerEmail.trim() : null
        const nextAssignedDriver =
          data.assignedDriver === UNASSIGNED_DRIVER
            ? null
            : data.assignedDriver || null
        const nextStatus: Order["status"] = nextAssignedDriver ? editingOrder.status : "unassigned"

        await updateOrder(editingOrder.id, {
          orderNumber: data.orderNumber,
          customerName: data.customerName,
          phone: data.phone,
          customerEmail: normalizedCustomerEmail,
          address: data.address,
          amount: data.amount,
          assignedDriver: nextAssignedDriver,
          status: nextStatus,
        })

        setOrderList((prev) =>
          prev.map((order) =>
            order.id === editingOrder.id
              ? {
                  ...order,
                  orderNumber: data.orderNumber,
                  customerName: data.customerName,
                  phone: data.phone,
                  customerEmail: normalizedCustomerEmail,
                  address: data.address,
                  amount: data.amount,
                  assignedDriver: nextAssignedDriver,
                  status: nextStatus,
                }
              : order
          )
        )
        toast({ title: "Order updated" })
      } else {
        // Create new order
        const normalizedCustomerEmail = data.customerEmail?.trim() ? data.customerEmail.trim() : null
        const assignedDriverValue =
          data.assignedDriver === UNASSIGNED_DRIVER
            ? null
            : data.assignedDriver || null
        const initialStatus: Order["status"] = assignedDriverValue ? "started" : "unassigned"

        const orderId = await createOrder({
          orderNumber: data.orderNumber,
          customerName: data.customerName,
          phone: data.phone,
          customerEmail: normalizedCustomerEmail,
          address: data.address,
          amount: data.amount,
          status: initialStatus,
          assignedDriver: assignedDriverValue,

        })
        console.log("Created order with ID", orderId)
        toast({ title: "Order created" })

        const newOrder: Order = {
          id: orderId,
          orderNumber: data.orderNumber,
          customerName: data.customerName,
          phone: data.phone,
          customerEmail: normalizedCustomerEmail,
          address: data.address,
          amount: data.amount,
          status: initialStatus,
          assignedDriver: assignedDriverValue,
          createdAt: new Date(),
          startedAt: initialStatus === "started" ? new Date() : undefined,
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
    (o) => o.status === "unassigned" || o.status === "started" || o.status === "picked-up" || o.status === "in-transit"
  )
  const completedOrders = orderList.filter((o) => o.status === "delivered")
  const incompleteOrders = orderList.filter((o) => o.status === "cancelled" || o.status === "failed")
  const historyOrders = orderList.filter(
    (o) => o.status === "delivered" || o.status === "cancelled" || o.status === "failed"
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
            status: "started",
            startedAt: new Date(),
          })
        )
      )

      setOrderList((prev) =>
        prev.map((order) =>
          selectedOrderIds.includes(order.id)
            ? { ...order, assignedDriver: bulkDriverId, status: "started", startedAt: new Date() }
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

  function handleBulkPrintLabel() {
    if (selectedOrderIds.length === 0) {
      toast({ title: "Select orders first" })
      return
    }
    window.print()
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
          <button
            onClick={() => setActiveTab("current")}
            className={`border-b-2 pb-3 text-lg transition-colors ${
              activeTab === "current"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Current <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-sm text-primary-foreground">{currentOrders.length}</span>
          </button>
          <button
            onClick={() => setActiveTab("completed")}
            className={`border-b-2 pb-3 text-lg transition-colors ${
              activeTab === "completed"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Completed
          </button>
          <button
            onClick={() => setActiveTab("incomplete")}
            className={`border-b-2 pb-3 text-lg transition-colors ${
              activeTab === "incomplete"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Incomplete
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`border-b-2 pb-3 text-lg transition-colors ${
              activeTab === "history"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            History
          </button>
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
              <Button variant="outline" size="icon" onClick={handleBulkPrintLabel} disabled={selectedOrderIds.length === 0} title="Print Label">
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
              <TableHead>Delivery Time</TableHead>
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
                    onClick={() => openOrderDialog(order)}
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
                  <Button asChild size="sm" variant="outline" className="h-8">
                    <Link
                      href={`/track/${encodeURIComponent(order.orderNumber)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Track
                    </Link>
                  </Button>
                </TableCell>
                <TableCell className="text-muted-foreground">{formatDistance(order.distanceKm)}</TableCell>
                <TableCell className="text-muted-foreground">{formatOrderTime(order.createdAt)}</TableCell>
                <TableCell className="text-muted-foreground">{formatOrderTime(order.startedAt)}</TableCell>
                <TableCell className="text-muted-foreground">{formatOrderTime(order.pickedUpAt)}</TableCell>
                <TableCell className="text-muted-foreground">{formatOrderTime(order.deliveredAt)}</TableCell>
                {activeTab !== "completed" && activeTab !== "history" && (
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditOrderDialog(order)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) { setAddressSuggestions([]); setAddressPreviewCoord(null) } }}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>
              {editingOrder ? "Edit Order" : "Create New Order"}
            </DialogTitle>
            <DialogDescription>
              {editingOrder
                ? "Make changes to the order details below."
                : "Fill in the details to create a new order."}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="orderNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Order Number</FormLabel>
                    <FormControl>
                      <Input placeholder="ORD-001" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="customerName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer Name</FormLabel>
                    <FormControl>
                      <Input placeholder="John Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input placeholder="+1 (555) 123-4567" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="customerEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="customer@example.com" type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <input
                          type="text"
                          autoComplete="off"
                          placeholder="Start typing an address…"
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
                                const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&q=${encodeURIComponent(val)}&countrycodes=ng`
                                const res = await fetch(url, { headers: { Accept: "application/json" } })
                                if (res.ok) {
                                  const data = (await res.json()) as Array<{ display_name: string; lat: string; lon: string }>
                                  setAddressSuggestions(data)
                                }
                              } catch { /* ignore */ }
                              setAddressSearching(false)
                            }, 400)
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
                                onClick={() => {
                                  field.onChange(s.display_name)
                                  setAddressSuggestions([])
                                  setAddressPreviewCoord({ lat: Number(s.lat), lng: Number(s.lon) })
                                }}
                              >
                                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                <span className="line-clamp-2">{s.display_name}</span>
                              </button>
                            ))}
                          </div>
                        )}
                        {addressPreviewCoord && (
                          <div className="mt-2 overflow-hidden rounded-md border">
                            <iframe
                              title="Address map preview"
                              width="100%"
                              height="160"
                              src={`https://www.openstreetmap.org/export/embed.html?bbox=${addressPreviewCoord.lng - 0.008},${addressPreviewCoord.lat - 0.008},${addressPreviewCoord.lng + 0.008},${addressPreviewCoord.lat + 0.008}&layer=mapnik&marker=${addressPreviewCoord.lat},${addressPreviewCoord.lng}`}
                              style={{ border: 0 }}
                            />
                          </div>
                        )}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount ($)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="25.99"
                        {...field}
                        value={Number.isNaN(field.value) ? "" : field.value}
                        onChange={(e) => {
                          const raw = e.target.value
                          field.onChange(raw === "" ? Number.NaN : parseFloat(raw))
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="assignedDriver"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assigned Driver</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select driver" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="unassigned">Unassigned</SelectItem>
                        {availableDrivers.map((driver) => (
                          <SelectItem key={driver.id} value={driver.id}>
                            {driver.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? "Saving..." : editingOrder ? "Update Order" : "Create Order"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={isBulkAssignOpen} onOpenChange={setIsBulkAssignOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Assign Selected Orders</DialogTitle>
            <DialogDescription>
              Assign {selectedOrderIds.length} selected orders to one driver.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm font-medium">Driver</p>
            <Select value={bulkDriverId} onValueChange={setBulkDriverId}>
              <SelectTrigger>
                <SelectValue placeholder="Select driver" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNASSIGNED_DRIVER}>Select driver</SelectItem>
                {availableDrivers.map((driver) => (
                  <SelectItem key={driver.id} value={driver.id}>
                    {driver.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBulkAssignOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleBulkAssign} disabled={bulkDriverId === UNASSIGNED_DRIVER || isSaving}>
              Assign Orders
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* order detail overlay */}
      <Dialog
        open={!!selectedOrder}
        onOpenChange={(open) => {
          if (!open) setSelectedOrder(null)
        }}
      >
        <DialogContent className="sm:max-w-[600px]">
          {selectedOrder && (
            <>
              <DialogHeader>
                <div className="flex justify-between items-center w-full">
                  <div>
                    <DialogTitle className="text-xl font-bold">
                      Order #: {selectedOrder.orderNumber}
                    </DialogTitle>
                    <StatusBadge status={selectedOrder.status} />
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
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={() => handleDeleteOrder(selectedOrder.id)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </DialogHeader>

              <div className="space-y-2 mt-4">
                <p>
                  <span className="font-semibold">Customer:</span> {selectedOrder.customerName}
                </p>
                <p>
                  <span className="font-semibold">Phone:</span> {selectedOrder.phone}
                </p>
                <p>
                  <span className="font-semibold">Email:</span> {selectedOrder.customerEmail || "-"}
                </p>
                <p>
                  <span className="font-semibold">Address:</span> {selectedOrder.address}
                </p>
                <p>
                  <span className="font-semibold">Amount:</span> {formatCurrency(selectedOrder.amount)}
                </p>
                <p>
                  <span className="font-semibold">Driver:</span>{" "}
                  {getDriverDisplayName(selectedOrder.assignedDriver)}
                </p>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

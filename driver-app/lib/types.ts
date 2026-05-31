export type OrderStatus =
  | "unassigned"
  | "started"
  | "picked-up"
  | "in-transit"
  | "delivered"
  | "failed"
  | "cancelled"

export type DriverStatus = "available" | "on-delivery" | "offline"

export interface OrderItem {
  name: string
  qty?: number
  price?: number
  meta?: string
}

export interface Order {
  id: string
  orderNumber: string
  customerName: string
  phone: string
  customerEmail?: string | null
  address: string
  amount: number
  status: OrderStatus
  assignedDriver: string | null
  items?: OrderItem[]
  pickupName?: string
  pickupPhone?: string
  pickupAddress?: string
  pickupTime?: string
  deliveryDate?: string
  deliveryTime?: string
  subtotal?: number
  taxRate?: number
  tax?: number
  deliveryFees?: number
  deliveryTips?: number
  discount?: number
  deliveryInstruction?: string
  paymentMethod?: string
  proofOfDelivery?: string
  proofOfPickup?: string
  deliveryNote?: string
  customerRating?: number
  driverRating?: number
  distanceKm?: number
  lat?: number
  lng?: number
  routeOrder?: number
  createdAt?: unknown
  startedAt?: unknown
  pickedUpAt?: unknown
  inTransitAt?: unknown
  deliveredAt?: unknown
}

export interface Driver {
  id: string
  name: string
  phone: string
  email?: string
  area?: string
  vehicle: string
  model?: string
  plate?: string
  status: DriverStatus
  rating: number
  note?: string
  lastLocation?: { lat: number; lng: number }
}

export interface DriverSession {
  id: string
  name: string
  phone: string
  token: string
}

export interface PendingDelivery {
  id: string
  orderId: string
  orderNumber: string
  customerName: string
  driverId: string
  photoData: string | null
  signatureData: string | null
  deliveryNotes: string
  capturedAt: number
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
  }).format(amount)
}

export const ACTIVE_STATUSES: OrderStatus[] = ["unassigned", "started", "picked-up", "in-transit"]
export const TERMINAL_STATUSES: OrderStatus[] = ["delivered", "failed", "cancelled"]

export const STATUS_LABELS: Record<OrderStatus, string> = {
  unassigned: "Unassigned",
  started: "Started",
  "picked-up": "Picked Up",
  "in-transit": "In Transit",
  delivered: "Delivered",
  failed: "Failed",
  cancelled: "Cancelled",
}

export interface ChatThread {
  id: string
  type: "dispatcher" | "customer"
  name: string
  avatar?: string
  orderId?: string
  orderNumber?: string
  lastMessage: string
  lastMessageAt: number | string
  unreadCount: number
}

export interface ChatMessage {
  id: string
  threadId: string
  text: string
  senderId: string
  senderType: "driver" | "dispatcher" | "customer" | "system"
  timestamp: number | string
  isRead: boolean
}

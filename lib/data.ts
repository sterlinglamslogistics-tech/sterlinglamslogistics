export type OrderStatus = "unassigned" | "started" | "picked-up" | "in-transit" | "delivered" | "failed" | "cancelled"
export type DriverStatus = "available" | "on-delivery" | "offline"

export interface OrderItem {
  name: string
  qty?: number
  price?: number
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
  customerRating?: number
  driverRating?: number
  customerFeedback?: string
  customerRatedAt?: unknown
  distanceKm?: number
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
  status: DriverStatus
  rating: number
  note?: string
  password?: string
  lastLocation?: { lat: number; lng: number }
  locationUpdatedAt?: unknown
}

export interface NotificationChannelResult {
  sent: boolean
  reason?: string
  detail?: string
}

export interface NotificationLog {
  id: string
  event: "order_accepted" | "out_for_delivery" | "delivered"
  orderId: string
  orderNumber: string
  customerName?: string
  customerPhone?: string
  customerEmail?: string | null
  sms: NotificationChannelResult
  whatsapp: NotificationChannelResult
  email: NotificationChannelResult
  createdAt?: unknown
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
  }).format(amount)
}

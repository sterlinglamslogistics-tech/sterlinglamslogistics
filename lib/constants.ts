// Centralized constants — single source of truth for status values and shared config

export const ORDER_STATUS = {
  UNASSIGNED: "unassigned",
  STARTED: "started",
  PICKED_UP: "picked-up",
  IN_TRANSIT: "in-transit",
  DELIVERED: "delivered",
  FAILED: "failed",
  CANCELLED: "cancelled",
} as const

export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS]

export const DRIVER_STATUS = {
  AVAILABLE: "available",
  ON_DELIVERY: "on-delivery",
  OFFLINE: "offline",
} as const

export type DriverStatus = (typeof DRIVER_STATUS)[keyof typeof DRIVER_STATUS]

export const ORDER_EVENTS = {
  ORDER_ACCEPTED: "order_accepted",
  OUT_FOR_DELIVERY: "out_for_delivery",
  DELIVERED: "delivered",
} as const

export type OrderEvent = (typeof ORDER_EVENTS)[keyof typeof ORDER_EVENTS]

/** Status display labels (used in badges and dropdowns) */
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  [ORDER_STATUS.UNASSIGNED]: "Unassigned",
  [ORDER_STATUS.STARTED]: "Started",
  [ORDER_STATUS.PICKED_UP]: "Picked Up",
  [ORDER_STATUS.IN_TRANSIT]: "In Transit",
  [ORDER_STATUS.DELIVERED]: "Delivered",
  [ORDER_STATUS.FAILED]: "Failed",
  [ORDER_STATUS.CANCELLED]: "Cancelled",
}

/** Status badge color variants */
export const ORDER_STATUS_VARIANT: Record<OrderStatus, string> = {
  [ORDER_STATUS.UNASSIGNED]: "secondary",
  [ORDER_STATUS.STARTED]: "outline",
  [ORDER_STATUS.PICKED_UP]: "default",
  [ORDER_STATUS.IN_TRANSIT]: "default",
  [ORDER_STATUS.DELIVERED]: "default",
  [ORDER_STATUS.FAILED]: "destructive",
  [ORDER_STATUS.CANCELLED]: "secondary",
}

/** Driver sort priority for active orders */
export const ORDER_STATUS_PRIORITY: Record<string, number> = {
  [ORDER_STATUS.STARTED]: 0,
  [ORDER_STATUS.PICKED_UP]: 1,
  [ORDER_STATUS.IN_TRANSIT]: 2,
  [ORDER_STATUS.DELIVERED]: 3,
  [ORDER_STATUS.FAILED]: 4,
  [ORDER_STATUS.CANCELLED]: 5,
  [ORDER_STATUS.UNASSIGNED]: 6,
}

/** Active order statuses (not terminal) */
export const ACTIVE_STATUSES: OrderStatus[] = [
  ORDER_STATUS.UNASSIGNED,
  ORDER_STATUS.STARTED,
  ORDER_STATUS.PICKED_UP,
  ORDER_STATUS.IN_TRANSIT,
]

/** Terminal order statuses */
export const TERMINAL_STATUSES: OrderStatus[] = [
  ORDER_STATUS.DELIVERED,
  ORDER_STATUS.FAILED,
  ORDER_STATUS.CANCELLED,
]

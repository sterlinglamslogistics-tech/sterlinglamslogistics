"use client"

const QUEUE_KEY = "driverDeliveryQueue"

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

export function queueDelivery(item: PendingDelivery): void {
  try {
    const existing = getPendingDeliveries().filter((d) => d.orderId !== item.orderId)
    localStorage.setItem(QUEUE_KEY, JSON.stringify([...existing, item]))
  } catch { /* ignore storage errors */ }
}

export function getPendingDeliveries(): PendingDelivery[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY)
    return raw ? (JSON.parse(raw) as PendingDelivery[]) : []
  } catch {
    return []
  }
}

export function removePendingDelivery(orderId: string): void {
  try {
    const updated = getPendingDeliveries().filter((d) => d.orderId !== orderId)
    localStorage.setItem(QUEUE_KEY, JSON.stringify(updated))
  } catch { /* ignore */ }
}

export function pendingDeliveryCount(): number {
  return getPendingDeliveries().length
}

"use client"

/**
 * Offline queue for driver status updates (Mark as Picked Up / On the way /
 * revert / report failed). Mirrors the shape of delivery-queue.ts (which
 * already handles POD submissions) — keeps both queues separate so the
 * payload types stay clean, but they're retried together by the same
 * effect in driver-context.tsx.
 *
 * Storage: localStorage. Payloads are small JSON, no need for IndexedDB.
 */

const QUEUE_KEY = "driverStatusQueue"
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

export interface PendingStatusUpdate {
  /** Unique queue entry id — orderId + queuedAt timestamp */
  id: string
  orderId: string
  orderNumber: string
  driverId: string
  /** Target status to set. "started" / "picked-up" / "in-transit" / "failed" */
  status: string
  failedReason?: string
  queuedAt: number
}

export function queueStatusUpdate(item: PendingStatusUpdate): void {
  try {
    // Only keep the latest intent per order — if the driver tapped twice
    // (or revert + new state), the most recent wins on retry.
    const remaining = getPendingStatusUpdates().filter((u) => u.orderId !== item.orderId)
    localStorage.setItem(QUEUE_KEY, JSON.stringify([...remaining, item]))
  } catch { /* storage full / disabled — silent */ }
}

export function getPendingStatusUpdates(): PendingStatusUpdate[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY)
    if (!raw) return []
    const all = JSON.parse(raw) as PendingStatusUpdate[]
    const cutoff = Date.now() - MAX_AGE_MS
    const fresh = all.filter((u) => u.queuedAt > cutoff)
    if (fresh.length !== all.length) {
      localStorage.setItem(QUEUE_KEY, JSON.stringify(fresh))
    }
    return fresh
  } catch {
    return []
  }
}

export function removeStatusUpdate(orderId: string): void {
  try {
    const updated = getPendingStatusUpdates().filter((u) => u.orderId !== orderId)
    localStorage.setItem(QUEUE_KEY, JSON.stringify(updated))
  } catch { /* ignore */ }
}

export function pendingStatusCount(): number {
  return getPendingStatusUpdates().length
}

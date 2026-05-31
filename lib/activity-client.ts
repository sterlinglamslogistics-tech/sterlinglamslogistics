"use client"

import { auth } from "@/lib/firebase"
import type { AuditAction } from "@/lib/audit"

/**
 * Record a client-side dashboard action in the activity log.
 *
 * Fire-and-forget: failures are swallowed so logging never breaks the action
 * that triggered it. The server (POST /api/admin/activity) records the actor
 * from the verified token and only accepts a whitelist of order.* actions.
 */
export async function logActivity(input: {
  action: AuditAction
  /** Order number or id of the affected record. */
  resourceId?: string
  /** Optional extra detail shown in / attached to the entry. */
  details?: Record<string, unknown>
}): Promise<void> {
  try {
    const token = await auth?.currentUser?.getIdToken()
    if (!token) return
    await fetch("/api/admin/activity", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(input),
    })
  } catch (error) {
    console.error("logActivity failed:", error)
  }
}

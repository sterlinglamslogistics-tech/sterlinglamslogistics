import { createLogger } from "@/lib/logger"
import { addDoc, collection } from "firebase/firestore"
import { db } from "@/lib/firebase"

const log = createLogger("audit")

export type AuditAction =
  | "order.created"
  | "order.updated"
  | "order.deleted"
  | "order.assigned"
  | "order.status_changed"
  | "driver.created"
  | "driver.updated"
  | "driver.deleted"
  | "driver.password_changed"
  | "driver.status_changed"
  | "settings.updated"
  | "admin.login"
  | "admin.clean_orders"

interface AuditEntry {
  action: AuditAction
  actor?: string
  resourceId?: string
  resourceType?: string
  details?: Record<string, unknown>
}

/**
 * Write an audit log entry to Firestore and structured logger.
 * Best-effort — never throws.
 */
export async function audit(entry: AuditEntry): Promise<void> {
  const record = {
    ...entry,
    timestamp: new Date().toISOString(),
    createdAt: new Date(),
  }

  log.info(record, `audit: ${entry.action}`)

  if (!db) return

  try {
    await addDoc(collection(db, "auditLogs"), record)
  } catch (err) {
    log.error({ err, ...record }, "Failed to write audit log to Firestore")
  }
}

import { createLogger } from "@/lib/logger"
import { verifyDriverSession } from "@/lib/server/driver-session"

const log = createLogger("server:driver-auth")

/**
 * Resolve the driverId for a request from a verified HMAC session token
 * (cookie or X-Driver-Token header). Returns null if no valid session exists.
 */
export function resolveDriverIdFromRequest(req: Request, bodyDriverId: string | null | undefined): string | null {
  const sessionDriverId = verifyDriverSession(req)
  const trimmedBody = bodyDriverId?.trim() || null

  if (sessionDriverId) {
    if (trimmedBody && trimmedBody !== sessionDriverId) {
      log.warn(
        { sessionDriverId, bodyDriverId: trimmedBody },
        "[driver-auth] body driverId does not match session — using session id"
      )
    }
    return sessionDriverId
  }

  return null
}

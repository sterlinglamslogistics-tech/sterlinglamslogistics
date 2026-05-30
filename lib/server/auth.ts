import { adminAuth } from "./firebase-admin"
import { createLogger } from "@/lib/logger"

const log = createLogger("server:auth")

/**
 * Verify the Firebase ID token from the Authorization header and ensure the
 * user has the `admin` custom claim.  Returns the decoded token on success or
 * null when verification fails.
 */
export async function verifyAdmin(req: Request) {
  const header = req.headers.get("authorization")
  if (!header?.startsWith("Bearer ")) {
    log.warn("Missing or malformed Authorization header")
    return null
  }

  try {
    const token = header.slice(7)
    const decoded = await adminAuth.verifyIdToken(token)
    if (!decoded.admin) {
      log.warn({ uid: decoded.uid }, "User lacks admin claim")
      return null
    }
    return decoded
  } catch (err) {
    log.warn({ error: err }, "ID token verification failed")
    return null
  }
}

/**
 * Like {@link verifyAdmin}, but additionally requires the user to be an
 * owner or admin — the only roles allowed to manage the team and read the
 * activity log. Every invited team member carries the `admin` claim, so the
 * `admin` claim alone is NOT enough; we check the `role` claim too.
 *
 * Legacy accounts created before roles existed have `admin:true` and no
 * `role` claim — they are treated as owners (consistent with the GET
 * /api/admin/users resolution).
 */
export async function verifyManager(req: Request) {
  const decoded = await verifyAdmin(req)
  if (!decoded) return null
  const role = (decoded.role as string | undefined) ?? "owner"
  if (role !== "owner" && role !== "admin") {
    log.warn({ uid: decoded.uid, role }, "User is not a manager")
    return null
  }
  return decoded
}

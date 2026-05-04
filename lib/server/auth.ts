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

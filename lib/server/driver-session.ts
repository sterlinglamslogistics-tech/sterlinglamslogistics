import { createHmac, timingSafeEqual, randomBytes } from "node:crypto"
import { createLogger } from "@/lib/logger"

const log = createLogger("server:driver-session")

const COOKIE_NAME = "driver_session"
const HEADER_NAME = "x-driver-token"
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30 // 30 days

let warnedAboutMissingSecret = false
let devFallbackSecret: string | null = null

function getSecret(): string {
  const explicit = process.env.DRIVER_SESSION_SECRET
  if (explicit && explicit.length >= 32) return explicit

  // Derive a reasonably stable per-process secret from the service-account JSON
  // when DRIVER_SESSION_SECRET isn't set. This keeps tokens valid across requests
  // within a single deployment while still giving a deterministic per-project key.
  // Set DRIVER_SESSION_SECRET explicitly (>= 32 chars) for stability across restarts.
  const sa = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
  if (sa) {
    return createHmac("sha256", "sg-driver-session").update(sa).digest("hex")
  }

  if (process.env.NODE_ENV === "production") {
    if (!warnedAboutMissingSecret) {
      warnedAboutMissingSecret = true
      log.error(
        "DRIVER_SESSION_SECRET (and FIREBASE_SERVICE_ACCOUNT_KEY) are unset in production — " +
          "driver tokens will not be verifiable across instances. Set DRIVER_SESSION_SECRET to a 32+ char random string."
      )
    }
  }

  if (!devFallbackSecret) {
    devFallbackSecret = randomBytes(32).toString("hex")
    log.warn("Using a process-local random secret for driver sessions (development only).")
  }
  return devFallbackSecret
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64").replace(/=+$/g, "").replace(/\+/g, "-").replace(/\//g, "_")
}

function fromBase64url(input: string): Buffer {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4))
  return Buffer.from(input.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64")
}

/** Create a signed driver-session token. Format: base64url(payload).base64url(hmac) */
export function createDriverToken(driverId: string): string {
  const payload = {
    driverId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
  }
  const payloadB64 = base64url(JSON.stringify(payload))
  const sig = createHmac("sha256", getSecret()).update(payloadB64).digest()
  return `${payloadB64}.${base64url(sig)}`
}

/** Returns the driverId encoded in the token, or null if invalid/expired. */
export function verifyDriverToken(token: string | null | undefined): string | null {
  if (!token) return null
  const parts = token.split(".")
  if (parts.length !== 2) return null
  const [payloadB64, sigB64] = parts

  let expected: Buffer
  let provided: Buffer
  try {
    expected = createHmac("sha256", getSecret()).update(payloadB64).digest()
    provided = fromBase64url(sigB64)
  } catch {
    return null
  }
  if (expected.length !== provided.length) return null
  try {
    if (!timingSafeEqual(expected, provided)) return null
  } catch {
    return null
  }

  let payload: { driverId?: string; exp?: number }
  try {
    payload = JSON.parse(fromBase64url(payloadB64).toString("utf8"))
  } catch {
    return null
  }
  if (!payload?.driverId) return null
  if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) return null
  return payload.driverId
}

/**
 * Verify a driver session from a Request. Reads the `driver_session` cookie
 * first, then the `x-driver-token` header (used by Capacitor WebView clients
 * that may not roundtrip cookies). Returns the verified driverId or null.
 */
export function verifyDriverSession(req: Request): string | null {
  const cookieHeader = req.headers.get("cookie") ?? ""
  const fromCookie = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${COOKIE_NAME}=`))
    ?.slice(COOKIE_NAME.length + 1)

  const fromHeader = req.headers.get(HEADER_NAME)
  return verifyDriverToken(fromCookie ?? fromHeader)
}

/** Cookie attributes for the Set-Cookie header — secure on https, lax samesite. */
export function buildSessionCookie(token: string, opts: { secure: boolean }): string {
  const attrs = [
    `${COOKIE_NAME}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${TOKEN_TTL_SECONDS}`,
  ]
  if (opts.secure) attrs.push("Secure")
  return attrs.join("; ")
}

export function buildClearSessionCookie(opts: { secure: boolean }): string {
  const attrs = [`${COOKIE_NAME}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"]
  if (opts.secure) attrs.push("Secure")
  return attrs.join("; ")
}

export const DRIVER_SESSION_HEADER = HEADER_NAME
export const DRIVER_SESSION_COOKIE = COOKIE_NAME

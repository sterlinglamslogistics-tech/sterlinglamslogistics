import { NextResponse } from "next/server"
import { checkRateLimit, getRateLimitIdentifier } from "@/lib/rate-limit"
import { verifyPassword, isHashed, hashPassword } from "@/lib/password"
import { adminDb } from "@/lib/server/firebase-admin"
import { createLogger } from "@/lib/logger"
import { createDriverToken, buildSessionCookie } from "@/lib/server/driver-session"

const log = createLogger("api:driver:login")

function normalizeDriverPhoneForMatch(value: string): string | null {
  const digits = value.replace(/\D/g, "")
  if (!digits) return null
  if (digits.length === 10) return digits
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1)
  if (digits.length >= 13 && digits.startsWith("234")) return digits.slice(-10)
  if (digits.length > 10) return digits.slice(-10)
  return null
}

export async function POST(req: Request) {
  const rateLimitResponse = await checkRateLimit(getRateLimitIdentifier(req))
  if (rateLimitResponse) return rateLimitResponse

  try {
    const body = (await req.json()) as { phone?: string; password?: string }
    const phone = body.phone?.trim() ?? ""
    const password = body.password?.trim() ?? ""
    if (!phone || !password) {
      return NextResponse.json({ ok: false, error: "Phone and password are required." }, { status: 400 })
    }

    const normalizedInput = normalizeDriverPhoneForMatch(phone)
    if (!normalizedInput) {
      return NextResponse.json({ ok: false, error: "Invalid credentials." }, { status: 401 })
    }

    const snapshot = await adminDb.collection("drivers").get()
    for (const driverDoc of snapshot.docs) {
      const data = driverDoc.data() as {
        name?: string
        phone?: string
        password?: string
      }

      const normalizedStored = normalizeDriverPhoneForMatch(String(data.phone ?? ""))
      if (normalizedStored !== normalizedInput) continue

      const storedPassword = data.password ?? ""
      const matches = await verifyPassword(password, storedPassword)
      if (!matches) continue

      if (!isHashed(storedPassword)) {
        try {
          await driverDoc.ref.update({ password: await hashPassword(password) })
        } catch {
          // best-effort migration only
        }
      }

      const token = createDriverToken(driverDoc.id)
      const isHttps = new URL(req.url).protocol === "https:"
      const response = NextResponse.json({
        ok: true,
        driver: {
          id: driverDoc.id,
          name: data.name ?? "",
          phone: data.phone ?? "",
        },
        // Returned in body so Capacitor WebView clients can stash it and send
        // it back as the X-Driver-Token header on subsequent requests.
        token,
      })
      response.headers.append("Set-Cookie", buildSessionCookie(token, { secure: isHttps }))
      return response
    }

    return NextResponse.json({ ok: false, error: "Invalid credentials." }, { status: 401 })
  } catch (error) {
    log.error({ error }, "Driver login failed")
    return NextResponse.json({ ok: false, error: "Failed to authenticate driver." }, { status: 500 })
  }
}

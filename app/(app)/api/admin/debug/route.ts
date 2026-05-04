import { NextResponse } from "next/server"

export async function GET() {
  const checks: Record<string, unknown> = {
    node_env: process.env.NODE_ENV,
    has_key: !!process.env.FIREBASE_SERVICE_ACCOUNT_KEY,
    key_length: process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.length ?? 0,
    driver_session_secret_set: !!process.env.DRIVER_SESSION_SECRET,
  }

  // Test admin SDK and inspect stored drivers
  try {
    const { adminDb } = await import("@/lib/server/firebase-admin")
    const snap = await adminDb.collection("drivers").get()
    checks.admin_db_ok = true
    checks.driver_count = snap.size
    checks.drivers = snap.docs.map((d) => {
      const data = d.data()
      const pwd = data.password as string | undefined
      return {
        id: d.id,
        name: data.name,
        phone: data.phone,
        password_stored: !!pwd,
        password_length: pwd?.length ?? 0,
        password_is_hashed: pwd?.startsWith("$2") ?? false,
        password_preview: pwd ? pwd.slice(0, 10) + "..." : "EMPTY",
      }
    })
  } catch (err) {
    checks.admin_db_ok = false
    checks.admin_db_error = String(err)
  }

  return NextResponse.json(checks)
}

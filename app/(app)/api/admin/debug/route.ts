import { NextResponse } from "next/server"

export async function GET() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY

  const checks: Record<string, unknown> = {
    has_key: !!raw,
    key_length: raw?.length ?? 0,
    project_id: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "missing",
    node_env: process.env.NODE_ENV,
  }

  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>
      checks.json_valid = true
      checks.type = parsed.type
      checks.project = parsed.project_id
      checks.client_email = parsed.client_email
      checks.has_private_key = typeof parsed.private_key === "string" && parsed.private_key.length > 0

      const pk = parsed.private_key as string
      checks.pk_starts_with = pk.slice(0, 30)
      checks.pk_has_real_newlines = pk.includes("\n")
      checks.pk_has_escaped_newlines = pk.includes("\\n")
    } catch (err) {
      checks.json_valid = false
      checks.json_error = String(err)
    }
  }

  // Test admin SDK
  try {
    const { adminDb } = await import("@/lib/server/firebase-admin")
    const testSnap = await adminDb.collection("drivers").limit(1).get()
    checks.admin_db_ok = true
    checks.driver_count_sample = testSnap.size
  } catch (err) {
    checks.admin_db_ok = false
    checks.admin_db_error = String(err)
  }

  // Test adminAuth
  try {
    const { adminAuth } = await import("@/lib/server/firebase-admin")
    checks.admin_auth_loaded = !!adminAuth
  } catch (err) {
    checks.admin_auth_error = String(err)
  }

  return NextResponse.json(checks)
}

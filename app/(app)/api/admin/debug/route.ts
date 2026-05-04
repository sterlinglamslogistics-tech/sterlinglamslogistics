import { NextResponse } from "next/server"

export async function GET() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY ?? ""

  const firstBrace = raw.indexOf("{")
  const cleaned = firstBrace >= 0 ? raw.slice(firstBrace) : raw

  const checks: Record<string, unknown> = {
    node_env: process.env.NODE_ENV,
    key_length: raw.length,
    first_brace_at: firstBrace,
    raw_first_20: JSON.stringify(raw.slice(0, 20)),
    cleaned_first_20: JSON.stringify(cleaned.slice(0, 20)),
    driver_session_secret_set: !!process.env.DRIVER_SESSION_SECRET,
  }

  // Try parsing the cleaned string
  try {
    const parsed = JSON.parse(cleaned) as Record<string, unknown>
    checks.json_valid = true
    checks.type = parsed.type
    checks.project = parsed.project_id
    checks.has_private_key = typeof parsed.private_key === "string"
    const pk = parsed.private_key as string
    checks.pk_first_30 = pk?.slice(0, 30)
    checks.pk_has_real_newline = pk?.includes("\n")
    checks.pk_has_escaped_newline = pk?.includes("\\n")
  } catch (err) {
    checks.json_valid = false
    checks.json_error = String(err)
    checks.cleaned_first_100 = cleaned.slice(0, 100)
  }

  // Test admin SDK directly
  try {
    const { adminDb } = await import("@/lib/server/firebase-admin")
    const snap = await adminDb.collection("drivers").limit(1).get()
    checks.admin_db_ok = true
    checks.driver_count = snap.size
  } catch (err) {
    checks.admin_db_ok = false
    checks.admin_db_error = String(err)
  }

  return NextResponse.json(checks)
}

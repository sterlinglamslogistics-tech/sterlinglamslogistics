import { NextResponse } from "next/server"
import { verifyDriverSession } from "@/lib/server/driver-session"
import { checkRateLimit, getRateLimitIdentifier } from "@/lib/rate-limit"

export async function GET(req: Request) {
  const rl = await checkRateLimit(getRateLimitIdentifier(req))
  if (rl) return rl

  const tokenDriverId = verifyDriverSession(req)
  if (!tokenDriverId) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const address = searchParams.get("address")
  if (!address) return NextResponse.json({ ok: false, error: "address required" }, { status: 400 })

  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? ""
  if (!key) return NextResponse.json({ ok: false, error: "Maps not configured" }, { status: 503 })

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${key}`
    const res = await fetch(url)
    const data = await res.json() as { results?: Array<{ geometry: { location: { lat: number; lng: number } } }> }
    const loc = data.results?.[0]?.geometry?.location
    if (!loc) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 })
    return NextResponse.json({ ok: true, lat: loc.lat, lng: loc.lng })
  } catch {
    return NextResponse.json({ ok: false, error: "Geocoding failed" }, { status: 500 })
  }
}

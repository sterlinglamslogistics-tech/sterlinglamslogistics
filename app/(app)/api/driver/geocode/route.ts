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

  const q = address.trim()

  // Try Google Maps Geocoding first
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? ""
  if (key) {
    try {
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(q)}&key=${key}`
      )
      if (res.ok) {
        const data = await res.json() as { results?: Array<{ geometry: { location: { lat: number; lng: number } } }> }
        const loc = data.results?.[0]?.geometry?.location
        if (loc) return NextResponse.json({ ok: true, lat: loc.lat, lng: loc.lng })
      }
    } catch { /* fall through to Nominatim */ }
  }

  // Fallback: Nominatim (OpenStreetMap) — no API key required
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(q)}`,
      { headers: { Accept: "application/json", "User-Agent": "sterlinglams-delivery/1.0" } }
    )
    if (!res.ok) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 })
    const data = await res.json() as Array<{ lat: string; lon: string }>
    const result = data?.[0]
    if (!result) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 })
    const lat = Number(result.lat)
    const lng = Number(result.lon)
    if (isNaN(lat) || isNaN(lng)) return NextResponse.json({ ok: false, error: "Invalid coords" }, { status: 404 })
    return NextResponse.json({ ok: true, lat, lng })
  } catch {
    return NextResponse.json({ ok: false, error: "Geocoding failed" }, { status: 500 })
  }
}

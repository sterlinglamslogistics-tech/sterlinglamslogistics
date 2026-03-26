/** Shared Google Maps JavaScript API loader (singleton) */

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? ""

let loadPromise: Promise<typeof google.maps> | null = null

export function loadGoogleMaps(): Promise<typeof google.maps> {
  if (loadPromise) return loadPromise

  loadPromise = new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("Cannot load Google Maps on the server"))
      return
    }

    // Already loaded
    if (window.google?.maps?.Map) {
      resolve(window.google.maps)
      return
    }

    const script = document.createElement("script")
    script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&libraries=places`
    script.async = true
    script.defer = true
    script.onload = () => resolve(window.google.maps)
    script.onerror = () => reject(new Error("Failed to load Google Maps"))
    document.head.appendChild(script)
  })

  return loadPromise
}

const geocodeCache = new Map<string, { lat: number; lng: number }>()

export async function geocodeAddress(
  address: string
): Promise<{ lat: number; lng: number } | null> {
  const query = address.trim()
  if (!query) return null

  const cached = geocodeCache.get(query)
  if (cached) return cached

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${API_KEY}`
    const res = await fetch(url)
    if (!res.ok) return null
    const data = await res.json()
    const loc = data.results?.[0]?.geometry?.location
    if (!loc) return null

    const coords = { lat: loc.lat, lng: loc.lng }
    geocodeCache.set(query, coords)
    return coords
  } catch {
    return null
  }
}

export async function fetchDirectionsRoute(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number }
): Promise<{
  polyline: string
  distanceMeters: number
  durationSeconds: number
} | null> {
  try {
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&key=${API_KEY}`
    const res = await fetch(url)
    if (!res.ok) return null
    const data = await res.json()
    const route = data.routes?.[0]
    const leg = route?.legs?.[0]
    if (!route || !leg) return null

    return {
      polyline: route.overview_polyline?.points ?? "",
      distanceMeters: leg.distance?.value ?? 0,
      durationSeconds: leg.duration?.value ?? 0,
    }
  } catch {
    return null
  }
}

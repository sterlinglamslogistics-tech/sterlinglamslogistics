import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { initializeApp } from "firebase/app"
import { collection, doc, getDocs, getFirestore, updateDoc } from "firebase/firestore"

function loadEnvLocal() {
  const cwd = path.dirname(fileURLToPath(import.meta.url))
  const envPath = path.join(cwd, ".env.local")
  if (!fs.existsSync(envPath)) return

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue

    const eqIndex = trimmed.indexOf("=")
    if (eqIndex < 0) continue

    const key = trimmed.slice(0, eqIndex).trim()
    if (!key || process.env[key] !== undefined) continue

    const rawValue = trimmed.slice(eqIndex + 1).trim()
    const value = rawValue.replace(/^['\"]|['\"]$/g, "")
    process.env[key] = value
  }
}

function toRad(value) {
  return (value * Math.PI) / 180
}

function haversineDistanceKm(a, b) {
  const earthRadiusKm = 6371
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)

  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2)

  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
  return Number((earthRadiusKm * c).toFixed(2))
}

const geocodeCache = new Map()

async function geocodeAddress(address) {
  const query = String(address || "").trim()
  if (!query) return null

  const cached = geocodeCache.get(query)
  if (cached) return cached

  // Try Google Maps Geocoding API first
  const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || ""
  if (API_KEY) {
    try {
      const gUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${API_KEY}`
      const gRes = await fetch(gUrl)
      if (gRes.ok) {
        const gData = await gRes.json()
        const loc = gData.results?.[0]?.geometry?.location
        if (loc) {
          const coords = { lat: loc.lat, lng: loc.lng }
          geocodeCache.set(query, coords)
          return coords
        }
      }
    } catch { /* fall through to Nominatim */ }
  }

  // Fallback to Nominatim (OpenStreetMap)
  try {
    const nUrl = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`
    const nRes = await fetch(nUrl, {
      headers: { Accept: "application/json", "User-Agent": "delivery-backfill-distance/1.0" },
    })
    if (!nRes.ok) return null
    const nData = await nRes.json()
    if (!Array.isArray(nData) || nData.length === 0) return null

    const lat = Number(nData[0].lat)
    const lng = Number(nData[0].lon)
    if (Number.isNaN(lat) || Number.isNaN(lng)) return null

    const coords = { lat, lng }
    geocodeCache.set(query, coords)
    return coords
  } catch {
    return null
  }
}

loadEnvLocal()

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

const app = initializeApp(firebaseConfig)
const db = getFirestore(app)

const hub = {
  lat: Number(process.env.NEXT_PUBLIC_HUB_LAT) || 6.4642667,
  lng: Number(process.env.NEXT_PUBLIC_HUB_LNG) || 3.5554814,
}

async function run() {
  const ordersRef = collection(db, "orders")
  const snapshot = await getDocs(ordersRef)

  let updated = 0
  let skipped = 0

  for (const orderDoc of snapshot.docs) {
    const data = orderDoc.data()
    const address = data.address

    if (!address || typeof address !== "string") {
      skipped += 1
      continue
    }

    const coords = await geocodeAddress(address)
    if (!coords) {
      skipped += 1
      continue
    }

    const distanceKm = haversineDistanceKm(hub, coords)
    const ref = doc(db, "orders", orderDoc.id)
    await updateDoc(ref, {
      distanceKm,
      updatedAt: new Date(),
    })

    updated += 1
    console.log(`Updated ${orderDoc.id} -> ${distanceKm} km`)
  }

  console.log(`\nDone. Updated: ${updated}, Skipped: ${skipped}`)
}

run().catch((err) => {
  console.error("Backfill failed:", err)
  process.exit(1)
})

import { useEffect, useRef, useState, useCallback } from "react"
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Linking, Platform } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps"
import { Feather, MaterialIcons } from "@expo/vector-icons"
import * as Location from "expo-location"
import { useDriver } from "@/context/DriverContext"
import type { Order } from "@/lib/types"

const HUB_LAT = 6.465305
const HUB_LNG = 3.557488

interface PinnedOrder {
  order: Order
  time: string
  lat: number
  lng: number
}

// In-memory geocode cache — survives re-renders, cleared on app restart
const geocodeCache = new Map<string, { lat: number; lng: number } | null>()

async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  const q = address.trim()
  if (!q) return null
  if (geocodeCache.has(q)) return geocodeCache.get(q) ?? null

  try {
    // Use expo-location's device geocoder — uses native Google Maps on Android,
    // no API key required, works well with Nigerian addresses
    const results = await Location.geocodeAsync(q)
    if (results && results.length > 0 && results[0].latitude && results[0].longitude) {
      const coords = { lat: results[0].latitude, lng: results[0].longitude }
      geocodeCache.set(q, coords)
      return coords
    }
  } catch { /* fall through */ }

  geocodeCache.set(q, null)
  return null
}

function formatTime(ts: unknown): string {
  if (!ts) return ""
  let d: Date
  if (typeof ts === "object" && ts !== null && "seconds" in ts) {
    d = new Date((ts as { seconds: number }).seconds * 1000)
  } else {
    d = new Date(ts as string | number)
  }
  if (isNaN(d.getTime())) return ""
  return d.toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit", hour12: true }).toUpperCase()
}

function OrderPin({ time }: { time: string }) {
  const parts = time ? time.split(" ") : ["--"]
  return (
    <View collapsable={false} renderToHardwareTextureAndroid style={{ alignItems: "center" }}>
      <View collapsable={false} renderToHardwareTextureAndroid style={styles.pin}>
        <Text style={styles.pinTime}>{parts[0]}</Text>
        {parts[1] ? <Text style={styles.pinAmPm}>{parts[1]}</Text> : null}
      </View>
      <View collapsable={false} style={styles.pinTail} />
    </View>
  )
}

function StorePin() {
  return (
    <View collapsable={false} renderToHardwareTextureAndroid style={styles.storePinOuter}>
      <View collapsable={false} renderToHardwareTextureAndroid style={styles.storePin}>
        <MaterialIcons name="storefront" size={20} color="#fff" />
      </View>
      <View collapsable={false} style={styles.storePinTail} />
    </View>
  )
}

export default function MapScreen() {
  const { liveGps, orders } = useDriver()
  const mapRef = useRef<MapView>(null)
  const [pinned, setPinned] = useState<PinnedOrder[]>([])
  const [geocoding, setGeocoding] = useState(false)
  const [selected, setSelected] = useState<PinnedOrder | null>(null)
  // Android: keep tracksViewChanges=true briefly so the marker snapshot captures the painted view
  const [markersReady, setMarkersReady] = useState(false)

  const activeOrders = orders.filter(
    (o) => o.status === "started" || o.status === "picked-up" || o.status === "in-transit"
  )

  const geocodeOrders = useCallback(async () => {
    if (activeOrders.length === 0) { setPinned([]); return }
    setGeocoding(true)
    const results: PinnedOrder[] = []

    for (const order of activeOrders) {
      const time = formatTime((order as any).startedAt ?? order.createdAt)

      // Use stored coordinates if available
      if (typeof order.lat === "number" && typeof order.lng === "number") {
        results.push({ order, time, lat: order.lat, lng: order.lng })
        continue
      }

      // Geocode via Nominatim (direct, no auth needed)
      if (order.address) {
        const coords = await geocodeAddress(order.address)
        if (coords) {
          results.push({ order, time, lat: coords.lat, lng: coords.lng })
        }
      }
    }

    setPinned(results)
    setGeocoding(false)
    // Give Android time to paint the custom views before freezing the marker snapshot
    setMarkersReady(false)
    setTimeout(() => setMarkersReady(true), 500)
  }, [orders])

  useEffect(() => {
    geocodeOrders()
  }, [geocodeOrders])

  // Center map on driver when GPS first arrives
  useEffect(() => {
    if (!liveGps || !mapRef.current) return
    mapRef.current.animateToRegion({
      latitude: liveGps.lat,
      longitude: liveGps.lng,
      latitudeDelta: 0.12,
      longitudeDelta: 0.12,
    }, 500)
  }, [liveGps?.lat, liveGps?.lng])

  if (!liveGps) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#16a34a" />
        <Text style={styles.waiting}>Waiting for GPS...</Text>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Map</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {geocoding && <ActivityIndicator size="small" color="#6b7280" />}
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {activeOrders.length} order{activeOrders.length !== 1 ? "s" : ""}
            </Text>
          </View>
        </View>
      </View>

      <View style={{ flex: 1 }}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={{ flex: 1 }}
          initialRegion={{
            latitude: liveGps.lat,
            longitude: liveGps.lng,
            latitudeDelta: 0.12,
            longitudeDelta: 0.12,
          }}
          showsUserLocation
          showsMyLocationButton={false}
        >
          {/* Sterlinglams hub / store pin */}
          <Marker
            coordinate={{ latitude: HUB_LAT, longitude: HUB_LNG }}
            title="Sterlinglams"
            description="Pickup – Ikota Ajah, Lagos"
            tracksViewChanges={false}
          >
            <StorePin />
          </Marker>

          {/* Order time pins */}
          {pinned.map((p) => (
            <Marker
              key={p.order.id}
              coordinate={{ latitude: p.lat, longitude: p.lng }}
              onPress={() => setSelected(p)}
              tracksViewChanges={Platform.OS === "android" ? !markersReady : false}
            >
              <OrderPin time={p.time} />
            </Marker>
          ))}
        </MapView>

        {/* My location button */}
        <TouchableOpacity
          style={styles.myLocBtn}
          onPress={() => {
            if (liveGps && mapRef.current) {
              mapRef.current.animateToRegion({
                latitude: liveGps.lat,
                longitude: liveGps.lng,
                latitudeDelta: 0.06,
                longitudeDelta: 0.06,
              }, 400)
            }
          }}
        >
          <Feather name="navigation" size={18} color="#2563eb" />
        </TouchableOpacity>

        {/* Order detail bottom sheet on pin tap */}
        {selected && (
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetRow}>
              <View style={styles.sheetTimePill}>
                <Text style={styles.sheetTimeText}>{selected.time || "—"}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetOrderNum}>#{selected.order.orderNumber}</Text>
                <Text style={styles.sheetCustomer}>{selected.order.customerName}</Text>
                <Text style={styles.sheetAddress} numberOfLines={2}>{selected.order.address}</Text>
              </View>
              <View style={{ gap: 8 }}>
                <TouchableOpacity
                  onPress={() => Linking.openURL(
                    `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(selected.order.address)}&travelmode=driving`
                  )}
                  style={styles.sheetIconBtn}
                >
                  <Feather name="navigation" size={18} color="#2563eb" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => Linking.openURL(`tel:${selected.order.phone}`)}
                  style={styles.sheetIconBtn}
                >
                  <Feather name="phone" size={18} color="#16a34a" />
                </TouchableOpacity>
              </View>
            </View>
            <TouchableOpacity onPress={() => setSelected(null)} style={styles.sheetClose}>
              <Feather name="x" size={16} color="#6b7280" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#fff", gap: 12 },
  waiting: { fontSize: 14, color: "#6b7280" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#f3f4f6",
  },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#111827" },
  badge: { backgroundColor: "#dcfce7", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100 },
  badgeText: { fontSize: 12, fontWeight: "600", color: "#16a34a" },
  pin: {
<<<<<<< HEAD
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#1a1a1a",
    borderWidth: 2,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 64,
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
  pinTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderTopWidth: 9,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: "#1a1a1a",
    marginTop: -1,
  },
  pinTime: { color: "#fff", fontSize: 12, fontWeight: "700", letterSpacing: 0.3 },
  pinAmPm: { color: "#d1d5db", fontSize: 9, fontWeight: "600" },
=======
    width: 68, height: 46, borderRadius: 23,
    backgroundColor: "#1a1a1a",
    borderWidth: 3, borderColor: "#ffffff",
    alignItems: "center", justifyContent: "center",
    overflow: "hidden",
  },
  pinTime: { color: "#ffffff", fontSize: 13, fontWeight: "800" },
  pinAmPm: { color: "#cccccc", fontSize: 10, fontWeight: "600" },
>>>>>>> a81fc59 (fix: tracksViewChanges=false and overflow:hidden for Android map markers)
  storePinOuter: { alignItems: "center" },
  storePin: {
    width: 46, height: 46, borderRadius: 10,
    backgroundColor: "#f97316",
    borderWidth: 3, borderColor: "#ffffff",
    alignItems: "center", justifyContent: "center",
    overflow: "hidden",
  },
  storePinTail: {
    width: 0, height: 0,
    borderLeftWidth: 8, borderRightWidth: 8, borderTopWidth: 10,
    borderLeftColor: "transparent", borderRightColor: "transparent",
    borderTopColor: "#f97316", marginTop: -1,
  },
  myLocBtn: {
    position: "absolute", bottom: 20, right: 16,
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: "#fff", borderWidth: 1, borderColor: "#e5e7eb",
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 }, elevation: 4,
  },
  sheet: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 16, paddingBottom: 32,
    shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 12,
    shadowOffset: { width: 0, height: -3 }, elevation: 8,
  },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#d1d5db", alignSelf: "center", marginBottom: 14 },
  sheetRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  sheetTimePill: { backgroundColor: "#1a1a1a", borderRadius: 16, paddingHorizontal: 10, paddingVertical: 6, marginTop: 2 },
  sheetTimeText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  sheetOrderNum: { fontSize: 12, color: "#6b7280", marginBottom: 2 },
  sheetCustomer: { fontSize: 15, fontWeight: "700", color: "#111827" },
  sheetAddress: { fontSize: 13, color: "#6b7280", marginTop: 2 },
  sheetIconBtn: { width: 36, height: 36, borderRadius: 8, backgroundColor: "#f3f4f6", alignItems: "center", justifyContent: "center" },
  sheetClose: { position: "absolute", top: 12, right: 12, padding: 6 },
})

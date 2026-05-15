import { useEffect, useRef, useState, useCallback } from "react"
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Linking } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps"
import { MaterialIcons, Feather } from "@expo/vector-icons"
import Constants from "expo-constants"
import { useDriver } from "@/context/DriverContext"
import type { Order } from "@/lib/types"

const GMAPS_KEY: string = Constants.expoConfig?.android?.config?.googleMaps?.apiKey ?? ""
const HUB_LAT = 6.465305
const HUB_LNG = 3.557488

interface PinnedOrder {
  order: Order
  time: string
  lat: number
  lng: number
}

const geocodeCache = new Map<string, { lat: number; lng: number } | null>()

async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  const q = address.trim()
  if (!q) return null
  if (geocodeCache.has(q)) return geocodeCache.get(q) ?? null
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(q)}&key=${GMAPS_KEY}`
    const res = await fetch(url)
    const json = await res.json()
    if (json.status === "OK" && json.results?.length > 0) {
      const { lat, lng } = json.results[0].geometry.location
      const coords = { lat, lng }
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

export default function MapScreen() {
  const { liveGps, orders, setDrawerOpen } = useDriver()
  const mapRef = useRef<MapView>(null)
  const [pinned, setPinned] = useState<PinnedOrder[]>([])
  const [geocoding, setGeocoding] = useState(false)
  const [selected, setSelected] = useState<PinnedOrder | null>(null)

  const activeOrders = orders.filter(
    (o) => o.status === "started" || o.status === "picked-up" || o.status === "in-transit" || o.status === "unassigned"
  )

  const geocodeOrders = useCallback(async () => {
    if (activeOrders.length === 0) { setPinned([]); return }
    setGeocoding(true)
    const results: PinnedOrder[] = []

    for (let idx = 0; idx < activeOrders.length; idx++) {
      const order = activeOrders[idx]
      const time = formatTime(order.startedAt ?? order.createdAt)

      if (typeof order.lat === "number" && typeof order.lng === "number") {
        results.push({ order, time, lat: order.lat, lng: order.lng })
        continue
      }

      if (order.address) {
        const coords = await geocodeAddress(order.address)
        if (coords) {
          results.push({ order, time, lat: coords.lat, lng: coords.lng })
          continue
        }
      }

      const offset = idx * 0.005
      results.push({ order, time, lat: HUB_LAT + offset, lng: HUB_LNG + offset })
    }

    setPinned(results)
    setGeocoding(false)
  }, [orders])

  useEffect(() => { geocodeOrders() }, [geocodeOrders])

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
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setDrawerOpen(true)} style={styles.headerBtn}>
          <Feather name="menu" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Map</Text>
        <View style={styles.headerBtn}>
          {geocoding
            ? <ActivityIndicator size="small" color="#6b7280" />
            : <View style={{ width: 22 }} />}
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
          showsMyLocationButton={false}
          showsUserLocation={true}
        >
          <Marker
            coordinate={{ latitude: HUB_LAT, longitude: HUB_LNG }}
            title="Store"
            description="Victoria Garden City Hub"
          />

          {pinned.map((p) => (
            <Marker
              key={p.order.id}
              coordinate={{ latitude: p.lat, longitude: p.lng }}
              title={`#${p.order.orderNumber} - ${p.time}`}
              description={p.order.customerName}
              onPress={() => setSelected(p)}
            />
          ))}
        </MapView>

        <TouchableOpacity
          style={styles.gpsBtn}
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
          <MaterialIcons name="my-location" size={22} color="#374151" />
        </TouchableOpacity>

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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e7eb",
  },
  headerBtn: { width: 40, alignItems: "center" },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#111827" },
  gpsBtn: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    paddingBottom: 32,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -3 },
    elevation: 8,
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

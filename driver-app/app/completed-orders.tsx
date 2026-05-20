import { useState, useEffect } from "react"
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, RefreshControl } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { router } from "expo-router"
import { Feather } from "@expo/vector-icons"
import { useDriver } from "@/context/DriverContext"
import { driverFetch } from "@/lib/api"
import { formatCurrency, type Order } from "@/lib/types"
import { HUB_NAME, HUB_ADDRESS } from "@/lib/storage"

const TEAL = "#0d9488"
const CARD_BG = "#1e2535"

function formatCardTs(ts: unknown): string {
  if (!ts) return ""
  let d: Date
  if (typeof ts === "object" && ts !== null && "seconds" in ts) d = new Date((ts as { seconds: number }).seconds * 1000)
  else d = new Date(ts as string | number)
  if (isNaN(d.getTime())) return ""
  const mon = d.toLocaleString("en-US", { month: "short" })
  const day = d.getDate()
  const h = d.getHours()
  const m = d.getMinutes().toString().padStart(2, "0")
  const ampm = h >= 12 ? "PM" : "AM"
  return `${mon} ${day}, ${h % 12 || 12}:${m} ${ampm}`
}

function isToday(ts: unknown): boolean {
  if (!ts) return false
  let d: Date
  if (typeof ts === "object" && ts !== null && "seconds" in ts) d = new Date((ts as { seconds: number }).seconds * 1000)
  else d = new Date(ts as string | number)
  if (isNaN(d.getTime())) return false
  const now = new Date()
  return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
}

function isYesterday(ts: unknown): boolean {
  if (!ts) return false
  let d: Date
  if (typeof ts === "object" && ts !== null && "seconds" in ts) d = new Date((ts as { seconds: number }).seconds * 1000)
  else d = new Date(ts as string | number)
  if (isNaN(d.getTime())) return false
  const yest = new Date(); yest.setDate(yest.getDate() - 1)
  return d.getDate() === yest.getDate() && d.getMonth() === yest.getMonth() && d.getFullYear() === yest.getFullYear()
}

export default function CompletedOrdersScreen() {
  const { session } = useDriver()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [tab, setTab] = useState<"today" | "yesterday">("today")

  async function load() {
    if (!session) return
    try {
      const res = await driverFetch(`/api/driver/orders?driverId=${encodeURIComponent(session.id)}`)
      if (!res.ok) return
      const data = await res.json() as { orders?: Order[] }
      const done = (data.orders ?? []).filter((o) => o.status === "delivered" || o.status === "failed" || o.status === "cancelled")
      setOrders(done)
    } catch { /* ignore */ } finally { setLoading(false); setRefreshing(false) }
  }

  useEffect(() => { load() }, [session])

  const todayOrders = orders.filter((o) => isToday((o as any).deliveredAt ?? (o as any).startedAt ?? o.createdAt))
  const yesterdayOrders = orders.filter((o) => isYesterday((o as any).deliveredAt ?? (o as any).startedAt ?? o.createdAt))
  const shown = tab === "today" ? todayOrders : yesterdayOrders

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Completed Orders</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Tab switcher */}
      <View style={styles.tabs}>
        <TouchableOpacity style={[styles.tab, tab === "today" && styles.tabActive]} onPress={() => setTab("today")}>
          <Text style={[styles.tabText, tab === "today" && styles.tabTextActive]}>Today ({todayOrders.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tab === "yesterday" && styles.tabActive]} onPress={() => setTab("yesterday")}>
          <Text style={[styles.tabText, tab === "yesterday" && styles.tabTextActive]}>Yesterday ({yesterdayOrders.length})</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingTop: 4, paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} tintColor={TEAL} />}
      >
        {loading ? (
          <ActivityIndicator color={TEAL} style={{ marginTop: 60 }} />
        ) : shown.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyText}>There are currently no finished orders</Text>
          </View>
        ) : (
          shown.map((order) => {
            const pickupName = (order as any).pickupName ?? HUB_NAME
            const pickupAddr = (order as any).pickupAddress ?? HUB_ADDRESS
            const pickupTs = formatCardTs((order as any).startedAt ?? order.createdAt)
            const deliveryTs = formatCardTs((order as any).deliveredAt ?? (order as any).inTransitAt ?? (order as any).startedAt)
            const label = order.status === "delivered" ? "Completed" : order.status === "failed" ? "Failed" : "Cancelled"
            return (
            <TouchableOpacity key={order.id} style={styles.card} onPress={() => router.push(`/order/${order.id}` as never)} activeOpacity={0.8}>
              {/* Header: status badge + order number */}
              <View style={styles.cardHeader}>
                <View style={[styles.statusBadge, order.status !== "delivered" && styles.statusBadgeFailed]}>
                  <Text style={styles.statusText}>{label}</Text>
                </View>
                <Text style={styles.orderNum}>#{order.orderNumber}</Text>
              </View>
              <View style={styles.cardDivider} />
              {/* Pickup row */}
              <View style={styles.timelineRow}>
                <View style={styles.dotCol}>
                  <View style={styles.dot} />
                  <View style={styles.vertLine} />
                </View>
                <View style={styles.timelineBody}>
                  <View style={styles.timelineTopRow}>
                    <Text style={styles.locName} numberOfLines={1}>{pickupName}</Text>
                    <Text style={styles.locTime}>{pickupTs}</Text>
                  </View>
                  <Text style={styles.locAddr} numberOfLines={1}>{pickupAddr}</Text>
                </View>
              </View>
              {/* Delivery row */}
              <View style={styles.timelineRow}>
                <View style={styles.dotCol}>
                  <Feather name="map-pin" size={12} color="#6b7280" style={{ marginTop: 2 }} />
                </View>
                <View style={styles.timelineBody}>
                  <View style={styles.timelineTopRow}>
                    <Text style={styles.locName} numberOfLines={1}>{order.customerName}</Text>
                    <Text style={styles.locTime}>{deliveryTs}</Text>
                  </View>
                  <Text style={styles.locAddr} numberOfLines={1}>{order.address}</Text>
                </View>
              </View>
            </TouchableOpacity>
            )
          })
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontWeight: "700", color: "#111827" },
  tabs: { flexDirection: "row", margin: 16, backgroundColor: "#f3f4f6", borderRadius: 12, padding: 4 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center" },
  tabActive: { backgroundColor: "#fff", shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  tabText: { fontSize: 14, color: "#6b7280", fontWeight: "500" },
  tabTextActive: { color: "#111827", fontWeight: "700" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 14 },
  emptyIcon: { fontSize: 64, opacity: 0.3 },
  emptyText: { fontSize: 14, color: "#9ca3af", textAlign: "center", paddingHorizontal: 32 },
  card: { backgroundColor: CARD_BG, borderRadius: 14, marginHorizontal: 16, marginBottom: 12, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 14 },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  statusBadge: { backgroundColor: "#374151", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  statusBadgeFailed: { backgroundColor: "#7f1d1d" },
  statusText: { fontSize: 12, fontWeight: "700", color: "#fff" },
  orderNum: { fontSize: 13, fontWeight: "700", color: "#e5e7eb" },
  cardDivider: { height: 1, backgroundColor: "rgba(255,255,255,0.08)", marginBottom: 12 },
  timelineRow: { flexDirection: "row", gap: 10, minHeight: 44 },
  dotCol: { width: 16, alignItems: "center", paddingTop: 2 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#6b7280" },
  vertLine: { width: 1, flex: 1, backgroundColor: "#374151", marginTop: 4 },
  timelineBody: { flex: 1, paddingBottom: 8 },
  timelineTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 },
  locName: { fontSize: 13, fontWeight: "600", color: "#94a3b8", flex: 1 },
  locTime: { fontSize: 12, color: "#94a3b8", flexShrink: 0 },
  locAddr: { fontSize: 12, color: "#6b7280", marginTop: 2 },
})

import { useState, useEffect } from "react"
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, RefreshControl } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { router } from "expo-router"
import { Feather } from "@expo/vector-icons"
import { useDriver } from "@/context/DriverContext"
import { driverFetch } from "@/lib/api"
import { formatCurrency, type Order } from "@/lib/types"

const TEAL = "#0d9488"

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
        contentContainerStyle={{ flexGrow: 1 }}
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
          shown.map((order) => (
            <View key={order.id} style={styles.card}>
              <View style={styles.cardLeft}>
                <Feather name={order.status === "delivered" ? "check-circle" : "x-circle"} size={18} color={order.status === "delivered" ? TEAL : "#ef4444"} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.orderNum}># {order.orderNumber}</Text>
                  <Text style={styles.customer} numberOfLines={1}>{order.customerName}</Text>
                </View>
              </View>
              <Text style={styles.amount}>{formatCurrency(order.amount)}</Text>
            </View>
          ))
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
  card: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  cardLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  orderNum: { fontSize: 14, fontWeight: "600", color: "#374151" },
  customer: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  amount: { fontSize: 14, fontWeight: "600", color: "#111827", marginLeft: 12 },
})

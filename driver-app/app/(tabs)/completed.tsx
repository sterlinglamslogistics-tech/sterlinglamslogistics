import { useState, useEffect, useCallback } from "react"
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, RefreshControl, TouchableOpacity } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { router, useFocusEffect } from "expo-router"
import { useDriver } from "@/context/DriverContext"
import { driverFetch } from "@/lib/api"
import { formatCurrency, type Order } from "@/lib/types"
import { Feather } from "@expo/vector-icons"

const GREEN = "#16a34a"

const TERMINAL_STATUSES = new Set(["delivered", "failed", "cancelled"])

export default function CompletedScreen() {
  const { session, orders: contextOrders } = useDriver()
  const [fetchedOrders, setFetchedOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (showSpinner = true) => {
    if (!session) { setLoading(false); return }
    if (showSpinner) setLoading(true)
    try {
      const res = await driverFetch(`/api/driver/orders?driverId=${encodeURIComponent(session.id)}&history=true`)
      if (!res.ok) return
      const data = await res.json() as { orders?: Order[] }
      setFetchedOrders(data.orders ?? [])
    } catch { /* ignore */ } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [session])

  // Initial load when session becomes available
  useEffect(() => { void load() }, [load])

  // Re-fetch every time the tab is focused — catches newly completed orders
  // that the driver finished after opening this screen for the first time.
  useFocusEffect(
    useCallback(() => { void load(false) }, [load])
  )

  // Merge API results with context orders so an order the driver just
  // completed (which is already in context via refreshOrders) shows up
  // even if the API response is briefly stale.
  const merged = new Map<string, Order>()
  for (const o of fetchedOrders) if (TERMINAL_STATUSES.has(o.status)) merged.set(o.id, o)
  for (const o of contextOrders) if (TERMINAL_STATUSES.has(o.status) && !merged.has(o.id)) merged.set(o.id, o)

  const orders = [...merged.values()].sort((a, b) => {
    const ta = parseTs((a as any).deliveredAt ?? (a as any).failedAt ?? a.createdAt)
    const tb = parseTs((b as any).deliveredAt ?? (b as any).failedAt ?? b.createdAt)
    return tb - ta
  })

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>History</Text>
        {orders.length > 0 && (
          <Text style={styles.headerCount}>{orders.length}</Text>
        )}
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(false) }} tintColor={GREEN} />}
      >
        {loading ? (
          <ActivityIndicator color={GREEN} style={{ marginTop: 60 }} />
        ) : orders.length === 0 ? (
          <>
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📋</Text>
              <Text style={styles.emptyText}>No completed deliveries yet</Text>
              <Text style={styles.emptyHint}>Pull down to refresh</Text>
            </View>
            {/* Temporary diagnostic — remove once completed orders are showing.
                Tells us exactly what the API + context have so we know whether
                the issue is upstream (API not returning orders) or in the filter. */}
            <View style={styles.debugBox}>
              <Text style={styles.debugTitle}>Diagnostic</Text>
              <Text style={styles.debugLine}>Driver id: {session?.id ?? "(no session)"}</Text>
              <Text style={styles.debugLine}>API returned: {fetchedOrders.length} order(s)</Text>
              <Text style={styles.debugLine}>Context has: {contextOrders.length} order(s)</Text>
              <Text style={styles.debugLine}>API statuses: {fetchedOrders.map(o => `${o.orderNumber}:${o.status}`).join(", ") || "(none)"}</Text>
              <Text style={styles.debugLine}>Context statuses: {contextOrders.map(o => `${o.orderNumber}:${o.status}`).join(", ") || "(none)"}</Text>
            </View>
          </>
        ) : (
          orders.map((order) => (
            <TouchableOpacity key={order.id} style={styles.card} onPress={() => router.push(`/order/${order.id}` as never)} activeOpacity={0.7}>
              <View style={styles.cardLeft}>
                {order.status === "delivered"
                  ? <Feather name="check-circle" size={20} color={GREEN} />
                  : <Feather name="x-circle" size={20} color="#ef4444" />
                }
                <View style={{ flex: 1 }}>
                  <Text style={styles.orderNum}>{order.orderNumber}</Text>
                  <Text style={styles.customerName} numberOfLines={1}>{order.customerName}</Text>
                  <Text style={styles.address} numberOfLines={1}>{order.address}</Text>
                </View>
              </View>
              <View style={styles.cardRight}>
                <Text style={styles.amount}>{formatCurrency(order.amount)}</Text>
                <View style={[styles.badge, { backgroundColor: order.status === "delivered" ? "#dcfce7" : "#fee2e2" }]}>
                  <Text style={[styles.badgeText, { color: order.status === "delivered" ? "#15803d" : "#b91c1c" }]}>
                    {order.status === "delivered" ? "Delivered" : order.status === "failed" ? "Failed" : "Cancelled"}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

// Parse a Firestore timestamp / number / string / Date into a millis number.
// Returns 0 for unparseable input so sort puts those entries last.
function parseTs(ts: unknown): number {
  if (!ts) return 0
  if (ts instanceof Date) return ts.getTime()
  if (typeof ts === "number") return ts
  if (typeof ts === "object" && ts !== null && ("seconds" in ts || "_seconds" in ts)) {
    const secs = ("_seconds" in ts) ? (ts as any)._seconds : (ts as any).seconds
    return typeof secs === "number" ? secs * 1000 : 0
  }
  if (typeof ts === "string") {
    const d = new Date(ts).getTime()
    return isNaN(d) ? 0 : d
  }
  return 0
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#111827" },
  headerCount: { fontSize: 13, fontWeight: "600", color: "#6b7280", backgroundColor: "#f3f4f6", paddingHorizontal: 10, paddingVertical: 3, borderRadius: 100, overflow: "hidden" },
  content: { padding: 16, gap: 10, paddingBottom: 32 },
  empty: { alignItems: "center", paddingTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 15, color: "#9ca3af" },
  emptyHint: { fontSize: 12, color: "#d1d5db", marginTop: 8 },
  card: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: "#e5e7eb", padding: 14 },
  cardLeft: { flexDirection: "row", gap: 10, alignItems: "flex-start", flex: 1 },
  cardRight: { alignItems: "flex-end", gap: 6, marginLeft: 8 },
  orderNum: { fontSize: 14, fontWeight: "700", color: "#111827" },
  customerName: { fontSize: 12, color: "#6b7280", marginTop: 1 },
  address: { fontSize: 11, color: "#9ca3af", marginTop: 1, maxWidth: 180 },
  amount: { fontSize: 14, fontWeight: "700", color: "#111827" },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100 },
  badgeText: { fontSize: 10, fontWeight: "600" },
  debugBox: { marginTop: 24, padding: 12, borderRadius: 8, backgroundColor: "#fef3c7", borderWidth: 1, borderColor: "#fde68a", gap: 4 },
  debugTitle: { fontSize: 12, fontWeight: "700", color: "#92400e", marginBottom: 4 },
  debugLine: { fontSize: 11, color: "#78350f", fontFamily: "monospace" },
})

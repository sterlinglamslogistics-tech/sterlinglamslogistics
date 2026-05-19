import { useState, useEffect } from "react"
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, RefreshControl, TouchableOpacity } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { router } from "expo-router"
import { useDriver } from "@/context/DriverContext"
import { driverFetch } from "@/lib/api"
import { formatCurrency, type Order } from "@/lib/types"
import { Feather } from "@expo/vector-icons"

const GREEN = "#16a34a"

export default function CompletedScreen() {
  const { session } = useDriver()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  async function load() {
    if (!session) return
    try {
      const res = await driverFetch(`/api/driver/orders?driverId=${encodeURIComponent(session.id)}&history=true`)
      if (!res.ok) return
      const data = await res.json() as { orders?: Order[] }
      const done = (data.orders ?? []).filter((o) => o.status === "delivered" || o.status === "failed" || o.status === "cancelled")
      setOrders(done.reverse())
    } catch { /* ignore */ } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { load() }, [session])

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      <View style={styles.header}><Text style={styles.headerTitle}>History</Text></View>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} tintColor={GREEN} />}
      >
        {loading ? (
          <ActivityIndicator color={GREEN} style={{ marginTop: 60 }} />
        ) : orders.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyText}>No completed deliveries yet</Text>
          </View>
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

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#111827" },
  content: { padding: 16, gap: 10, paddingBottom: 32 },
  empty: { alignItems: "center", paddingTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 15, color: "#9ca3af" },
  card: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: "#e5e7eb", padding: 14 },
  cardLeft: { flexDirection: "row", gap: 10, alignItems: "flex-start", flex: 1 },
  cardRight: { alignItems: "flex-end", gap: 6, marginLeft: 8 },
  orderNum: { fontSize: 14, fontWeight: "700", color: "#111827" },
  customerName: { fontSize: 12, color: "#6b7280", marginTop: 1 },
  address: { fontSize: 11, color: "#9ca3af", marginTop: 1, maxWidth: 180 },
  amount: { fontSize: 14, fontWeight: "700", color: "#111827" },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100 },
  badgeText: { fontSize: 10, fontWeight: "600" },
})

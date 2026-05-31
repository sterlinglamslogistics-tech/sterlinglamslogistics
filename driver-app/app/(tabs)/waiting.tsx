import { useState, useCallback } from "react"
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, Linking,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { router } from "expo-router"
import { Feather } from "@expo/vector-icons"
import { useDriver } from "@/context/DriverContext"
import { driverFetch } from "@/lib/api"
import { formatCurrency, type Order } from "@/lib/types"
import { getNavApp, buildNavUrl } from "@/lib/storage"

const ORANGE = "#f97316"
const TEAL = "#0d9488"

function formatOrderTime(ts: unknown): string {
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

export default function WaitingScreen() {
  const { session, orders, loadingOrders, refreshOrders, patchOrder, setDrawerOpen } = useDriver()
  const [refreshing, setRefreshing] = useState(false)
  const [pendingId, setPendingId] = useState<string | null>(null)

  const waitingOrders = orders.filter((o) => o.status === "unassigned")

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await refreshOrders()
    setRefreshing(false)
  }, [refreshOrders])

  async function startOrder(order: Order) {
    if (!session || pendingId) return
    setPendingId(order.id)
    try {
      const res = await driverFetch(`/api/driver/orders/${encodeURIComponent(order.id)}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driverId: session.id, status: "started" }),
      })
      if (res.ok) {
        patchOrder(order.id, { status: "started" })
        void refreshOrders()
      }
    } catch { /* ignore */ } finally {
      setPendingId(null)
    }
  }

  async function navigate(address: string) {
    const app = await getNavApp()
    Linking.openURL(buildNavUrl(address, app)).catch(() => {})
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setDrawerOpen(true)} style={styles.headerIconBtn}>
          <Feather name="menu" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          Waiting{waitingOrders.length > 0 ? ` (${waitingOrders.length})` : ""}
        </Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ORANGE} />}
      >
        {loadingOrders && !refreshing ? (
          <ActivityIndicator color={ORANGE} style={{ marginTop: 60 }} />
        ) : waitingOrders.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyIcon}>⏳</Text>
            <Text style={styles.emptyTitle}>No queued orders</Text>
            <Text style={styles.emptySub}>Orders assigned to you will appear here</Text>
          </View>
        ) : (
          waitingOrders.map((order, idx) => {
            const time = formatOrderTime(order.createdAt)
            const isLast = idx === waitingOrders.length - 1
            return (
              <View key={order.id} style={[styles.card, isLast && styles.cardLast]}>
                {/* Top row: order number + nav icon */}
                <View style={styles.cardTop}>
                  <TouchableOpacity onPress={() => router.push(`/order/${order.id}` as never)}>
                    <Text style={styles.orderNum}># {order.orderNumber}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => navigate(order.address)} style={styles.iconBtn}>
                    <Feather name="send" size={18} color="#374151" />
                  </TouchableOpacity>
                </View>

                {/* Customer info */}
                <TouchableOpacity onPress={() => router.push(`/order/${order.id}` as never)}>
                  <View style={styles.customerRow}>
                    <Feather name="user" size={14} color="#9ca3af" style={{ marginTop: 2 }} />
                    <Text style={styles.customerName}>{order.customerName}</Text>
                    {time ? <Text style={styles.timeText}>{time}</Text> : null}
                  </View>
                  <View style={styles.addressRow}>
                    <Feather name="map-pin" size={14} color="#9ca3af" style={{ marginTop: 2 }} />
                    <Text style={styles.address}>{order.address}</Text>
                  </View>
                  <Text style={styles.amount}>{formatCurrency(order.amount)}</Text>
                </TouchableOpacity>

                {/* Start button */}
                <TouchableOpacity
                  style={[styles.startBtn, !!pendingId && styles.startBtnDisabled]}
                  onPress={() => startOrder(order)}
                  disabled={!!pendingId}
                  activeOpacity={0.85}
                >
                  {pendingId === order.id
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={styles.startBtnText}>Start Order  →</Text>}
                </TouchableOpacity>
              </View>
            )
          })
        )}
        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#111827" },
  headerIconBtn: { padding: 6 },
  emptyWrap: { alignItems: "center", paddingTop: 100 },
  emptyIcon: { fontSize: 52, marginBottom: 16 },
  emptyTitle: { fontSize: 17, fontWeight: "600", color: "#374151" },
  emptySub: { fontSize: 13, color: "#9ca3af", marginTop: 6 },
  card: { borderBottomWidth: 1, borderBottomColor: "#f3f4f6", paddingHorizontal: 16, paddingVertical: 14 },
  cardLast: { borderBottomWidth: 0 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  orderNum: { fontSize: 14, fontWeight: "700", color: "#374151" },
  iconBtn: { padding: 4 },
  customerRow: { flexDirection: "row", alignItems: "flex-start", gap: 6, marginBottom: 4 },
  customerName: { fontSize: 16, fontWeight: "700", color: "#111827", flex: 1 },
  timeText: { fontSize: 12, color: "#9ca3af", marginLeft: 4 },
  addressRow: { flexDirection: "row", alignItems: "flex-start", gap: 6, marginBottom: 6 },
  address: { fontSize: 13, color: "#6b7280", flex: 1, lineHeight: 18 },
  amount: { fontSize: 13, color: TEAL, fontWeight: "600", marginBottom: 12 },
  startBtn: { backgroundColor: ORANGE, borderRadius: 100, paddingVertical: 13, alignItems: "center", justifyContent: "center" },
  startBtnDisabled: { opacity: 0.5 },
  startBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
})

import { useState, useEffect } from "react"
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Linking,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useLocalSearchParams, router } from "expo-router"
import { Feather } from "@expo/vector-icons"
import { driverFetch } from "@/lib/api"
import { formatCurrency, type Order } from "@/lib/types"
import { getNavApp, buildNavUrl, HUB_NAME, HUB_ADDRESS, HUB_PHONE } from "@/lib/storage"

const TEAL = "#0d9488"

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    started:      { bg: "#fef9c3", text: "#a16207", label: "Started" },
    "picked-up":  { bg: "#ffedd5", text: "#c2410c", label: "Picked up" },
    "in-transit": { bg: "#dcfce7", text: "#15803d", label: "On the way" },
    delivered:    { bg: "#d1fae5", text: "#065f46", label: "Delivered" },
    failed:       { bg: "#fee2e2", text: "#b91c1c", label: "Failed" },
    unassigned:   { bg: "#f3f4f6", text: "#6b7280", label: "Unassigned" },
  }
  const c = config[status] ?? { bg: "#f3f4f6", text: "#6b7280", label: status }
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <Text style={[styles.badgeText, { color: c.text }]}>{c.label}</Text>
    </View>
  )
}

function formatTs(ts: unknown): string {
  if (!ts) return ""
  let d: Date
  if (ts instanceof Date) d = ts
  else if (typeof ts === "number") d = new Date(ts)
  else if (typeof ts === "object" && ts !== null && "seconds" in ts) d = new Date((ts as { seconds: number }).seconds * 1000)
  else if (typeof ts === "string") d = new Date(ts)
  else return ""
  if (isNaN(d.getTime())) return ""
  return d.toLocaleDateString("en-NG", { day: "2-digit", month: "short", year: "numeric" }) +
    ", " + d.toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit", hour12: true }).toUpperCase()
}

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    driverFetch(`/api/driver/orders/${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .then((d: { ok?: boolean; order?: Order }) => setOrder(d.order ?? null))
      .catch(() => setOrder(null))
      .finally(() => setLoading(false))
  }, [id])

  async function navigate(address: string) {
    const app = await getNavApp()
    Linking.openURL(buildNavUrl(address, app)).catch(() => { })
  }

  if (loading) return <SafeAreaView style={styles.center}><ActivityIndicator size="large" color={TEAL} /></SafeAreaView>
  if (!order) return (
    <SafeAreaView style={styles.center}>
      <Text style={{ color: "#6b7280" }}>Order not found</Text>
      <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
        <Text style={{ color: TEAL, fontWeight: "600" }}>Go Back</Text>
      </TouchableOpacity>
    </SafeAreaView>
  )

  const paymentMethod = (order.paymentMethod ?? "Online").toUpperCase()
  const placementTime = formatTs(order.createdAt)
  const pickupTime = formatTs((order as any).startedAt ?? order.createdAt)
  const deliveryTime = formatTs((order as any).inTransitAt ?? (order as any).startedAt ?? order.createdAt)
  const itemsTotal = (order.items ?? []).reduce((s, i) => s + (i.price ?? 0), 0)

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Order Details</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Payment type */}
        <Text style={styles.paymentLabel}>{paymentMethod}</Text>

        {/* Order # + status + navigate */}
        <View style={styles.orderRow}>
          <View>
            <Text style={styles.orderNum}>Order #: <Text style={styles.orderNumBold}>{order.orderNumber}</Text></Text>
            <Text style={styles.orderAmount}>({formatCurrency(order.amount)})</Text>
          </View>
          <View style={styles.orderRowRight}>
            <StatusBadge status={order.status} />
            <TouchableOpacity onPress={() => navigate(order.address)} style={styles.navIcon}>
              <Feather name="send" size={18} color="#374151" />
            </TouchableOpacity>
          </View>
        </View>

        {placementTime ? (
          <Text style={styles.placementTime}>Placement time: {placementTime}</Text>
        ) : null}

        <View style={styles.divider} />

        {/* Timeline */}
        <View style={styles.timeline}>
          {/* Pickup */}
          <View style={styles.timelineRow}>
            <View style={styles.timelineLine}>
              <View style={styles.timelineDotGray} />
              <View style={styles.timelineBar} />
            </View>
            <View style={styles.timelineContent}>
              <Text style={styles.timelineLabel}>Pick up  <Text style={styles.timelineBold}>{pickupTime}</Text></Text>
              <Text style={styles.timelineName}>{HUB_NAME}</Text>
              <Text style={styles.timelineAddress}>{HUB_ADDRESS}</Text>
              {HUB_PHONE ? (
                <TouchableOpacity onPress={() => Linking.openURL(`tel:${HUB_PHONE}`).catch(() => {})}>
                  <Text style={styles.phoneLink}>{HUB_PHONE}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          {/* Delivery */}
          <View style={styles.timelineRow}>
            <View style={styles.timelineLine}>
              <View style={styles.timelineDotGray} />
            </View>
            <View style={styles.timelineContent}>
              <Text style={styles.timelineLabel}>Delivery  <Text style={styles.timelineBold}>{deliveryTime}</Text></Text>
              <Text style={styles.timelineName}>{order.customerName}</Text>
              <Text style={styles.timelineAddress}>{order.address}</Text>
              {order.phone ? (
                <TouchableOpacity onPress={() => Linking.openURL(`tel:${order.phone}`).catch(() => {})}>
                  <Text style={styles.phoneLink}>{order.phone}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Customer note */}
        {order.deliveryInstruction ? (
          <>
            <Text style={styles.sectionLabel}>CUSTOMER NOTE</Text>
            <View style={styles.customerNoteBox}>
              <Text style={styles.customerNoteText}>{order.deliveryInstruction}</Text>
            </View>
            <View style={styles.divider} />
          </>
        ) : null}

        {/* Order items */}
        <Text style={styles.sectionLabel}>ORDER ITEMS</Text>
        {(order.items ?? []).map((item, i) => (
          <View key={i} style={styles.itemRow}>
            <View style={styles.itemQtyBadge}>
              <Text style={styles.itemQtyText}>{item.qty ?? 1}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName}>{item.name}</Text>
              {item.meta ? <Text style={styles.itemMeta}>{item.meta}</Text> : null}
            </View>
            {item.price ? <Text style={styles.itemPrice}>{formatCurrency(item.price)}</Text> : null}
          </View>
        ))}

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Items Total:</Text>
          <Text style={styles.totalValue}>{formatCurrency(itemsTotal || order.amount)}</Text>
        </View>

        <View style={styles.divider} />

        {/* Financial breakdown */}
        {[
          { label: "Tax:", value: order.tax ?? 0 },
          { label: "Delivery Fee:", value: order.deliveryFees ?? 0 },
          { label: "Delivery Tips:", value: order.deliveryTips ?? 0 },
        ].map((row) => (
          <View key={row.label} style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>{row.label}</Text>
            <Text style={styles.breakdownValue}>{formatCurrency(row.value)}</Text>
          </View>
        ))}
        {(order.discount ?? 0) > 0 && (
          <View style={styles.breakdownRow}>
            <Text style={[styles.breakdownLabel, { color: "#ef4444" }]}>Discount:</Text>
            <Text style={styles.breakdownValue}>{formatCurrency(order.discount ?? 0)}</Text>
          </View>
        )}

        <View style={styles.grandTotalRow}>
          <Text style={styles.grandTotalLabel}>Total</Text>
          <Text style={styles.grandTotalValue}>{formatCurrency(order.amount)}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontWeight: "700", color: "#111827" },
  content: { padding: 16, paddingBottom: 40 },
  paymentLabel: { fontSize: 12, color: "#9ca3af", fontWeight: "600", marginBottom: 8 },
  orderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 },
  orderNum: { fontSize: 15, color: "#374151" },
  orderNumBold: { fontWeight: "700", color: "#111827" },
  orderAmount: { fontSize: 14, color: "#374151", marginTop: 2 },
  orderRowRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  navIcon: { padding: 4 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  badgeText: { fontSize: 12, fontWeight: "600" },
  placementTime: { fontSize: 13, color: "#6b7280", marginTop: 6 },
  divider: { height: 1, backgroundColor: "#f3f4f6", marginVertical: 16 },
  timeline: { gap: 0 },
  timelineRow: { flexDirection: "row", gap: 14, marginBottom: 20 },
  timelineLine: { alignItems: "center", width: 16 },
  timelineDotGray: { width: 12, height: 12, borderRadius: 6, backgroundColor: "#9ca3af", marginTop: 3 },
  timelineBar: { width: 2, flex: 1, backgroundColor: "#e5e7eb", marginTop: 4 },
  timelineContent: { flex: 1, paddingBottom: 8 },
  timelineLabel: { fontSize: 13, color: "#9ca3af", marginBottom: 4 },
  timelineBold: { fontWeight: "700", color: "#111827" },
  timelineName: { fontSize: 15, fontWeight: "700", color: "#111827", marginBottom: 2 },
  timelineAddress: { fontSize: 13, color: "#6b7280", marginBottom: 6, lineHeight: 18 },
  phoneLink: { fontSize: 14, color: TEAL, fontWeight: "500" },
  sectionLabel: { fontSize: 12, fontWeight: "600", color: "#9ca3af", textAlign: "center", letterSpacing: 1, marginBottom: 12 },
  itemRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 8 },
  itemQtyBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#9ca3af", alignItems: "center", justifyContent: "center" },
  itemQtyText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  itemName: { fontSize: 14, color: "#374151", flex: 1 },
  itemMeta: { fontSize: 12, color: TEAL, fontWeight: "600", marginTop: 2 },
  itemPrice: { fontSize: 14, fontWeight: "600", color: "#111827" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, borderTopWidth: 1, borderTopColor: "#f3f4f6", marginTop: 4 },
  totalLabel: { fontSize: 15, fontWeight: "700", color: "#111827" },
  totalValue: { fontSize: 15, fontWeight: "700", color: "#111827" },
  breakdownRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  breakdownLabel: { fontSize: 14, color: "#374151" },
  breakdownValue: { fontSize: 14, color: "#374151" },
  grandTotalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 14, borderTopWidth: 1, borderBottomWidth: 1, borderColor: "#f3f4f6", marginTop: 8 },
  grandTotalLabel: { fontSize: 17, fontWeight: "700", color: "#111827" },
  grandTotalValue: { fontSize: 17, fontWeight: "700", color: "#111827" },
  customerNoteBox: { backgroundColor: "#fefce8", borderRadius: 8, padding: 12, marginBottom: 4, borderWidth: 1, borderColor: "#fef08a" },
  customerNoteText: { fontSize: 14, color: "#374151", lineHeight: 20 },
})

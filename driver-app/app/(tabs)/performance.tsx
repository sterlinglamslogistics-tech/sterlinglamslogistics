import { useState, useCallback } from "react"
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator,
  RefreshControl, TouchableOpacity,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { Feather } from "@expo/vector-icons"
import { useDriver } from "@/context/DriverContext"
import { formatCurrency, type Order } from "@/lib/types"

const TEAL = "#0d9488"

type Period = "thisWeek" | "lastWeek" | "thisMonth"

function getDateRange(period: Period): { start: Date; end: Date; label: string } {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const dayOfWeek = today.getDay()
  const monday = new Date(today); monday.setDate(today.getDate() - ((dayOfWeek + 6) % 7))
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6)

  if (period === "thisWeek") {
    return { start: monday, end: sunday, label: "This Week" }
  } else if (period === "lastWeek") {
    const lastMon = new Date(monday); lastMon.setDate(monday.getDate() - 7)
    const lastSun = new Date(lastMon); lastSun.setDate(lastMon.getDate() + 6)
    return { start: lastMon, end: lastSun, label: "Last Week" }
  } else {
    const first = new Date(now.getFullYear(), now.getMonth(), 1)
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    return { start: first, end: last, label: "This Month" }
  }
}

function fmt(d: Date): string {
  return d.toLocaleDateString("en-NG", { month: "short", day: "2-digit", year: "numeric" })
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
    </View>
  )
}

export default function PerformanceScreen() {
  const { session, driver, orders, loadingOrders, refreshOrders, setDrawerOpen } = useDriver()
  const [refreshing, setRefreshing] = useState(false)
  const [period, setPeriod] = useState<Period>("thisWeek")
  const [dropOpen, setDropOpen] = useState(false)

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await refreshOrders()
    setRefreshing(false)
  }, [refreshOrders])

  const { start, end, label } = getDateRange(period)

  function inRange(order: Order): boolean {
    const ts = order.deliveredAt ?? order.startedAt ?? order.createdAt
    if (!ts) return false
    let d: Date
    if (typeof ts === "object" && ts !== null && "seconds" in ts) d = new Date((ts as { seconds: number }).seconds * 1000)
    else d = new Date(ts as string | number)
    return d >= start && d <= end
  }

  const periodOrders = orders.filter(inRange)
  const delivered = periodOrders.filter((o) => o.status === "delivered")
  const failed = periodOrders.filter((o) => o.status === "failed")
  const total = delivered.length + failed.length
  const successRate = total > 0 ? Math.round((delivered.length / total) * 100) : 0
  const earnings = delivered.reduce((s, o) => s + (o.deliveryFees ?? 0), 0)
  const rating = driver?.rating ?? 0

  const periods: Period[] = ["thisWeek", "lastWeek", "thisMonth"]
  const periodLabels: Record<Period, string> = { thisWeek: "This Week", lastWeek: "Last Week", thisMonth: "This Month" }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f3f4f6" }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setDrawerOpen(true)} style={styles.headerIconBtn}>
          <Feather name="menu" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Performance</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={TEAL} />}
      >
        {/* Period selector */}
        <View style={styles.periodRow}>
          <TouchableOpacity style={styles.periodBtn} onPress={() => setDropOpen(!dropOpen)}>
            <Text style={styles.periodBtnText}>{label}</Text>
            <Feather name="chevron-down" size={14} color="#374151" />
          </TouchableOpacity>
          <Text style={styles.dateRange}>{fmt(start)} - {fmt(end)}</Text>
        </View>

        {dropOpen && (
          <View style={styles.dropdown}>
            {periods.map((p) => (
              <TouchableOpacity key={p} style={styles.dropItem} onPress={() => { setPeriod(p); setDropOpen(false) }}>
                <Text style={[styles.dropItemText, period === p && { color: TEAL, fontWeight: "700" }]}>{periodLabels[p]}</Text>
                {period === p && <Feather name="check" size={16} color={TEAL} />}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {loadingOrders && !refreshing ? (
          <ActivityIndicator color={TEAL} style={{ marginTop: 60 }} />
        ) : (
          <View style={styles.grid}>
            <StatCard label="Customer Rating" value={rating > 0 ? rating.toFixed(2) : "—"} />
            <StatCard label="On time or early" value={`${successRate}%`} />
            <StatCard label="Acceptance Rate" value="—" />
            <StatCard label="Completed Deliveries" value={String(delivered.length)} />
            <StatCard label="Earnings" value={formatCurrency(earnings)} />
            <StatCard label="Online Hours" value="—" />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#111827" },
  headerIconBtn: { padding: 6 },
  content: { padding: 16, paddingBottom: 40 },
  periodRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  periodBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8 },
  periodBtnText: { fontSize: 15, fontWeight: "600", color: "#374151" },
  dateRange: { fontSize: 13, color: "#6b7280" },
  dropdown: { backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#e5e7eb", marginBottom: 12, overflow: "hidden" },
  dropItem: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  dropItemText: { fontSize: 15, color: "#374151" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 8 },
  statCard: { width: "47%", backgroundColor: "#fff", borderRadius: 14, padding: 16, minHeight: 90, justifyContent: "flex-end" },
  statValue: { fontSize: 28, fontWeight: "800", color: "#111827", marginBottom: 4 },
  statLabel: { fontSize: 13, color: "#6b7280" },
  statSub: { fontSize: 11, color: "#9ca3af" },
})

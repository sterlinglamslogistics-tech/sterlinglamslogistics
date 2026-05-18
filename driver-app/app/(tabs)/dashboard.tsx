import { useState, useCallback } from "react"
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  RefreshControl, Modal, ActivityIndicator, Linking, Image,
} from "react-native"
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context"
import { router } from "expo-router"
import { Feather, MaterialIcons } from "@expo/vector-icons"
import { useDriver } from "@/context/DriverContext"
import { driverFetch } from "@/lib/api"
import { getNavApp, buildNavUrl, HUB_ADDRESS, HUB_PHONE } from "@/lib/storage"
import type { Order } from "@/lib/types"

const GREEN = "#16a34a"
const ORANGE = "#f97316"
const TEAL = "#0d9488"

// ─── Status badge ────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    started:    { bg: "#fef9c3", text: "#a16207", label: "Started" },
    "picked-up":{ bg: "#ffedd5", text: "#c2410c", label: "Picked up" },
    "in-transit":{ bg: "#dcfce7", text: "#15803d", label: "On the way" },
    unassigned: { bg: "#f3f4f6", text: "#6b7280", label: "Unassigned" },
  }
  const c = config[status] ?? { bg: "#f3f4f6", text: "#6b7280", label: status }
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <Text style={[styles.badgeText, { color: c.text }]}>{c.label}</Text>
    </View>
  )
}

// ─── Format time from Firestore timestamp ────────────────────────────────────
function formatOrderTime(ts: unknown): { time: string; date: string } {
  if (!ts) return { time: "", date: "" }
  let d: Date
  if (ts instanceof Date) d = ts
  else if (typeof ts === "number") d = new Date(ts)
  else if (typeof ts === "object" && ts !== null && "seconds" in ts) {
    d = new Date((ts as { seconds: number }).seconds * 1000)
  } else if (typeof ts === "string") d = new Date(ts)
  else return { time: "", date: "" }
  if (isNaN(d.getTime())) return { time: "", date: "" }
  const time = d.toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit", hour12: true }).toUpperCase()
  const date = d.toLocaleDateString("en-NG", { day: "2-digit", month: "short" })
  return { time, date }
}

export default function DashboardScreen() {
  const { session, orders, isOnline, loadingOrders, gpsError, pendingDeliveryCount, profilePhoto, goOnline, refreshOrders, setDrawerOpen } = useDriver()
  const insets = useSafeAreaInsets()
  const [refreshing, setRefreshing] = useState(false)
  const [pendingId, setPendingId] = useState<string | null>(null)
  // Modals
  const [checklistOrder, setChecklistOrder] = useState<Order | null>(null)
  const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set())
  const [podOrder, setPodOrder] = useState<Order | null>(null)
  const [navSheet, setNavSheet] = useState<Order | null>(null)
  const [contactSheet, setContactSheet] = useState<Order | null>(null)
  const [routeOptionsOpen, setRouteOptionsOpen] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  const activeOrders = orders.filter(
    (o) => o.status === "started" || o.status === "picked-up" || o.status === "in-transit"
  )

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await refreshOrders()
    setRefreshing(false)
  }, [refreshOrders])

  // ── Status update ──────────────────────────────────────────────────────────
  async function updateStatus(order: Order, status: string) {
    if (!session || pendingId) return
    setPendingId(order.id)
    try {
      const res = await driverFetch(`/api/driver/orders/${encodeURIComponent(order.id)}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driverId: session.id, status }),
      })
      if (res.ok) await refreshOrders()
    } catch { /* ignore */ } finally {
      setPendingId(null)
    }
  }

  // ── "Mark as Picked Up" → open item checklist ──────────────────────────────
  function openChecklist(order: Order) {
    setCheckedItems(new Set())
    setChecklistOrder(order)
  }

  async function confirmPickedUp() {
    if (!checklistOrder) return
    setActionLoading(true)
    await updateStatus(checklistOrder, "picked-up")
    setChecklistOrder(null)
    setActionLoading(false)
  }

  // ── Navigation sheet ───────────────────────────────────────────────────────
  async function openNav(url: string) {
    setNavSheet(null)
    setTimeout(() => Linking.openURL(url).catch(() => { }), 300)
  }

  async function handleNavOption(order: Order, dest: "customer" | "pickup") {
    const app = await getNavApp()
    const address = dest === "pickup" ? HUB_ADDRESS : order.address
    openNav(buildNavUrl(address, app))
  }

  // ── Contact sheet ──────────────────────────────────────────────────────────
  function handleCall(phone: string) {
    if (!phone) return
    setContactSheet(null)
    setTimeout(() => Linking.openURL(`tel:${phone}`).catch(() => { }), 300)
  }
  function handleSMS(phone: string) {
    if (!phone) return
    setContactSheet(null)
    setTimeout(() => Linking.openURL(`sms:${phone}`).catch(() => { }), 300)
  }
  function handleWhatsApp(phone: string) {
    if (!phone) return
    setContactSheet(null)
    const cleaned = phone.replace(/\D/g, "")
    setTimeout(() => Linking.openURL(`whatsapp://send?phone=${cleaned}`).catch(() => { }), 300)
  }

  // ── Route options ──────────────────────────────────────────────────────────
  async function pickUpAllOrders() {
    setRouteOptionsOpen(false)
    const started = activeOrders.filter((o) => o.status === "started")
    if (started.length === 0) return
    for (const order of started) {
      await updateStatus(order, "picked-up")
    }
  }

  // ── Offline welcome screen ─────────────────────────────────────────────────
  if (!isOnline) {
    const name = session?.name ?? "Driver"
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
        <TouchableOpacity style={styles.hamburger} onPress={() => setDrawerOpen(true)}>
          <Feather name="menu" size={22} color="#111827" />
        </TouchableOpacity>

        <View style={styles.offlineTop}>
          {profilePhoto ? (
            <Image source={{ uri: profilePhoto }} style={styles.offlineAvatar} />
          ) : (
            <View style={[styles.offlineAvatar, styles.offlineAvatarFallback]}>
              <Text style={styles.offlineAvatarText}>{name.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <Text style={styles.helloText}>Hello, {name}</Text>
          <Text style={styles.welcomeBack}>Welcome back</Text>
        </View>

        <View style={styles.offlineBottom}>
          <Text style={styles.startText}>Start taking orders</Text>
          <TouchableOpacity style={styles.goOnlineBtn} onPress={goOnline} activeOpacity={0.85}>
            <Text style={styles.goOnlineBtnText}>Go Online</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  // ── Online orders list ────────────────────────────────────────────────────
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setDrawerOpen(true)} style={styles.headerIconBtn}>
          <Feather name="menu" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Orders</Text>
        <TouchableOpacity onPress={() => setRouteOptionsOpen(true)} style={styles.headerIconBtn}>
          <MaterialIcons name="sync" size={22} color="#6b7280" />
        </TouchableOpacity>
      </View>

      {/* Banners */}
      {pendingDeliveryCount > 0 && (
        <View style={styles.bannerAmber}>
          <Text style={styles.bannerText}>{pendingDeliveryCount} delivery confirmations pending sync</Text>
        </View>
      )}
      {gpsError && (
        <View style={styles.bannerRed}>
          <Text style={styles.bannerText}>⚠ GPS unavailable — location not updating</Text>
        </View>
      )}

      {/* Orders */}
      <ScrollView
        style={{ flex: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={GREEN} />}
      >
        {loadingOrders && !refreshing ? (
          <ActivityIndicator color={GREEN} style={{ marginTop: 60 }} />
        ) : activeOrders.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyIcon}>📦</Text>
            <Text style={styles.emptyTitle}>No active orders</Text>
            <Text style={styles.emptySub}>New orders will appear here</Text>
          </View>
        ) : (
          activeOrders.map((order, idx) => {
            const { time, date } = formatOrderTime(order.startedAt ?? order.createdAt)
            const isLast = idx === activeOrders.length - 1
            return (
              <View key={order.id} style={[styles.card, isLast && styles.cardLast]}>
                {/* Status + icons row */}
                <View style={styles.cardTop}>
                  <StatusBadge status={order.status} />
                  <View style={styles.cardIcons}>
                    <TouchableOpacity onPress={() => setNavSheet(order)} style={styles.iconBtn}>
                      <Feather name="send" size={18} color="#374151" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setContactSheet(order)} style={styles.iconBtn}>
                      <Feather name="phone" size={18} color="#374151" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Order number */}
                <TouchableOpacity onPress={() => router.push(`/order/${order.id}` as never)}>
                  <Text style={styles.orderNum}># {order.orderNumber}</Text>

                  {/* Customer + time */}
                  <View style={styles.customerRow}>
                    <View style={styles.customerLeft}>
                      <Feather name="map-pin" size={14} color="#9ca3af" style={{ marginTop: 2 }} />
                      <Text style={styles.customerName}>{order.customerName}</Text>
                    </View>
                    {time ? (
                      <View style={styles.timeWrap}>
                        <Text style={styles.timeText}>{time}</Text>
                        {date ? <Text style={styles.dateText}>{date}</Text> : null}
                      </View>
                    ) : null}
                  </View>

                  {/* Address */}
                  <Text style={styles.address}>{order.address}</Text>
                </TouchableOpacity>

                {/* Action buttons */}
                <View style={styles.actions}>
                  {/* Back button for picked-up and in-transit */}
                  {(order.status === "picked-up" || order.status === "in-transit") && (
                    <TouchableOpacity
                      style={styles.backBtn}
                      onPress={() => updateStatus(order, order.status === "picked-up" ? "started" : "picked-up")}
                      disabled={pendingId === order.id}
                    >
                      <Feather name="arrow-left" size={16} color="#374151" />
                    </TouchableOpacity>
                  )}

                  {order.status === "started" || order.status === "unassigned" ? (
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: ORANGE }]}
                      onPress={() => openChecklist(order)}
                      disabled={!!pendingId}
                      activeOpacity={0.85}
                    >
                      {pendingId === order.id
                        ? <ActivityIndicator color="#fff" size="small" />
                        : <Text style={styles.actionBtnText}>Mark as Picked Up  →</Text>}
                    </TouchableOpacity>
                  ) : order.status === "picked-up" ? (
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: GREEN }]}
                      onPress={() => updateStatus(order, "in-transit")}
                      disabled={!!pendingId}
                      activeOpacity={0.85}
                    >
                      {pendingId === order.id
                        ? <ActivityIndicator color="#fff" size="small" />
                        : <Text style={styles.actionBtnText}>Mark as On the way  →</Text>}
                    </TouchableOpacity>
                  ) : order.status === "in-transit" ? (
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: "#065f46" }]}
                      onPress={() => setPodOrder(order)}
                      disabled={!!pendingId}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.actionBtnText}>Mark as Complete  →</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            )
          })
        )}
        <View style={{ height: 24 }} />
      </ScrollView>

      {/* ── Item checklist modal ─────────────────────────────────────────────── */}
      <Modal visible={!!checklistOrder} transparent animationType="slide" onRequestClose={() => setChecklistOrder(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.bottomSheet, { paddingBottom: Math.max(24, insets.bottom + 12) }]}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Confirm items picked up</Text>
            <ScrollView style={{ maxHeight: 340 }}>
              {(checklistOrder?.items ?? []).map((item, i) => {
                const checked = checkedItems.has(i)
                return (
                  <TouchableOpacity
                    key={i}
                    style={styles.checklistItem}
                    onPress={() => {
                      const next = new Set(checkedItems)
                      checked ? next.delete(i) : next.add(i)
                      setCheckedItems(next)
                    }}
                  >
                    <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                      {checked && <Feather name="check" size={12} color="#fff" />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.checklistItemText}>
                        {item.qty ? `${item.qty}x  ` : ""}{item.name}
                      </Text>
                      {item.meta ? <Text style={styles.checklistMeta}>{item.meta}</Text> : null}
                    </View>
                  </TouchableOpacity>
                )
              })}
              {(!checklistOrder?.items || checklistOrder.items.length === 0) && (
                <Text style={{ color: "#6b7280", padding: 16 }}>No items listed for this order.</Text>
              )}
            </ScrollView>
            <TouchableOpacity
              style={[styles.confirmBtn, (actionLoading || (checklistOrder?.items?.length ?? 0) > 0 && checkedItems.size < (checklistOrder?.items?.length ?? 0)) && styles.confirmBtnDisabled]}
              onPress={confirmPickedUp}
              disabled={actionLoading || ((checklistOrder?.items?.length ?? 0) > 0 && checkedItems.size < (checklistOrder?.items?.length ?? 0))}
            >
              {actionLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmBtnText}>Confirm</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelTextBtn} onPress={() => setChecklistOrder(null)}>
              <Text style={styles.cancelTextBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── POD choice modal ─────────────────────────────────────────────────── */}
      <Modal visible={!!podOrder} transparent animationType="fade" onRequestClose={() => setPodOrder(null)}>
        <View style={styles.centeredOverlay}>
          <View style={styles.centeredModal}>
            <Text style={styles.centeredTitle}>Proof of Delivery (POD)</Text>
            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: TEAL }]}
              onPress={() => { const o = podOrder; setPodOrder(null); setTimeout(() => router.push(`/delivery/${o?.id}?mode=pod` as never), 200) }}
            >
              <Text style={styles.modalBtnText}>Take Proof of Delivery (POD)</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: "#ef4444", marginTop: 10 }]}
              onPress={() => { const o = podOrder; setPodOrder(null); setTimeout(() => router.push(`/delivery/${o?.id}?mode=failed` as never), 200) }}
            >
              <Text style={styles.modalBtnText}>Failed Delivery</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: "#fff", borderWidth: 1, borderColor: "#e5e7eb", marginTop: 10 }]}
              onPress={() => setPodOrder(null)}
            >
              <Text style={[styles.modalBtnText, { color: "#374151" }]}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Navigate action sheet ─────────────────────────────────────────────── */}
      <Modal visible={!!navSheet} transparent animationType="slide" onRequestClose={() => setNavSheet(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.actionSheet}>
            <TouchableOpacity style={styles.actionSheetItem} onPress={() => { const o = navSheet!; setNavSheet(null); setTimeout(() => handleNavOption(o, "customer"), 300) }}>
              <Feather name="send" size={18} color="#111827" />
              <Text style={styles.actionSheetText}>Navigate to Customer</Text>
            </TouchableOpacity>
            <View style={styles.sheetDivider} />
            <TouchableOpacity style={styles.actionSheetItem} onPress={() => { const o = navSheet!; setNavSheet(null); setTimeout(() => handleNavOption(o, "pickup"), 300) }}>
              <Feather name="send" size={18} color="#111827" />
              <Text style={styles.actionSheetText}>Navigate to Pick Up Location</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={[styles.cancelSheet, { marginBottom: insets.bottom + 8 }]} onPress={() => setNavSheet(null)}>
            <Text style={styles.cancelSheetText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* ── Contact action sheet ──────────────────────────────────────────────── */}
      <Modal visible={!!contactSheet} transparent animationType="slide" onRequestClose={() => setContactSheet(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.contactSheet, { paddingBottom: Math.max(16, insets.bottom + 8) }]}>
            <View style={styles.sheetHandle} />
            <Text style={styles.contactSheetTitle}>Contact</Text>
            {[
              { icon: "phone" as const, label: "Call pickup", value: HUB_PHONE, action: () => handleCall(HUB_PHONE) },
              { icon: "phone" as const, label: "Call customer", value: contactSheet?.phone ?? "", action: () => handleCall(contactSheet?.phone ?? "") },
              { icon: "mail" as const, label: "Text Customer", value: contactSheet?.phone ?? "", action: () => handleSMS(contactSheet?.phone ?? "") },
            ].map((item, i) => (
              <View key={i}>
                {i > 0 && <View style={styles.sheetDivider} />}
                <TouchableOpacity style={styles.contactItem} onPress={item.action}>
                  <View style={styles.contactIcon}>
                    <Feather name={item.icon} size={18} color="#6b7280" />
                  </View>
                  <View>
                    <Text style={styles.contactLabel}>{item.label}</Text>
                    <Text style={styles.contactValue}>{item.value}</Text>
                  </View>
                </TouchableOpacity>
              </View>
            ))}
            <View style={styles.sheetDivider} />
            <TouchableOpacity
              style={styles.contactItem}
              onPress={() => handleWhatsApp(contactSheet?.phone ?? "")}
            >
              <View style={styles.contactIcon}>
                <MaterialIcons name="chat" size={18} color="#6b7280" />
              </View>
              <View>
                <Text style={styles.contactLabel}>WhatsApp customer</Text>
                <Text style={styles.contactValue}>{contactSheet?.phone ?? ""}</Text>
              </View>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={[styles.cancelSheet, { marginBottom: insets.bottom + 8 }]} onPress={() => setContactSheet(null)}>
            <Text style={styles.cancelSheetText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* ── Route options modal ───────────────────────────────────────────────── */}
      <Modal visible={routeOptionsOpen} transparent animationType="fade" onRequestClose={() => setRouteOptionsOpen(false)}>
        <View style={styles.centeredOverlay}>
          <View style={styles.centeredModal}>
            <Text style={styles.centeredTitle}>Route Options</Text>
            <TouchableOpacity style={[styles.modalBtn, { backgroundColor: TEAL }]} onPress={pickUpAllOrders}>
              <Feather name="check-circle" size={18} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.modalBtnText}>Pick Up all orders</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modalBtn, { backgroundColor: TEAL, marginTop: 10 }]} onPress={() => setRouteOptionsOpen(false)}>
              <MaterialIcons name="alt-route" size={18} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.modalBtnText}>Optimize Route</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modalBtn, { backgroundColor: TEAL, marginTop: 10 }]} onPress={() => setRouteOptionsOpen(false)}>
              <MaterialIcons name="notifications" size={18} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.modalBtnText}>Notify Customers</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modalBtn, { backgroundColor: "#fff", borderWidth: 1, borderColor: "#e5e7eb", marginTop: 10 }]} onPress={() => setRouteOptionsOpen(false)}>
              <Text style={[styles.modalBtnText, { color: "#374151" }]}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  // Offline screen
  hamburger: { padding: 16 },
  offlineTop: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  offlineAvatar: { width: 100, height: 100, borderRadius: 50, marginBottom: 20 },
  offlineAvatarFallback: { backgroundColor: "#dcfce7", alignItems: "center", justifyContent: "center" },
  offlineAvatarText: { fontSize: 40, fontWeight: "800", color: GREEN },
  helloText: { fontSize: 26, fontWeight: "700", color: "#111827", marginBottom: 4 },
  welcomeBack: { fontSize: 15, color: "#6b7280" },
  offlineBottom: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 24, paddingTop: 28, paddingBottom: 32, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: -3 }, elevation: 4 },
  startText: { fontSize: 18, fontWeight: "500", color: "#374151", textAlign: "center", marginBottom: 16 },
  goOnlineBtn: { backgroundColor: GREEN, borderRadius: 14, paddingVertical: 16, alignItems: "center" },
  goOnlineBtnText: { color: "#fff", fontSize: 17, fontWeight: "700" },
  // Header
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#111827" },
  headerIconBtn: { padding: 6 },
  // Banners
  bannerAmber: { backgroundColor: "#f59e0b", paddingHorizontal: 16, paddingVertical: 8 },
  bannerRed: { backgroundColor: "#ef4444", paddingHorizontal: 16, paddingVertical: 8 },
  bannerText: { color: "#fff", fontSize: 13, fontWeight: "600", textAlign: "center" },
  // Empty
  emptyWrap: { alignItems: "center", paddingTop: 100 },
  emptyIcon: { fontSize: 52, marginBottom: 16 },
  emptyTitle: { fontSize: 17, fontWeight: "600", color: "#374151" },
  emptySub: { fontSize: 13, color: "#9ca3af", marginTop: 6 },
  // Cards
  card: { borderBottomWidth: 1, borderBottomColor: "#f3f4f6", paddingHorizontal: 16, paddingVertical: 14 },
  cardLast: { borderBottomWidth: 0 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  badge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 6 },
  badgeText: { fontSize: 13, fontWeight: "600" },
  cardIcons: { flexDirection: "row", gap: 12 },
  iconBtn: { padding: 4 },
  orderNum: { fontSize: 14, color: "#374151", marginBottom: 8 },
  customerRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 4 },
  customerLeft: { flexDirection: "row", alignItems: "flex-start", gap: 6, flex: 1 },
  customerName: { fontSize: 16, fontWeight: "700", color: "#111827", flex: 1 },
  timeWrap: { alignItems: "flex-end", marginLeft: 8 },
  timeText: { fontSize: 14, fontWeight: "600", color: "#111827" },
  dateText: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  address: { fontSize: 13, color: "#6b7280", marginBottom: 12, lineHeight: 18 },
  // Action buttons
  actions: { flexDirection: "row", gap: 10 },
  backBtn: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: "#e5e7eb", alignItems: "center", justifyContent: "center" },
  actionBtn: { flex: 1, borderRadius: 100, paddingVertical: 13, flexDirection: "row", alignItems: "center", justifyContent: "center" },
  actionBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  // Modals
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  centeredOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center" },
  centeredModal: { backgroundColor: "#fff", borderRadius: 20, padding: 24, width: "85%", alignItems: "stretch" },
  centeredTitle: { fontSize: 18, fontWeight: "700", color: "#111827", textAlign: "center", marginBottom: 20 },
  modalBtn: { flexDirection: "row", borderRadius: 100, paddingVertical: 16, alignItems: "center", justifyContent: "center" },
  modalBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  // Bottom sheet
  bottomSheet: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingBottom: 24, paddingTop: 12 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#d1d5db", alignSelf: "center", marginBottom: 16 },
  sheetTitle: { fontSize: 17, fontWeight: "700", color: "#111827", textAlign: "center", marginBottom: 16 },
  sheetDivider: { height: 1, backgroundColor: "#f3f4f6" },
  // Checklist
  checklistItem: { flexDirection: "row", alignItems: "flex-start", gap: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#f9fafb" },
  checkbox: { width: 22, height: 22, borderRadius: 4, borderWidth: 1.5, borderColor: "#d1d5db", alignItems: "center", justifyContent: "center", marginTop: 1 },
  checkboxChecked: { backgroundColor: TEAL, borderColor: TEAL },
  checklistItemText: { fontSize: 15, color: "#111827" },
  checklistMeta: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  confirmBtn: { backgroundColor: TEAL, borderRadius: 100, paddingVertical: 15, alignItems: "center", marginTop: 16 },
  confirmBtnDisabled: { opacity: 0.5 },
  confirmBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  cancelTextBtn: { paddingVertical: 14, alignItems: "center" },
  cancelTextBtnText: { color: TEAL, fontSize: 15, fontWeight: "600" },
  // Action sheet (navigate)
  actionSheet: { backgroundColor: "#fff", borderRadius: 16, marginHorizontal: 16, overflow: "hidden" },
  actionSheetItem: { flexDirection: "row", alignItems: "center", gap: 16, padding: 18 },
  actionSheetText: { fontSize: 16, fontWeight: "600", color: "#111827" },
  cancelSheet: { backgroundColor: "#fff", borderRadius: 16, marginHorizontal: 16, marginTop: 8, marginBottom: 8, padding: 18, alignItems: "center" },
  cancelSheetText: { fontSize: 16, fontWeight: "700", color: "#111827" },
  // Contact sheet
  contactSheet: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingBottom: 16, paddingTop: 12 },
  contactSheetTitle: { fontSize: 18, fontWeight: "600", color: "#111827", textAlign: "center", paddingVertical: 12 },
  contactItem: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 16 },
  contactIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#f3f4f6", alignItems: "center", justifyContent: "center" },
  contactLabel: { fontSize: 15, fontWeight: "500", color: "#111827" },
  contactValue: { fontSize: 13, color: "#6b7280", marginTop: 2 },
})

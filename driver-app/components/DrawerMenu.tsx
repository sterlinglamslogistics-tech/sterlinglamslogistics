import { useEffect, useRef } from "react"
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
  Dimensions, Image, ScrollView, Platform,
} from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { router } from "expo-router"
import { Feather, MaterialIcons } from "@expo/vector-icons"
import { useDriver } from "@/context/DriverContext"

const { width: SCREEN_W } = Dimensions.get("window")
const DRAWER_W = SCREEN_W * 0.78

const GREEN = "#16a34a"

export function DrawerMenu() {
  const { drawerOpen, setDrawerOpen, session, driver, profilePhoto, goOffline, logout } = useDriver()
  const insets = useSafeAreaInsets()
  const translateX = useRef(new Animated.Value(-DRAWER_W)).current
  const opacity = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateX, { toValue: drawerOpen ? 0 : -DRAWER_W, duration: 280, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: drawerOpen ? 0.5 : 0, duration: 280, useNativeDriver: true }),
    ]).start()
  }, [drawerOpen])

  function close() { setDrawerOpen(false) }

  function navigate(path: string) {
    close()
    setTimeout(() => router.push(path as never), 300)
  }

  async function handleGoOffline() {
    close()
    await goOffline()
  }

  const name = session?.name ?? "Driver"
  const rating = driver?.rating ?? 0
  const online = driver?.status === "available" || driver?.status === "on-delivery"

  return (
    <>
      {/* Backdrop */}
      <Animated.View
        pointerEvents={drawerOpen ? "auto" : "none"}
        style={[styles.backdrop, { opacity }]}
      >
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={close} activeOpacity={1} />
      </Animated.View>

      {/* Drawer panel */}
      <Animated.View style={[styles.drawer, { transform: [{ translateX }], paddingTop: insets.top + 16 }]}>
        {/* Profile header */}
        <View style={styles.profile}>
          {profilePhoto ? (
            <Image source={{ uri: profilePhoto }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarText}>{name.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.profileInfo}>
            <View style={styles.profileRow}>
              <Text style={styles.profileName}>{name}</Text>
              <TouchableOpacity onPress={() => navigate("/settings/profile")} style={styles.dotsBtn}>
                <Feather name="more-horizontal" size={18} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <View style={styles.profileBadges}>
              {rating > 0 && (
                <View style={styles.ratingBadge}>
                  <Text style={styles.star}>★</Text>
                  <Text style={styles.ratingText}>{rating.toFixed(2)}</Text>
                </View>
              )}
              <View style={[styles.statusBadge, online ? styles.onlineBadge : styles.offlineBadge]}>
                <View style={[styles.statusDot, online ? styles.onlineDot : styles.offlineDot]} />
                <Text style={[styles.statusText, online ? styles.onlineText : styles.offlineText]}>
                  {online ? "Online" : "Offline"}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Menu items */}
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          <TouchableOpacity style={styles.menuItem} onPress={() => navigate("/completed-orders")}>
            <Feather name="check-circle" size={20} color="#374151" />
            <Text style={styles.menuItemText}>Completed Orders</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={() => navigate("/settings")}>
            <Feather name="settings" size={20} color="#374151" />
            <Text style={styles.menuItemText}>Settings</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={() => navigate("/settings/display")}>
            <MaterialIcons name="language" size={20} color="#374151" />
            <Text style={styles.menuItemText}>Language</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Get Offline button */}
        <View style={[styles.bottomSection, { paddingBottom: insets.bottom + 16 }]}>
          <TouchableOpacity style={styles.offlineBtn} onPress={handleGoOffline} activeOpacity={0.85}>
            <Text style={styles.offlineBtnText}>Get Offline</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
    zIndex: 100,
  },
  drawer: {
    position: "absolute",
    top: 0, left: 0, bottom: 0,
    width: DRAWER_W,
    backgroundColor: "#fff",
    zIndex: 101,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 4, height: 0 },
    elevation: 10,
  },
  profile: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 14,
  },
  avatar: { width: 60, height: 60, borderRadius: 30 },
  avatarFallback: { backgroundColor: "#dcfce7", alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 26, fontWeight: "700", color: GREEN },
  profileInfo: { flex: 1 },
  profileRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  profileName: { fontSize: 17, fontWeight: "700", color: "#111827" },
  dotsBtn: { padding: 4 },
  profileBadges: { flexDirection: "row", gap: 8, marginTop: 6, flexWrap: "wrap" },
  ratingBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#fef3c7", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100 },
  star: { color: "#f59e0b", fontSize: 12 },
  ratingText: { fontSize: 12, fontWeight: "600", color: "#92400e" },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100 },
  onlineBadge: { backgroundColor: "#f0fdf4" },
  offlineBadge: { backgroundColor: "#f3f4f6" },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  onlineDot: { backgroundColor: GREEN },
  offlineDot: { backgroundColor: "#9ca3af" },
  statusText: { fontSize: 12, fontWeight: "600" },
  onlineText: { color: GREEN },
  offlineText: { color: "#6b7280" },
  divider: { height: 1, backgroundColor: "#f3f4f6", marginBottom: 8 },
  menuItem: { flexDirection: "row", alignItems: "center", gap: 16, paddingHorizontal: 24, paddingVertical: 16 },
  menuItemText: { fontSize: 16, color: "#111827", fontWeight: "400" },
  bottomSection: { paddingHorizontal: 20, borderTopWidth: 1, borderTopColor: "#f3f4f6", paddingTop: 16 },
  offlineBtn: { backgroundColor: "#ef4444", borderRadius: 12, paddingVertical: 15, alignItems: "center" },
  offlineBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
})

import { useState, useEffect } from "react"
import { View, Text, TouchableOpacity, StyleSheet, Switch, Alert, ScrollView } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useDriver } from "@/context/DriverContext"
import { getNavApp, saveNavApp } from "@/lib/storage"
import { Feather } from "@expo/vector-icons"

const GREEN = "#16a34a"

export default function SettingsScreen() {
  const { session, driver, logout, goOffline, isOnline } = useDriver()
  const [navApp, setNavApp] = useState<"google" | "waze" | "yandex">("google")

  useEffect(() => { getNavApp().then(setNavApp) }, [])

  async function toggleNavApp(app: "google" | "waze") {
    setNavApp(app)
    await saveNavApp(app)
  }

  function confirmLogout() {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: logout },
    ])
  }

  function confirmGoOffline() {
    Alert.alert("Go Offline", "This will stop location tracking and new order assignments.", [
      { text: "Cancel", style: "cancel" },
      { text: "Go Offline", style: "destructive", onPress: goOffline },
    ])
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f9fafb" }}>
      <View style={styles.header}><Text style={styles.headerTitle}>Settings</Text></View>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Profile */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{session?.name?.charAt(0)?.toUpperCase() ?? "D"}</Text>
          </View>
          <View>
            <Text style={styles.profileName}>{session?.name ?? "Driver"}</Text>
            <Text style={styles.profilePhone}>{session?.phone ?? ""}</Text>
          </View>
          {isOnline && (
            <View style={styles.onlinePill}>
              <View style={styles.onlineDot} />
              <Text style={styles.onlineText}>Online</Text>
            </View>
          )}
        </View>

        {/* Navigation App */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Navigation App</Text>
          <View style={styles.group}>
            {(["google", "waze"] as const).map((app) => (
              <TouchableOpacity
                key={app}
                style={[styles.optionRow, navApp === app && styles.optionRowActive]}
                onPress={() => toggleNavApp(app)}
              >
                <Feather name="navigation" size={16} color={navApp === app ? GREEN : "#6b7280"} />
                <Text style={[styles.optionText, navApp === app && { color: GREEN, fontWeight: "700" }]}>
                  {app === "google" ? "Google Maps" : "Waze"}
                </Text>
                {navApp === app && <View style={styles.checkDot} />}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Account</Text>
          <View style={styles.group}>
            {isOnline && (
              <TouchableOpacity style={styles.row} onPress={confirmGoOffline}>
                <Text style={styles.rowText}>Go Offline</Text>
                <Feather name="chevron-right" size={16} color="#9ca3af" />
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[styles.row, { borderTopWidth: isOnline ? 1 : 0, borderTopColor: "#f3f4f6" }]} onPress={confirmLogout}>
              <Feather name="log-out" size={16} color="#ef4444" />
              <Text style={[styles.rowText, { color: "#ef4444" }]}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.version}>Sterlin Driver v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingVertical: 14, backgroundColor: "#f9fafb" },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#111827" },
  content: { padding: 16, gap: 20, paddingBottom: 60 },
  profileCard: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: "#fff", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#e5e7eb" },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: "#dcfce7", alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 22, fontWeight: "800", color: GREEN },
  profileName: { fontSize: 16, fontWeight: "700", color: "#111827" },
  profilePhone: { fontSize: 13, color: "#6b7280", marginTop: 2 },
  onlinePill: { marginLeft: "auto", flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#dcfce7", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100 },
  onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: GREEN },
  onlineText: { fontSize: 11, fontWeight: "600", color: GREEN },
  section: { gap: 8 },
  sectionLabel: { fontSize: 12, fontWeight: "600", color: "#9ca3af", textTransform: "uppercase", paddingHorizontal: 4 },
  group: { backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: "#e5e7eb", overflow: "hidden" },
  optionRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  optionRowActive: { backgroundColor: "#f0fdf4" },
  optionText: { flex: 1, fontSize: 15, color: "#374151" },
  checkDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: GREEN },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 14 },
  rowText: { flex: 1, fontSize: 15, color: "#374151" },
  version: { fontSize: 12, color: "#9ca3af", textAlign: "center" },
})

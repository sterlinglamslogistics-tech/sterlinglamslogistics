import { useState, useEffect } from "react"
import { View, Text, StyleSheet, TouchableOpacity, Switch } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { router } from "expo-router"
import { Feather } from "@expo/vector-icons"
import { useDriver } from "@/context/DriverContext"

const TEAL = "#0d9488"

export default function PreferencesScreen() {
  const { preferences, updatePreferences } = useDriver()
  const [prefs, setPrefs] = useState(preferences)

  useEffect(() => { setPrefs(preferences) }, [preferences])

  async function toggle(key: keyof typeof prefs) {
    const updated = { ...prefs, [key]: !prefs[key] }
    setPrefs(updated)
    await updatePreferences(updated)
  }

  const items = [
    { key: "newOrderAlert" as const, label: "New Order Alert", desc: "Receive push notifications when new orders are created" },
    { key: "statusConfirmation" as const, label: "Status Confirmation", desc: "Show confirmation popup during the change of order status" },
    { key: "podRequired" as const, label: "Proof of Delivery (POD)", desc: "Uploading proof of delivery will be required" },
    { key: "cashTips" as const, label: "Add Cash Tips", desc: "Manually add cash tips to your orders" },
  ]

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Preferences</Text>
        <View style={{ width: 36 }} />
      </View>

      {items.map((item, i) => (
        <View key={item.key} style={[styles.row, i > 0 && styles.rowBorder]}>
          <View style={{ flex: 1, paddingRight: 16 }}>
            <Text style={styles.rowLabel}>{item.label}</Text>
            <Text style={styles.rowDesc}>{item.desc}</Text>
          </View>
          <Switch
            value={prefs[item.key]}
            onValueChange={() => toggle(item.key)}
            trackColor={{ false: "#d1d5db", true: TEAL }}
            thumbColor="#fff"
          />
        </View>
      ))}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontWeight: "700", color: "#111827" },
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 18 },
  rowBorder: { borderTopWidth: 1, borderTopColor: "#f3f4f6" },
  rowLabel: { fontSize: 16, fontWeight: "500", color: "#111827", marginBottom: 4 },
  rowDesc: { fontSize: 13, color: "#6b7280", lineHeight: 18 },
})

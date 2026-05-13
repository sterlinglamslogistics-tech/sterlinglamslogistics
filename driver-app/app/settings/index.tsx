import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { router } from "expo-router"
import { Feather, MaterialIcons } from "@expo/vector-icons"

const TEAL = "#0d9488"

const items = [
  { icon: "user" as const, label: "Profile", route: "/settings/profile" },
  { icon: "sliders" as const, label: "Preferences", route: "/settings/preferences" },
  { icon: "navigation" as const, label: "Navigation", route: "/settings/navigation-app" },
  { icon: "monitor" as const, label: "Display", route: "/settings/display" },
  { icon: "info" as const, label: "About", route: "/settings/about" },
]

export default function SettingsIndex() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 36 }} />
      </View>
      <ScrollView>
        {items.map((item, i) => (
          <TouchableOpacity
            key={item.route}
            style={[styles.row, i > 0 && styles.rowBorder]}
            onPress={() => router.push(item.route as never)}
          >
            <View style={styles.rowIcon}>
              <Feather name={item.icon} size={18} color="#374151" />
            </View>
            <Text style={styles.rowText}>{item.label}</Text>
            <Feather name="chevron-right" size={18} color="#9ca3af" />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontWeight: "700", color: "#111827" },
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 18 },
  rowBorder: { borderTopWidth: 1, borderTopColor: "#f3f4f6" },
  rowIcon: { width: 36, height: 36, borderRadius: 8, backgroundColor: "#f3f4f6", alignItems: "center", justifyContent: "center", marginRight: 14 },
  rowText: { flex: 1, fontSize: 16, color: "#111827" },
})

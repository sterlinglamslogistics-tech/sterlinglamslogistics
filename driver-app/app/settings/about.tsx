import { View, Text, StyleSheet, TouchableOpacity } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { router } from "expo-router"
import { Feather } from "@expo/vector-icons"
import Constants from "expo-constants"
import { useDriver } from "@/context/DriverContext"
import { Platform } from "react-native"

export default function AboutScreen() {
  const { session } = useDriver()
  const version = Constants.expoConfig?.version ?? "1.0.0"
  const build = Constants.expoConfig?.ios?.buildNumber ?? Constants.expoConfig?.android?.versionCode ?? "1"
  const os = Platform.OS === "android" ? `Android ${Platform.Version}` : `iOS ${Platform.Version}`
  const model = Constants.modelName ?? "Unknown"

  const sections = [
    {
      title: "App info",
      rows: [
        { label: "App:", value: "Sterlin Driver" },
        { label: "Version:", value: String(version) },
        { label: "Build:", value: String(build) },
      ],
    },
    {
      title: "Device info",
      rows: [
        { label: "OS:", value: os },
        { label: "Model:", value: model },
      ],
    },
    {
      title: "Login info",
      rows: [
        { label: "Account:", value: "Sterlin Glams" },
        { label: "User:", value: session?.phone ?? session?.name ?? "" },
      ],
    },
  ]

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>About</Text>
        <View style={{ width: 36 }} />
      </View>

      {sections.map((section, si) => (
        <View key={section.title} style={si > 0 ? styles.sectionMargin : {}}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          {section.rows.map((row, ri) => (
            <View key={row.label} style={[styles.row, ri > 0 && styles.rowBorder]}>
              <Text style={styles.rowLabel}>{row.label}</Text>
              <Text style={styles.rowValue}>{row.value}</Text>
            </View>
          ))}
          <View style={styles.divider} />
        </View>
      ))}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontWeight: "700", color: "#111827" },
  sectionMargin: { marginTop: 8 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#111827", paddingHorizontal: 16, paddingVertical: 12 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12 },
  rowBorder: { borderTopWidth: 1, borderTopColor: "#f3f4f6" },
  rowLabel: { fontSize: 15, color: "#374151" },
  rowValue: { fontSize: 15, color: "#6b7280" },
  divider: { height: 1, backgroundColor: "#f3f4f6", marginTop: 4 },
})

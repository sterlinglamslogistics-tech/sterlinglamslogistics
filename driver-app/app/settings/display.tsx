import { useState, useEffect } from "react"
import { View, Text, StyleSheet, TouchableOpacity } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { router } from "expo-router"
import { Feather } from "@expo/vector-icons"
import { getTheme, saveTheme } from "@/lib/storage"

const TEAL = "#0d9488"
type Theme = "light" | "dark" | "system"

export default function DisplayScreen() {
  const [selected, setSelected] = useState<Theme>("system")

  useEffect(() => { getTheme().then(setSelected) }, [])

  async function select(t: Theme) { setSelected(t); await saveTheme(t) }

  const options: { key: Theme; label: string }[] = [
    { key: "light", label: "Light" },
    { key: "dark", label: "Dark" },
    { key: "system", label: "System Default" },
  ]

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Display</Text>
        <View style={{ width: 36 }} />
      </View>

      {options.map((opt, i) => (
        <TouchableOpacity
          key={opt.key}
          style={[styles.row, i > 0 && styles.rowBorder]}
          onPress={() => select(opt.key)}
        >
          <Text style={styles.rowText}>{opt.label}</Text>
          {selected === opt.key && (
            <View style={styles.checkCircle}>
              <Feather name="check" size={14} color="#fff" />
            </View>
          )}
        </TouchableOpacity>
      ))}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontWeight: "700", color: "#111827" },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 18 },
  rowBorder: { borderTopWidth: 1, borderTopColor: "#f3f4f6" },
  rowText: { fontSize: 16, color: "#111827" },
  checkCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: TEAL, alignItems: "center", justifyContent: "center" },
})

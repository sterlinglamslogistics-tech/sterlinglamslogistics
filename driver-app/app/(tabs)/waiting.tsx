import { View, Text, StyleSheet } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

export default function WaitingScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      <View style={styles.header}><Text style={styles.title}>Waiting</Text></View>
      <View style={styles.center}>
        <Text style={styles.icon}>⏳</Text>
        <Text style={styles.text}>No waiting orders</Text>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  title: { fontSize: 18, fontWeight: "700", color: "#111827" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  icon: { fontSize: 52 },
  text: { fontSize: 15, color: "#9ca3af" },
})

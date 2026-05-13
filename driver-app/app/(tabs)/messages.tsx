import { useState, useCallback, useEffect, useRef } from "react"
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { router } from "expo-router"
import { MaterialIcons } from "@expo/vector-icons"
import { useDriver } from "@/context/DriverContext"
import { driverFetch } from "@/lib/api"
import type { ChatThread } from "@/lib/types"

function formatThreadTime(ts: number | string): string {
  if (!ts) return ""
  const d = typeof ts === "number" ? new Date(ts) : new Date(ts)
  if (isNaN(d.getTime())) return ""
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return "Just now"
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHrs = Math.floor(diffMins / 60)
  if (diffHrs < 24) return `${diffHrs}h ago`
  return d.toLocaleDateString("en-NG", { day: "2-digit", month: "short" })
}

function ThreadAvatar({ name, type }: { name: string; type: string }) {
  const bg = type === "dispatcher" ? "#dcfce7" : "#dbeafe"
  const color = type === "dispatcher" ? "#15803d" : "#1d4ed8"
  return (
    <View style={[styles.avatar, { backgroundColor: bg }]}>
      <Text style={[styles.avatarText, { color }]}>{name.charAt(0).toUpperCase()}</Text>
    </View>
  )
}

export default function MessagesScreen() {
  const { session, setUnreadMessageCount } = useDriver()
  const [threads, setThreads] = useState<ChatThread[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchThreads = useCallback(async () => {
    if (!session) return
    try {
      const res = await driverFetch(
        `/api/driver/messages/threads?driverId=${encodeURIComponent(session.id)}`
      )
      if (!res.ok) return
      const data = await res.json() as { threads?: ChatThread[] }
      setThreads(data.threads ?? [])
      const total = (data.threads ?? []).reduce((sum, t) => sum + (t.unreadCount ?? 0), 0)
      setUnreadMessageCount(total)
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }, [session, setUnreadMessageCount])

  useEffect(() => {
    void fetchThreads()
    pollRef.current = setInterval(() => { void fetchThreads() }, 15_000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [fetchThreads])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchThreads()
    setRefreshing(false)
  }, [fetchThreads])

  function openThread(thread: ChatThread) {
    router.push(`/messages/${thread.id}?name=${encodeURIComponent(thread.name)}&orderId=${thread.orderId ?? ""}&orderNumber=${thread.orderNumber ?? ""}` as never)
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      <View style={styles.header}>
        <Text style={styles.title}>Messages</Text>
      </View>

      {loading ? (
        <ActivityIndicator color="#16a34a" style={{ marginTop: 60 }} />
      ) : threads.length === 0 ? (
        <View style={styles.empty}>
          <MaterialIcons name="chat-bubble-outline" size={52} color="#d1d5db" />
          <Text style={styles.emptyTitle}>No messages yet</Text>
          <Text style={styles.emptySub}>Messages from dispatch and customers will appear here</Text>
        </View>
      ) : (
        <FlatList
          data={threads}
          keyExtractor={(t) => t.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#16a34a" />}
          renderItem={({ item: thread }) => (
            <TouchableOpacity style={styles.row} onPress={() => openThread(thread)} activeOpacity={0.7}>
              <ThreadAvatar name={thread.name} type={thread.type} />
              <View style={styles.rowBody}>
                <View style={styles.rowTop}>
                  <Text style={styles.name} numberOfLines={1}>{thread.name}</Text>
                  <Text style={styles.time}>{formatThreadTime(thread.lastMessageAt)}</Text>
                </View>
                {thread.orderNumber ? (
                  <Text style={styles.orderTag}>Order #{thread.orderNumber}</Text>
                ) : null}
                <View style={styles.rowBottom}>
                  <Text style={styles.preview} numberOfLines={1}>{thread.lastMessage || "No messages yet"}</Text>
                  {thread.unreadCount > 0 && (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadText}>
                        {thread.unreadCount > 9 ? "9+" : thread.unreadCount}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  title: { fontSize: 18, fontWeight: "700", color: "#111827" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 16, fontWeight: "600", color: "#374151" },
  emptySub: { fontSize: 13, color: "#9ca3af", textAlign: "center", lineHeight: 20 },
  row: { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  avatar: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  avatarText: { fontSize: 18, fontWeight: "700" },
  rowBody: { flex: 1 },
  rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 2 },
  name: { fontSize: 15, fontWeight: "700", color: "#111827", flex: 1, marginRight: 8 },
  time: { fontSize: 12, color: "#9ca3af", flexShrink: 0 },
  orderTag: { fontSize: 11, color: "#6b7280", marginBottom: 4, fontWeight: "500" },
  rowBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  preview: { fontSize: 13, color: "#6b7280", flex: 1, marginRight: 8 },
  unreadBadge: {
    backgroundColor: "#16a34a",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  unreadText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  separator: { height: 1, backgroundColor: "#f9fafb", marginLeft: 74 },
})

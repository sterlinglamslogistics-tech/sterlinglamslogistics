import { useState, useCallback, useEffect, useRef } from "react"
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, KeyboardAvoidingView, Platform, ActivityIndicator,
} from "react-native"
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context"
import { useLocalSearchParams, router } from "expo-router"
import { Feather } from "@expo/vector-icons"
import { useDriver } from "@/context/DriverContext"
import { driverFetch } from "@/lib/api"
import type { ChatMessage } from "@/lib/types"

function formatMessageTime(ts: number | string): string {
  if (!ts) return ""
  const d = typeof ts === "number" ? new Date(ts) : new Date(ts)
  if (isNaN(d.getTime())) return ""
  return d.toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit", hour12: true }).toUpperCase()
}

function MessageBubble({ msg, driverId }: { msg: ChatMessage; driverId: string }) {
  const isDriver = msg.senderId === driverId || msg.senderType === "driver"
  const isSystem = msg.senderType === "system"

  if (isSystem) {
    return (
      <View style={styles.systemRow}>
        <Text style={styles.systemText}>{msg.text}</Text>
      </View>
    )
  }

  return (
    <View style={[styles.bubbleRow, isDriver ? styles.bubbleRowRight : styles.bubbleRowLeft]}>
      <View style={[styles.bubble, isDriver ? styles.bubbleDriver : styles.bubbleOther]}>
        <Text style={[styles.bubbleText, isDriver ? styles.bubbleTextDriver : styles.bubbleTextOther]}>
          {msg.text}
        </Text>
        <Text style={[styles.bubbleTime, isDriver ? styles.bubbleTimeDriver : styles.bubbleTimeOther]}>
          {formatMessageTime(msg.timestamp)}
        </Text>
      </View>
    </View>
  )
}

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { name, orderId, orderNumber } = useLocalSearchParams<{
    name?: string; orderId?: string; orderNumber?: string
  }>()
  const { session, refreshUnreadCount } = useDriver()
  const insets = useSafeAreaInsets()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState("")
  const [sending, setSending] = useState(false)
  const listRef = useRef<FlatList<ChatMessage>>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const threadId = id

  const fetchMessages = useCallback(async (silent = false) => {
    if (!session || !threadId) return
    try {
      const res = await driverFetch(
        `/api/driver/messages/thread?driverId=${encodeURIComponent(session.id)}&threadId=${encodeURIComponent(threadId)}`
      )
      if (!res.ok) return
      const data = await res.json() as { messages?: ChatMessage[] }
      const msgs = data.messages ?? []
      setMessages(msgs)
      if (!silent && msgs.length > 0) {
        setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 100)
      }
    } catch { /* ignore */ } finally {
      if (!silent) setLoading(false)
    }
  }, [session, threadId])

  // Mark thread as read and refresh unread count in context
  const markRead = useCallback(async () => {
    if (!session || !threadId) return
    await driverFetch("/api/driver/messages/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ driverId: session.id, threadId }),
    }).catch(() => {})
    void refreshUnreadCount()
  }, [session, threadId, refreshUnreadCount])

  useEffect(() => {
    void fetchMessages()
    void markRead()
    pollRef.current = setInterval(() => { void fetchMessages(true) }, 5_000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [fetchMessages, markRead])

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80)
    }
  }, [messages.length])

  async function sendMessage() {
    if (!text.trim() || !session || !threadId || sending) return
    const msgText = text.trim()
    setText("")
    setSending(true)

    // Optimistic insert
    const optimistic: ChatMessage = {
      id: `optimistic-${Date.now()}`,
      threadId,
      text: msgText,
      senderId: session.id,
      senderType: "driver",
      timestamp: Date.now(),
      isRead: true,
    }
    setMessages((prev) => [...prev, optimistic])
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80)

    try {
      await driverFetch("/api/driver/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driverId: session.id, threadId, text: msgText }),
      })
      // Replace optimistic with real data
      void fetchMessages(true)
    } catch { /* message shown optimistically; will correct on next poll */ }
    finally {
      setSending(false)
    }
  }

  const displayName = name ? decodeURIComponent(name) : "Chat"

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color="#111827" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerName} numberOfLines={1}>{displayName}</Text>
          {orderNumber ? (
            <Text style={styles.headerSub}>Order #{orderNumber}</Text>
          ) : null}
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        {loading ? (
          <ActivityIndicator color="#16a34a" style={{ marginTop: 60 }} />
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            contentContainerStyle={styles.messageList}
            renderItem={({ item }) => (
              <MessageBubble msg={item} driverId={session?.id ?? ""} />
            )}
            ListEmptyComponent={
              <View style={styles.emptyChat}>
                <Text style={styles.emptyChatText}>No messages yet. Say hello!</Text>
              </View>
            }
          />
        )}

        {/* Input bar */}
        <View style={[styles.inputBar, { paddingBottom: Math.max(12, insets.bottom) }]}>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="Type a message…"
            placeholderTextColor="#9ca3af"
            multiline
            maxLength={1000}
            returnKeyType="default"
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]}
            onPress={sendMessage}
            disabled={!text.trim() || sending}
            activeOpacity={0.8}
          >
            {sending
              ? <ActivityIndicator color="#fff" size="small" />
              : <Feather name="send" size={18} color="#fff" />}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
    gap: 10,
  },
  backBtn: { padding: 4 },
  headerCenter: { flex: 1 },
  headerName: { fontSize: 16, fontWeight: "700", color: "#111827" },
  headerSub: { fontSize: 12, color: "#6b7280", marginTop: 1 },
  messageList: { paddingHorizontal: 12, paddingVertical: 16, gap: 6 },
  bubbleRow: { flexDirection: "row", marginBottom: 4 },
  bubbleRowLeft: { justifyContent: "flex-start" },
  bubbleRowRight: { justifyContent: "flex-end" },
  bubble: {
    maxWidth: "75%",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleDriver: { backgroundColor: "#16a34a", borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: "#f3f4f6", borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 15, lineHeight: 21 },
  bubbleTextDriver: { color: "#fff" },
  bubbleTextOther: { color: "#111827" },
  bubbleTime: { fontSize: 10, marginTop: 4 },
  bubbleTimeDriver: { color: "rgba(255,255,255,0.7)", textAlign: "right" },
  bubbleTimeOther: { color: "#9ca3af", textAlign: "left" },
  systemRow: { alignItems: "center", marginVertical: 8 },
  systemText: { fontSize: 12, color: "#9ca3af", fontStyle: "italic" },
  emptyChat: { flex: 1, alignItems: "center", paddingTop: 60 },
  emptyChatText: { fontSize: 14, color: "#9ca3af" },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
    backgroundColor: "#fff",
    gap: 10,
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 120,
    backgroundColor: "#f9fafb",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: "#111827",
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#16a34a",
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: { backgroundColor: "#d1d5db" },
})

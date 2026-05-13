import { useState, useEffect, useRef } from "react"
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, TextInput, Image, Alert, PanResponder,
  Dimensions,
} from "react-native"
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context"
import { useLocalSearchParams, router } from "expo-router"
import * as ImagePicker from "expo-image-picker"
import * as ScreenOrientation from "expo-screen-orientation"
import Svg, { Path } from "react-native-svg"
import { Feather } from "@expo/vector-icons"
import { driverFetch } from "@/lib/api"
import { queueDelivery } from "@/lib/storage"
import { formatCurrency, type Order } from "@/lib/types"
import { useDriver } from "@/context/DriverContext"

const TEAL = "#0d9488"
const GREEN = "#16a34a"

type Point = { x: number; y: number }
type Stroke = Point[]

// Build a smooth SVG path from a stroke using quadratic bezier curves
function strokeToPath(stroke: Stroke): string {
  if (stroke.length === 0) return ""
  if (stroke.length === 1) {
    return `M${stroke[0].x},${stroke[0].y} L${stroke[0].x + 0.5},${stroke[0].y}`
  }
  let d = `M${stroke[0].x.toFixed(1)},${stroke[0].y.toFixed(1)}`
  for (let i = 1; i < stroke.length; i++) {
    const prev = stroke[i - 1]
    const curr = stroke[i]
    const midX = ((prev.x + curr.x) / 2).toFixed(1)
    const midY = ((prev.y + curr.y) / 2).toFixed(1)
    d += ` Q${prev.x.toFixed(1)},${prev.y.toFixed(1)} ${midX},${midY}`
  }
  const last = stroke[stroke.length - 1]
  d += ` L${last.x.toFixed(1)},${last.y.toFixed(1)}`
  return d
}

// Serialize all strokes to a base64-encoded SVG data URL
function strokesToBase64Svg(strokes: Stroke[], w: number, h: number): string {
  const pathTags = strokes
    .map((s) => strokeToPath(s))
    .filter(Boolean)
    .map((d) => `<path d="${d}" stroke="#111827" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`)
    .join("\n")

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<rect width="${w}" height="${h}" fill="white"/>
${pathTags}
</svg>`
  // btoa needs Latin1; encodeURIComponent + unescape handles any Unicode safely
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`
}

export default function DeliveryScreen() {
  const { id, mode } = useLocalSearchParams<{ id: string; mode: string }>()
  const isPOD = mode !== "failed"
  const { session, refreshOrders, liveGps } = useDriver()
  const insets = useSafeAreaInsets()

  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [photoUri, setPhotoUri] = useState<string | null>(null)
  const [photoData, setPhotoData] = useState<string | null>(null)
  const [notes, setNotes] = useState("")
  const [showSig, setShowSig] = useState(false)

  // Signature state
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const [hasSig, setHasSig] = useState(false)
  const [sigDataUrl, setSigDataUrl] = useState<string | null>(null)
  const currentStroke = useRef<Stroke>([])
  const [sigKey, setSigKey] = useState(0)
  const [canvasLayout, setCanvasLayout] = useState({ width: 0, height: 0 })

  useEffect(() => {
    if (!id) return
    driverFetch(`/api/driver/orders/${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .then((d: { order?: Order }) => setOrder(d.order ?? null))
      .catch(() => setOrder(null))
      .finally(() => setLoading(false))
  }, [id])

  // ── Signature pad — lock landscape on open, portrait on close ──────────────
  async function openSignaturePad() {
    setStrokes([])
    currentStroke.current = []
    setHasSig(false)
    setSigDataUrl(null)
    setSigKey(0)
    await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE_LEFT)
    setShowSig(true)
  }

  async function closeSignaturePad() {
    setShowSig(false)
    await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP)
  }

  async function discardSignature() {
    setStrokes([])
    currentStroke.current = []
    setHasSig(false)
    setSigDataUrl(null)
    setSigKey(0)
    await closeSignaturePad()
  }

  async function confirmSignature() {
    if (canvasLayout.width > 0 && canvasLayout.height > 0 && strokes.length > 0) {
      const dataUrl = strokesToBase64Svg(strokes, canvasLayout.width, canvasLayout.height)
      setSigDataUrl(dataUrl)
      setHasSig(true)
    }
    await closeSignaturePad()
  }

  // ── PanResponder for drawing ───────────────────────────────────────────────
  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: (e) => {
      const { locationX, locationY } = e.nativeEvent
      currentStroke.current = [{ x: locationX, y: locationY }]
      setSigKey((k) => k + 1)
    },
    onPanResponderMove: (e) => {
      const { locationX, locationY } = e.nativeEvent
      currentStroke.current.push({ x: locationX, y: locationY })
      setSigKey((k) => k + 1)
    },
    onPanResponderRelease: () => {
      if (currentStroke.current.length > 0) {
        setStrokes((prev) => [...prev, [...currentStroke.current]])
        currentStroke.current = []
        setHasSig(true)
      }
    },
  })

  function clearCanvas() {
    setStrokes([])
    currentStroke.current = []
    setHasSig(false)
    setSigKey(0)
  }

  // ── Camera ─────────────────────────────────────────────────────────────────
  async function takePhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== "granted") {
      Alert.alert("Camera Permission", "Please allow camera access in Settings.")
      return
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false, quality: 0.7, base64: true,
    })
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri)
      setPhotoData(result.assets[0].base64 ? `data:image/jpeg;base64,${result.assets[0].base64}` : null)
    }
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!order || !session) return
    setSubmitting(true)
    const status = isPOD ? "delivered" : "failed"
    const payload: Record<string, unknown> = {
      driverId: session.id,
      status,
      ...(photoData ? { photoData } : {}),
      ...(notes.trim() ? { deliveryNote: notes.trim() } : {}),
      ...(sigDataUrl ? { signatureData: sigDataUrl } : {}),
      ...(liveGps ? { deliveryLat: liveGps.lat, deliveryLng: liveGps.lng } : {}),
    }
    if (!isPOD && notes.trim()) payload.failedReason = notes.trim()

    try {
      const res = await driverFetch(`/api/driver/orders/${encodeURIComponent(order.id)}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error("Server error")
      await refreshOrders()
      router.replace("/(tabs)/dashboard")
    } catch {
      await queueDelivery({
        id: `${order.id}_${Date.now()}`,
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        driverId: session.id,
        photoData: photoData,
        signatureData: sigDataUrl,
        deliveryNotes: notes.trim(),
        capturedAt: Date.now(),
      })
      Alert.alert(
        "Saved Offline",
        `${order.orderNumber} will be submitted when you reconnect.`,
        [{ text: "OK", onPress: () => router.replace("/(tabs)/dashboard") }]
      )
    } finally {
      setSubmitting(false)
    }
  }

  // ── Loading / not found ────────────────────────────────────────────────────
  if (loading) {
    return <SafeAreaView style={s.center}><ActivityIndicator size="large" color={TEAL} /></SafeAreaView>
  }
  if (!order) {
    return (
      <SafeAreaView style={s.center}>
        <Text style={{ color: "#6b7280" }}>Order not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ color: TEAL, fontWeight: "600" }}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    )
  }

  // ── Landscape signature pad ────────────────────────────────────────────────
  if (showSig) {
    const allDisplayStrokes = [...strokes, ...(currentStroke.current.length > 0 ? [currentStroke.current] : [])]

    return (
      <SafeAreaView style={s.sigScreen}>
        {/* Header row */}
        <View style={s.sigHeader}>
          <TouchableOpacity onPress={discardSignature} style={s.sigIconBtn}>
            <Feather name="arrow-left" size={22} color="#111827" />
          </TouchableOpacity>
          <Text style={s.sigTitle}>Add Signature</Text>
          <TouchableOpacity onPress={clearCanvas} style={s.sigIconBtn}>
            <Feather name="refresh-cw" size={20} color="#374151" />
          </TouchableOpacity>
        </View>

        {/* Label */}
        <Text style={s.sigHint}>Please sign here:</Text>

        {/* Drawing canvas */}
        <View
          style={s.sigCanvas}
          onLayout={(e) => {
            const { width, height } = e.nativeEvent.layout
            setCanvasLayout({ width, height })
          }}
          {...panResponder.panHandlers}
        >
          <Svg
            key={sigKey}
            width={canvasLayout.width || "100%"}
            height={canvasLayout.height || "100%"}
            style={StyleSheet.absoluteFillObject}
          >
            {allDisplayStrokes.map((stroke, i) => {
              const d = strokeToPath(stroke)
              if (!d) return null
              return (
                <Path
                  key={i}
                  d={d}
                  stroke="#111827"
                  strokeWidth={2.5}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )
            })}
          </Svg>
        </View>

        {/* Bottom button */}
        <View style={[s.sigBottom, { paddingBottom: Math.max(16, insets.bottom + 8) }]}>
          <TouchableOpacity
            style={[s.addSigBtn, { backgroundColor: GREEN }, !hasSig && s.btnDisabled]}
            onPress={confirmSignature}
            disabled={!hasSig}
            activeOpacity={0.85}
          >
            <Text style={s.addSigBtnText}>Add Signature</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  // ── Main POD screen (portrait) ─────────────────────────────────────────────
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Feather name="arrow-left" size={20} color="#111827" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Proof of Delivery (POD)</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        {/* Photo area */}
        <TouchableOpacity style={s.photoBox} onPress={takePhoto} activeOpacity={0.8}>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={s.photoImg} resizeMode="cover" />
          ) : (
            <View style={s.photoPlaceholder}>
              <Feather name="image" size={64} color="#d1d5db" />
              <Feather name="plus" size={24} color="#d1d5db" style={{ position: "absolute", top: 12, right: 28 }} />
            </View>
          )}
        </TouchableOpacity>

        {/* Signature preview (when captured) */}
        {sigDataUrl && (
          <View style={s.sigPreviewWrap}>
            <Image source={{ uri: sigDataUrl }} style={s.sigPreview} resizeMode="contain" />
            <View style={s.sigPreviewBadge}>
              <Feather name="check-circle" size={14} color={GREEN} />
              <Text style={s.sigPreviewText}>Signature captured</Text>
            </View>
          </View>
        )}

        {/* Photo / Signature buttons */}
        <View style={[s.btnRow, !isPOD && { justifyContent: "center" }]}>
          <TouchableOpacity style={[s.outlineBtn, !isPOD && { flex: 1 }]} onPress={takePhoto}>
            <Feather name="camera" size={16} color="#374151" />
            <Text style={s.outlineBtnText}>{photoUri ? "Retake Photo" : "Add Image"}</Text>
          </TouchableOpacity>
          {isPOD && (
            <TouchableOpacity style={s.outlineBtn} onPress={openSignaturePad}>
              <Feather name="edit-2" size={16} color={hasSig ? GREEN : "#374151"} />
              <Text style={[s.outlineBtnText, hasSig && { color: GREEN }]}>
                {hasSig ? "✓ Signature" : "Add Signature"}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Notes */}
        <Text style={s.noteLabel}>Write a Note for Future Reference</Text>
        <TextInput
          style={s.noteInput}
          placeholder="Enter Your Note"
          placeholderTextColor="#9ca3af"
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Bottom action */}
      <View style={[s.bottomBtn, { paddingBottom: Math.max(16, insets.bottom) }]}>
        <TouchableOpacity
          style={[s.submitBtn, { backgroundColor: isPOD ? TEAL : "#ef4444" }, submitting && s.btnDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.85}
        >
          {submitting
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.submitBtnText}>{isPOD ? "Complete the Order" : "Failed"}</Text>}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },

  // Portrait main screen
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: "#f3f4f6",
  },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontWeight: "700", color: "#111827" },
  content: { padding: 16 },
  photoBox: { borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 12, overflow: "hidden", height: 220, marginBottom: 16 },
  photoImg: { width: "100%", height: "100%" },
  photoPlaceholder: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#f9fafb" },
  sigPreviewWrap: { borderWidth: 1, borderColor: "#d1fae5", borderRadius: 12, overflow: "hidden", height: 100, marginBottom: 12, backgroundColor: "#f0fdf4" },
  sigPreview: { width: "100%", height: 76 },
  sigPreviewBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingBottom: 6 },
  sigPreviewText: { fontSize: 12, color: "#16a34a", fontWeight: "600" },
  btnRow: { flexDirection: "row", gap: 12, marginBottom: 24 },
  outlineBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 100, paddingVertical: 12, backgroundColor: "#fff" },
  outlineBtnText: { fontSize: 14, color: "#374151", fontWeight: "500" },
  noteLabel: { fontSize: 16, fontWeight: "700", color: "#111827", marginBottom: 10 },
  noteInput: { borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 12, padding: 14, fontSize: 14, color: "#111827", backgroundColor: "#f9fafb", minHeight: 120 },
  bottomBtn: { position: "absolute", bottom: 0, left: 0, right: 0, paddingHorizontal: 16, paddingTop: 12, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#f3f4f6" },
  submitBtn: { borderRadius: 100, paddingVertical: 16, alignItems: "center" },
  submitBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  btnDisabled: { opacity: 0.5 },

  // Landscape signature pad
  sigScreen: { flex: 1, backgroundColor: "#fff" },
  sigHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: "#f3f4f6",
  },
  sigIconBtn: { padding: 6, width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  sigTitle: { fontSize: 16, fontWeight: "700", color: "#111827" },
  sigHint: { fontSize: 13, color: "#9ca3af", paddingHorizontal: 16, paddingTop: 8 },
  sigCanvas: {
    flex: 1,
    marginHorizontal: 16,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    backgroundColor: "#fff",
    overflow: "hidden",
  },
  sigBottom: { paddingHorizontal: 16, paddingTop: 8 },
  addSigBtn: { borderRadius: 100, paddingVertical: 16, alignItems: "center" },
  addSigBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
})

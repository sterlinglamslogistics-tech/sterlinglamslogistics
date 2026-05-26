"use client"

import { useState, useEffect, useRef, use } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  ArrowLeft,
  Camera,
  CheckCircle,
  ImageIcon,
  Loader2,
  Pen,
  Trash2,
  X,
} from "lucide-react"
import type { Order } from "@/lib/data"
import { toast } from "@/hooks/use-toast"
import { useDriver } from "@/components/driver-context"
import { driverFetch } from "@/lib/driver-client"
import { queueDelivery } from "@/lib/delivery-queue"
import { hapticTap, hapticSuccess, hapticError } from "@/lib/native-bridge"

const MAX_PHOTO_PX = 800
const PHOTO_QUALITY = 0.6

function compressPhoto(video: HTMLVideoElement): string {
  const ratio = Math.min(MAX_PHOTO_PX / video.videoWidth, MAX_PHOTO_PX / video.videoHeight, 1)
  const w = Math.round(video.videoWidth * ratio)
  const h = Math.round(video.videoHeight * ratio)
  const canvas = document.createElement("canvas")
  canvas.width = w
  canvas.height = h
  canvas.getContext("2d")!.drawImage(video, 0, 0, w, h)
  return canvas.toDataURL("image/jpeg", PHOTO_QUALITY)
}

export default function DeliveryCompletionPage({
  params,
}: {
  params: Promise<{ orderId: string }>
}) {
  const { orderId } = use(params)
  const router = useRouter()
  const { session, liveGps } = useDriver()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [notes, setNotes] = useState("")
  const [signerName, setSignerName] = useState("")
  const [photoData, setPhotoData] = useState<string | null>(null)
  const [signatureData, setSignatureData] = useState<string | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [showSignaturePad, setShowSignaturePad] = useState(false)
  const [showCamera, setShowCamera] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    driverFetch(`/api/driver/orders/${encodeURIComponent(orderId)}`, {})
      .then((r) => r.json())
      .then((d: { ok: boolean; order?: Order }) => {
        setOrder(d.order ?? null)
        setLoading(false)
      })
  }, [orderId])

  // Always stop the camera stream when the component unmounts
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [])

  // ── Signature drawing ────────────────────────────────────────────────────────

  function startDraw(e: React.MouseEvent | React.TouchEvent) {
    setIsDrawing(true)
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const rect = canvas.getBoundingClientRect()
    const x = "touches" in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left
    const y = "touches" in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    if (!isDrawing) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const rect = canvas.getBoundingClientRect()
    const x = "touches" in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left
    const y = "touches" in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top
    ctx.lineWidth = 2
    ctx.lineCap = "round"
    ctx.strokeStyle = "#000"
    ctx.lineTo(x, y)
    ctx.stroke()
  }

  function endDraw() { setIsDrawing(false) }

  function clearSignature() {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height)
    setSignatureData(null)
  }

  function saveSignature() {
    const canvas = canvasRef.current
    if (!canvas) return
    setSignatureData(canvas.toDataURL("image/png"))
    setShowSignaturePad(false)
    toast({ title: "Signature captured" })
  }

  // ── Camera ───────────────────────────────────────────────────────────────────

  async function openCamera() {
    setShowCamera(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
    } catch (err) {
      const isDenied = err instanceof DOMException && err.name === "NotAllowedError"
      toast({
        title: isDenied ? "Camera access denied" : "Camera error",
        description: isDenied
          ? "Go to Settings → App Permissions → Camera and enable it."
          : "Could not access camera. Try again.",
        variant: "destructive",
      })
      setShowCamera(false)
    }
  }

  function capturePhoto() {
    if (!videoRef.current) return
    setPhotoData(compressPhoto(videoRef.current))
    closeCamera()
    toast({ title: "Photo captured" })
  }

  function closeCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setShowCamera(false)
  }

  // ── Submit ───────────────────────────────────────────────────────────────────

  async function handleCompleteDelivery() {
    if (!order || !session) return
    void hapticTap("medium")
    setSubmitting(true)

    const payload = {
      driverId: session.id,
      status: "delivered" as const,
      ...(photoData ? { photoData } : {}),
      ...(signatureData ? { signatureData } : {}),
      ...(notes.trim() ? { deliveryNote: notes.trim() } : {}),
      ...(signerName.trim() ? { signerName: signerName.trim() } : {}),
      ...(liveGps ? { deliveryLat: liveGps.lat, deliveryLng: liveGps.lng } : {}),
    }

    try {
      const res = await driverFetch(`/api/driver/orders/${encodeURIComponent(order.id)}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error ?? "Failed to complete delivery")
      }

      void hapticSuccess()
      toast({ title: "Delivery completed!", description: `${order.orderNumber} marked as delivered.` })
      router.push("/driver/dashboard")
    } catch (err) {
      // Network failure — queue for automatic retry when connectivity returns
      const isNetworkError = !navigator.onLine || (err instanceof TypeError)
      if (isNetworkError) {
        queueDelivery({
          id: `${order.id}_${Date.now()}`,
          orderId: order.id,
          orderNumber: order.orderNumber,
          customerName: order.customerName,
          driverId: session.id,
          photoData: photoData ?? null,
          signatureData: signatureData ?? null,
          deliveryNotes: notes.trim(), // PendingDelivery interface uses deliveryNotes
          capturedAt: Date.now(),
        })
        void hapticSuccess()
        toast({
          title: "Saved offline",
          description: `${order.orderNumber} will be submitted automatically when you reconnect.`,
        })
        router.push("/driver/dashboard")
      } else {
        void hapticError()
        toast({
          title: "Error",
          description: err instanceof Error ? err.message : "Failed to complete delivery.",
          variant: "destructive",
        })
      }
    } finally {
      setSubmitting(false)
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!order) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Order not found</p>
        <Button onClick={() => router.push("/driver/dashboard")}>Go Back</Button>
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-white">
      {/* Header */}
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <button
          type="button"
          onClick={() => router.push("/driver/dashboard")}
          className="rounded-lg p-1.5 hover:bg-muted"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="flex-1 text-center text-base font-bold">Proof of Delivery (POD)</h1>
        <div className="w-9" />
      </div>

      {/* Scrollable body — leaves room for the fixed-bottom Complete button */}
      <div className="flex-1 overflow-y-auto px-4 pb-32 pt-4">
        {/* Photo preview / tap-to-take-photo placeholder */}
        <button
          type="button"
          onClick={openCamera}
          className="mb-4 block h-56 w-full overflow-hidden rounded-xl border border-border bg-muted/30 transition-opacity hover:opacity-90 active:opacity-80"
        >
          {photoData ? (
            <img src={photoData} alt="Delivery proof" className="h-full w-full object-cover" />
          ) : (
            <div className="relative flex h-full w-full items-center justify-center bg-gray-50">
              <ImageIcon className="h-16 w-16 text-gray-300" />
              <span className="absolute right-7 top-3 text-2xl font-light text-gray-300">+</span>
            </div>
          )}
        </button>

        {/* Signature preview (only when captured) */}
        {signatureData && (
          <div className="mb-3 overflow-hidden rounded-xl border border-green-200 bg-green-50">
            <img src={signatureData} alt="Customer signature" className="h-20 w-full object-contain bg-white" />
            <div className="flex items-center justify-between gap-2 px-3 py-1.5">
              <div className="flex items-center gap-1.5">
                <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                <span className="text-xs font-semibold text-green-600">Signature captured</span>
              </div>
              <button
                type="button"
                onClick={() => setSignatureData(null)}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-500"
                title="Clear signature"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Add image + Add signature outline buttons */}
        <div className="mb-6 flex gap-3">
          <button
            type="button"
            onClick={openCamera}
            className="flex flex-1 items-center justify-center gap-2 rounded-full border border-border bg-white py-3 text-sm font-medium text-foreground hover:bg-muted"
          >
            <Camera className="h-4 w-4" />
            {photoData ? "Retake Photo" : "Add Image"}
          </button>
          <button
            type="button"
            onClick={() => setShowSignaturePad(true)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-full border py-3 text-sm font-medium ${
              signatureData
                ? "border-green-600 text-green-600 hover:bg-green-50"
                : "border-border text-foreground hover:bg-muted"
            }`}
          >
            <Pen className="h-4 w-4" />
            {signatureData ? "✓ Signature" : "Add Signature"}
          </button>
        </div>

        {/* Note section */}
        <h3 className="mb-2.5 text-base font-bold">Write a Note for Future Reference</h3>
        <input
          type="text"
          placeholder="Name of the person signed (Required)"
          value={signerName}
          onChange={(e) => setSignerName(e.target.value)}
          className="mb-3 w-full rounded-xl border bg-muted/40 px-4 py-3.5 text-sm placeholder:text-muted-foreground focus:bg-background focus:outline-none focus:ring-2 focus:ring-green-500/30"
        />
        <Textarea
          placeholder="Enter Your Note"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          className="rounded-xl border bg-muted/40 px-4 py-3 text-sm placeholder:text-muted-foreground focus:bg-background"
        />
      </div>

      {/* Bottom-anchored Complete button */}
      <div
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-background px-4 pt-3"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}
      >
        <div className="mx-auto max-w-md">
          <button
            type="button"
            onClick={handleCompleteDelivery}
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-teal-600 py-4 text-base font-bold text-white hover:bg-teal-700 disabled:opacity-60"
          >
            {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Complete the Order"}
          </button>
        </div>
      </div>

      {/* Camera Modal */}
      {showCamera && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black">
          <div className="flex items-center justify-between p-4">
            <h2 className="font-semibold text-white">Take Photo</h2>
            <Button variant="ghost" size="sm" onClick={closeCamera} className="text-white hover:text-white">
              <X className="h-5 w-5" />
            </Button>
          </div>
          <div className="flex flex-1 items-center justify-center">
            <video ref={videoRef} autoPlay playsInline className="max-h-full max-w-full" />
          </div>
          <div className="flex justify-center p-6">
            <Button onClick={capturePhoto} className="h-16 w-16 rounded-full bg-white hover:bg-gray-200">
              <Camera className="h-8 w-8 text-black" />
            </Button>
          </div>
        </div>
      )}

      {/* Signature Pad Modal */}
      {showSignaturePad && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background">
          <div className="flex items-center justify-between border-b p-4">
            <h2 className="font-semibold">Customer Signature</h2>
            <Button variant="ghost" size="sm" onClick={() => setShowSignaturePad(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>
          <p className="px-4 pt-2 text-sm text-muted-foreground">
            Ask the customer to sign below
          </p>
          <div className="flex flex-1 items-center justify-center p-4">
            <canvas
              ref={canvasRef}
              width={350}
              height={200}
              className="w-full rounded-lg border bg-white touch-none"
              onMouseDown={startDraw}
              onMouseMove={draw}
              onMouseUp={endDraw}
              onMouseLeave={endDraw}
              onTouchStart={startDraw}
              onTouchMove={draw}
              onTouchEnd={endDraw}
            />
          </div>
          <div className="flex gap-3 p-4">
            <Button variant="outline" className="flex-1" onClick={clearSignature}>
              Clear
            </Button>
            <Button className="flex-1" onClick={saveSignature}>
              Save Signature
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

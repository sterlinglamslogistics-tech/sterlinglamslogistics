"use client"

import { useState, useEffect, useRef, use } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  Loader2,
  MapPin,
  Pen,
  Phone,
  Trash2,
  Navigation,
  X,
} from "lucide-react"
import { fetchOrder, updateOrder, updateDriver } from "@/lib/firestore"
import { formatCurrency } from "@/lib/data"
import type { Order } from "@/lib/data"
import { toast } from "@/hooks/use-toast"
import { notifyOrderEvent } from "@/lib/notify-client"

interface DriverSession {
  id: string
  name: string
  phone: string
}

export default function DeliveryCompletionPage({
  params,
}: {
  params: Promise<{ orderId: string }>
}) {
  const { orderId } = use(params)
  const router = useRouter()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [session, setSession] = useState<DriverSession | null>(null)
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [notes, setNotes] = useState("")
  const [photoData, setPhotoData] = useState<string | null>(null)
  const [signatureData, setSignatureData] = useState<string | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [showSignaturePad, setShowSignaturePad] = useState(false)
  const [showCamera, setShowCamera] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // Auth check
  useEffect(() => {
    const raw = localStorage.getItem("driverSession")
    if (!raw) {
      router.replace("/driver")
      return
    }
    setSession(JSON.parse(raw) as DriverSession)
  }, [router])

  // Load order
  useEffect(() => {
    async function load() {
      const data = await fetchOrder(orderId)
      setOrder(data)
      setLoading(false)
    }
    load()
  }, [orderId])

  // Signature drawing
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

  function endDraw() {
    setIsDrawing(false)
  }

  function clearSignature() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setSignatureData(null)
  }

  function saveSignature() {
    const canvas = canvasRef.current
    if (!canvas) return
    setSignatureData(canvas.toDataURL("image/png"))
    setShowSignaturePad(false)
    toast({ title: "Signature captured" })
  }

  // Camera/Photo
  async function openCamera() {
    setShowCamera(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
    } catch {
      toast({ title: "Camera Error", description: "Could not access camera.", variant: "destructive" })
      setShowCamera(false)
    }
  }

  function capturePhoto() {
    if (!videoRef.current) return
    const video = videoRef.current
    const canvas = document.createElement("canvas")
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.drawImage(video, 0, 0)
    setPhotoData(canvas.toDataURL("image/jpeg", 0.7))
    closeCamera()
    toast({ title: "Photo captured" })
  }

  function closeCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    setShowCamera(false)
  }

  async function handleCompleteDelivery() {
    if (!order || !session) return
    setSubmitting(true)
    try {
      const deliveredAt = new Date()
      await updateOrder(order.id, {
        status: "delivered",
        deliveredAt,
      })
      // check if driver has any other active orders
      await updateDriver(session.id, { status: "available" })
      notifyOrderEvent("delivered", {
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        customerPhone: order.phone,
        customerEmail: order.customerEmail,
        address: order.address,
        driverName: session?.name,
        items: order.items,
      })
      toast({ title: "Delivery completed!", description: `${order.orderNumber} marked as delivered.` })
      router.push("/driver/dashboard")
    } catch {
      toast({ title: "Error", description: "Failed to complete delivery.", variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

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
    <div className="mx-auto max-w-md px-4 pb-8">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center gap-3 bg-background py-4">
        <Button variant="ghost" size="sm" onClick={() => router.push("/driver/dashboard")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-lg font-bold">Complete Delivery</h1>
      </div>

      {/* Order Summary */}
      <div className="mb-6 rounded-xl border bg-card p-4">
        <div className="mb-3 flex items-start justify-between">
          <div>
            <p className="font-semibold">{order.orderNumber}</p>
            <p className="text-sm text-muted-foreground">{order.customerName}</p>
          </div>
          <p className="font-medium">{formatCurrency(order.amount)}</p>
        </div>
        <div className="space-y-1 text-sm">
          <div className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <span>{order.address}</span>
          </div>
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <span>{order.phone}</span>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <Button size="sm" variant="outline" className="flex-1" onClick={() => {
            const encoded = encodeURIComponent(order.address)
            window.location.href = `https://www.google.com/maps/dir/?api=1&destination=${encoded}`
          }}>
            <Navigation className="mr-1 h-3 w-3" /> Navigate
          </Button>
          <Button size="sm" variant="outline" className="flex-1" onClick={() => { window.location.href = `tel:${order.phone}` }}>
            <Phone className="mr-1 h-3 w-3" /> Call
          </Button>
        </div>
      </div>

      {/* Photo Proof */}
      <div className="mb-4">
        <h3 className="mb-2 font-semibold">Photo Proof</h3>
        {photoData ? (
          <div className="relative">
            <img src={photoData} alt="Delivery proof" className="w-full rounded-lg border" />
            <Button
              variant="destructive"
              size="sm"
              className="absolute right-2 top-2"
              onClick={() => setPhotoData(null)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <Button variant="outline" className="w-full" onClick={openCamera}>
            <Camera className="mr-2 h-4 w-4" /> Take Photo
          </Button>
        )}
      </div>

      {/* Signature */}
      <div className="mb-4">
        <h3 className="mb-2 font-semibold">Customer Signature</h3>
        {signatureData ? (
          <div className="relative">
            <img src={signatureData} alt="Signature" className="w-full rounded-lg border bg-white" />
            <Button
              variant="destructive"
              size="sm"
              className="absolute right-2 top-2"
              onClick={() => setSignatureData(null)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <Button variant="outline" className="w-full" onClick={() => setShowSignaturePad(true)}>
            <Pen className="mr-2 h-4 w-4" /> Collect Signature
          </Button>
        )}
      </div>

      {/* Notes */}
      <div className="mb-6">
        <h3 className="mb-2 font-semibold">Delivery Notes</h3>
        <Textarea
          placeholder="Any notes about the delivery..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
        />
      </div>

      {/* Complete Button */}
      <Button
        className="w-full bg-green-600 hover:bg-green-700"
        size="lg"
        onClick={handleCompleteDelivery}
        disabled={submitting}
      >
        {submitting ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <CheckCircle2 className="mr-2 h-4 w-4" />
        )}
        Mark as Delivered
      </Button>

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
            <Button
              onClick={capturePhoto}
              className="h-16 w-16 rounded-full bg-white hover:bg-gray-200"
            >
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

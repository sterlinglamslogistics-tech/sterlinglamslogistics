"use client"

import { useEffect, useState, useRef } from "react"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Save, Building2, Paintbrush, Megaphone, Settings2, Truck, Users, Bell, Route, MapPin, Loader2, Pencil, Store, Package } from "lucide-react"
import { doc, getDoc, setDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { toast } from "@/hooks/use-toast"
import Image from "next/image"

/* ─── Settings sub-nav items ───── */
const settingsNav = [
  { key: "business", label: "Business settings", icon: Building2 },
  { key: "brand", label: "Brand customization", icon: Paintbrush },
  { key: "dispatch", label: "Dispatch settings", icon: Settings2 },
  { key: "driver", label: "Driver settings", icon: Truck },
  { key: "notification", label: "Customer notification", icon: Bell },
  { key: "route", label: "Route planning", icon: Route },
  { key: "users", label: "Users", icon: Users },
  { key: "location", label: "Location", icon: MapPin },
]

/* ─── Firestore doc shape ───── */
interface NotificationSettings {
  etaEmail: boolean
  etaWhatsapp: boolean
  etaTrigger: string
  allowEditDeliveryInstructions: boolean
  proactiveDelayAlerts: boolean
  deliveryReceiptEmail: boolean
  deliveryFeedbackEmail: boolean
}

const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  etaEmail: true,
  etaWhatsapp: true,
  etaTrigger: "out_for_delivery",
  allowEditDeliveryInstructions: false,
  proactiveDelayAlerts: false,
  deliveryReceiptEmail: true,
  deliveryFeedbackEmail: true,
}

const SETTINGS_DOC = "customerNotification"
const BUSINESS_SETTINGS_DOC = "businessSettings"
const DRIVER_SETTINGS_DOC = "driverSettings"

/* ─── Driver settings shape ───── */
interface DriverSettings {
  dispatchOnlineOnly: boolean
  autoAcceptOrders: boolean
  showOrderPrice: boolean
  showEarningInfo: boolean
  showDriverPhone: boolean
  showSensitiveCustomerDetails: boolean
  itemCheckOnPickup: boolean
  requireProofOfDelivery: boolean
  requireProofOfPickup: boolean
  requireIdScanning: boolean
  driversCanReoptimizeRoute: boolean
}

const DEFAULT_DRIVER_SETTINGS: DriverSettings = {
  dispatchOnlineOnly: false,
  autoAcceptOrders: true,
  showOrderPrice: true,
  showEarningInfo: true,
  showDriverPhone: true,
  showSensitiveCustomerDetails: true,
  itemCheckOnPickup: true,
  requireProofOfDelivery: true,
  requireProofOfPickup: false,
  requireIdScanning: false,
  driversCanReoptimizeRoute: true,
}

/* ─── Business settings shape ───── */
interface BusinessSettings {
  businessName: string
  businessLogoUrl: string
  businessType: "merchant" | "delivery_company"
  merchantPhone: string
  merchantAddress: string
}

const DEFAULT_BUSINESS_SETTINGS: BusinessSettings = {
  businessName: "Sterlinglams",
  businessLogoUrl: "/placeholder-logo.png",
  businessType: "merchant",
  merchantPhone: "+234 9160009893",
  merchantAddress: "Sterlinglams – Ikota Ajah Lagos",
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("business")

  /* ─── Business state ───── */
  const [biz, setBiz] = useState<BusinessSettings>(DEFAULT_BUSINESS_SETTINGS)
  const [bizLoading, setBizLoading] = useState(true)
  const [bizSaving, setBizSaving] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [editingLogo, setEditingLogo] = useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)

  /* ─── Driver state ───── */
  const [driver, setDriver] = useState<DriverSettings>(DEFAULT_DRIVER_SETTINGS)
  const [driverLoading, setDriverLoading] = useState(true)
  const [driverSaving, setDriverSaving] = useState(false)

  /* ─── Notification state ───── */
  const [notif, setNotif] = useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS)
  const [notifLoading, setNotifLoading] = useState(true)
  const [notifSaving, setNotifSaving] = useState(false)

  // Load notification settings from Firestore
  useEffect(() => {
    async function load() {
      try {
        const snap = await getDoc(doc(db, "settings", SETTINGS_DOC))
        if (snap.exists()) {
          setNotif({ ...DEFAULT_NOTIFICATION_SETTINGS, ...snap.data() } as NotificationSettings)
        }
      } catch (err) {
        console.error("Failed to load notification settings:", err)
      } finally {
        setNotifLoading(false)
      }
    }
    load()
  }, [])

  // Load business settings from Firestore
  useEffect(() => {
    async function load() {
      try {
        const snap = await getDoc(doc(db, "settings", BUSINESS_SETTINGS_DOC))
        if (snap.exists()) {
          setBiz({ ...DEFAULT_BUSINESS_SETTINGS, ...snap.data() } as BusinessSettings)
        }
      } catch (err) {
        console.error("Failed to load business settings:", err)
      } finally {
        setBizLoading(false)
      }
    }
    load()
  }, [])

  // Save business settings
  async function saveBusinessSettings() {
    setBizSaving(true)
    try {
      await setDoc(doc(db, "settings", BUSINESS_SETTINGS_DOC), biz)
      toast({ title: "Saved", description: "Business settings updated." })
      setEditingName(false)
    } catch (err) {
      console.error("Failed to save business settings:", err)
      toast({ title: "Error", description: "Failed to save settings.", variant: "destructive" })
    } finally {
      setBizSaving(false)
    }
  }

  function updateBiz<K extends keyof BusinessSettings>(key: K, value: BusinessSettings[K]) {
    setBiz((prev) => ({ ...prev, [key]: value }))
  }

  // Handle logo file → convert to data URL and save
  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "Error", description: "Logo must be under 2MB.", variant: "destructive" })
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      updateBiz("businessLogoUrl", dataUrl)
      setEditingLogo(false)
    }
    reader.readAsDataURL(file)
  }

  // Load driver settings from Firestore
  useEffect(() => {
    async function load() {
      try {
        const snap = await getDoc(doc(db, "settings", DRIVER_SETTINGS_DOC))
        if (snap.exists()) {
          setDriver({ ...DEFAULT_DRIVER_SETTINGS, ...snap.data() } as DriverSettings)
        }
      } catch (err) {
        console.error("Failed to load driver settings:", err)
      } finally {
        setDriverLoading(false)
      }
    }
    load()
  }, [])

  // Save driver settings
  async function saveDriverSettings() {
    setDriverSaving(true)
    try {
      await setDoc(doc(db, "settings", DRIVER_SETTINGS_DOC), driver)
      toast({ title: "Saved", description: "Driver settings updated." })
    } catch (err) {
      console.error("Failed to save driver settings:", err)
      toast({ title: "Error", description: "Failed to save settings.", variant: "destructive" })
    } finally {
      setDriverSaving(false)
    }
  }

  function updateDriver<K extends keyof DriverSettings>(key: K, value: DriverSettings[K]) {
    setDriver((prev) => ({ ...prev, [key]: value }))
  }

  // Save notification settings to Firestore
  async function saveNotificationSettings() {
    setNotifSaving(true)
    try {
      await setDoc(doc(db, "settings", SETTINGS_DOC), notif)
      toast({ title: "Saved", description: "Customer notification settings updated." })
    } catch (err) {
      console.error("Failed to save notification settings:", err)
      toast({ title: "Error", description: "Failed to save settings. Try again.", variant: "destructive" })
    } finally {
      setNotifSaving(false)
    }
  }

  function updateNotif<K extends keyof NotificationSettings>(key: K, value: NotificationSettings[K]) {
    setNotif((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Settings
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your business settings and preferences
        </p>
      </div>

      <div className="flex flex-col gap-8 lg:flex-row">
        {/* ─── Settings sidebar ───── */}
        <nav className="w-full shrink-0 lg:w-56">
          <ul className="flex flex-row gap-1 overflow-x-auto lg:flex-col">
            {settingsNav.map((item) => {
              const Icon = item.icon
              return (
                <li key={item.key}>
                  <button
                    onClick={() => setActiveTab(item.key)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap",
                      activeTab === item.key
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                    {item.label}
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* ─── Settings content ───── */}
        <div className="flex-1 min-w-0">

          {/* ══════ Business settings ══════ */}
          {activeTab === "business" && (
            <div className="space-y-8 max-w-2xl">
              <h2 className="text-xl font-semibold">Business settings</h2>

              {bizLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="size-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  {/* — Business details — */}
                  <section className="space-y-6">
                    <div>
                      <h3 className="text-base font-semibold">Business details</h3>
                      <p className="text-sm text-muted-foreground">Set your business details</p>
                    </div>

                    {/* Business name */}
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-muted-foreground">Business name</p>
                        {editingName ? (
                          <Input
                            value={biz.businessName}
                            onChange={(e) => updateBiz("businessName", e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") setEditingName(false) }}
                            className="max-w-xs"
                            autoFocus
                          />
                        ) : (
                          <p className="text-base">{biz.businessName}</p>
                        )}
                      </div>
                      <button
                        onClick={() => setEditingName(!editingName)}
                        className="p-2 text-muted-foreground hover:text-foreground transition-colors"
                        aria-label="Edit business name"
                      >
                        <Pencil className="size-4" />
                      </button>
                    </div>

                    {/* Business logo */}
                    <div className="flex items-start justify-between">
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-muted-foreground">Business logo</p>
                        <div className="relative size-16 rounded-lg border border-border overflow-hidden bg-muted">
                          <Image
                            src={biz.businessLogoUrl}
                            alt="Business logo"
                            fill
                            className="object-contain"
                          />
                        </div>
                        <input
                          ref={logoInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleLogoChange}
                        />
                      </div>
                      <button
                        onClick={() => logoInputRef.current?.click()}
                        className="p-2 text-muted-foreground hover:text-foreground transition-colors"
                        aria-label="Edit business logo"
                      >
                        <Pencil className="size-4" />
                      </button>
                    </div>
                  </section>

                  <hr className="border-border" />

                  {/* — Business type details — */}
                  <section className="space-y-6">
                    <div>
                      <h3 className="text-base font-semibold">Business type details</h3>
                      <p className="text-sm text-muted-foreground">Set your business type details</p>
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm font-medium">Business type</p>
                      <p className="text-sm text-muted-foreground">
                        If you are a delivery only business like Pizza shop where pick up is always from
                        the same place, please choose the business type delivery only. Otherwise keep it
                        pick up and delivery.
                      </p>
                      <div className="flex gap-3 pt-2">
                        <button
                          onClick={() => updateBiz("businessType", "merchant")}
                          className={cn(
                            "flex flex-col items-center gap-2 rounded-lg border-2 px-6 py-4 text-sm font-medium transition-colors",
                            biz.businessType === "merchant"
                              ? "border-primary bg-primary/5 text-primary"
                              : "border-border text-muted-foreground hover:border-muted-foreground"
                          )}
                        >
                          <Store className="size-6" />
                          Merchant
                        </button>
                        <button
                          onClick={() => updateBiz("businessType", "delivery_company")}
                          className={cn(
                            "flex flex-col items-center gap-2 rounded-lg border-2 px-6 py-4 text-sm font-medium transition-colors",
                            biz.businessType === "delivery_company"
                              ? "border-primary bg-primary/5 text-primary"
                              : "border-border text-muted-foreground hover:border-muted-foreground"
                          )}
                        >
                          <Package className="size-6" />
                          Delivery company
                        </button>
                      </div>
                    </div>

                    {/* Merchant phone */}
                    <div className="space-y-2">
                      <Label htmlFor="merchant-phone">Merchant phone number</Label>
                      <Input
                        id="merchant-phone"
                        type="tel"
                        value={biz.merchantPhone}
                        onChange={(e) => updateBiz("merchantPhone", e.target.value)}
                        className="max-w-sm"
                        placeholder="+234 9160009893"
                      />
                    </div>

                    {/* Merchant store address */}
                    <div className="space-y-2">
                      <Label htmlFor="merchant-address">Merchant store address</Label>
                      <Input
                        id="merchant-address"
                        value={biz.merchantAddress}
                        onChange={(e) => updateBiz("merchantAddress", e.target.value)}
                        className="max-w-sm"
                        placeholder="Your store address"
                      />
                    </div>
                  </section>

                  {/* Save button */}
                  <div className="pt-4">
                    <Button onClick={saveBusinessSettings} disabled={bizSaving} className="w-full sm:w-auto">
                      {bizSaving ? (
                        <Loader2 className="mr-2 size-4 animate-spin" />
                      ) : (
                        <Save className="mr-2 size-4" />
                      )}
                      {bizSaving ? "Saving..." : "Save Business Settings"}
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ══════ Customer notification ══════ */}
          {activeTab === "notification" && (
            <div className="space-y-8 max-w-2xl">
              <h2 className="text-xl font-semibold">Customer notification</h2>

              {notifLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="size-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  {/* — Customer ETA sharing — */}
                  <section className="space-y-4">
                    <div>
                      <h3 className="text-base font-semibold">Customer ETA sharing</h3>
                      <p className="text-sm text-muted-foreground">
                        Turning on customer tracking will send customers a real time delivery tracking
                        page with live ETA by mins. It will also show the driver name, profile picture
                        and phone number to call or text the driver
                      </p>
                    </div>

                    <div className="flex items-center justify-between">
                      <Label htmlFor="eta-email" className="font-normal">Email</Label>
                      <Switch
                        id="eta-email"
                        checked={notif.etaEmail}
                        onCheckedChange={(v) => updateNotif("etaEmail", v)}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label htmlFor="eta-whatsapp" className="font-normal">WhatsApp</Label>
                      <Switch
                        id="eta-whatsapp"
                        checked={notif.etaWhatsapp}
                        onCheckedChange={(v) => updateNotif("etaWhatsapp", v)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Send tracking notification as soon as</Label>
                      <Select
                        value={notif.etaTrigger}
                        onValueChange={(v) => updateNotif("etaTrigger", v)}
                      >
                        <SelectTrigger className="w-full sm:w-72">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="order_accepted">Order is accepted</SelectItem>
                          <SelectItem value="out_for_delivery">Order is on the way</SelectItem>
                          <SelectItem value="picked_up">Order is picked up</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </section>

                  <hr className="border-border" />

                  {/* — Allow Editing Delivery Instructions — */}
                  <section className="space-y-2">
                    <div className="flex items-center gap-3">
                      <Switch
                        id="edit-instructions"
                        checked={notif.allowEditDeliveryInstructions}
                        onCheckedChange={(v) => updateNotif("allowEditDeliveryInstructions", v)}
                      />
                      <div>
                        <Label htmlFor="edit-instructions" className="font-semibold cursor-pointer">
                          Allow Editing Delivery Instructions on Tracking Link
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Allow Customers to change delivery instructions directly from the tracking link
                        </p>
                      </div>
                    </div>
                  </section>

                  <hr className="border-border" />

                  {/* — Proactive Delay Alerts — */}
                  <section className="space-y-2">
                    <div className="flex items-center gap-3">
                      <Switch
                        id="delay-alerts"
                        checked={notif.proactiveDelayAlerts}
                        onCheckedChange={(v) => updateNotif("proactiveDelayAlerts", v)}
                      />
                      <div>
                        <Label htmlFor="delay-alerts" className="font-semibold cursor-pointer">
                          Proactive Delay Alerts
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Automatically notify customers if an order is running late via SMS notification
                        </p>
                      </div>
                    </div>
                  </section>

                  <hr className="border-border" />

                  {/* — Delivery receipt — */}
                  <section className="space-y-4">
                    <div>
                      <h3 className="text-base font-semibold">Delivery receipt</h3>
                      <p className="text-sm text-muted-foreground">
                        This will send a notification to the customer with delivery details and proof
                        of delivery after the delivery is complete
                      </p>
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="receipt-email" className="font-normal">Email</Label>
                      <Switch
                        id="receipt-email"
                        checked={notif.deliveryReceiptEmail}
                        onCheckedChange={(v) => updateNotif("deliveryReceiptEmail", v)}
                      />
                    </div>
                  </section>

                  <hr className="border-border" />

                  {/* — Delivery feedback — */}
                  <section className="space-y-4">
                    <div>
                      <h3 className="text-base font-semibold">Delivery feedback</h3>
                      <p className="text-sm text-muted-foreground">
                        This will send a reminder notification within 24 hours to share feedback/rating
                        of their delivery service
                      </p>
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="feedback-email" className="font-normal">Email</Label>
                      <Switch
                        id="feedback-email"
                        checked={notif.deliveryFeedbackEmail}
                        onCheckedChange={(v) => updateNotif("deliveryFeedbackEmail", v)}
                      />
                    </div>
                  </section>

                  {/* Save button */}
                  <div className="pt-4">
                    <Button onClick={saveNotificationSettings} disabled={notifSaving} className="w-full sm:w-auto">
                      {notifSaving ? (
                        <Loader2 className="mr-2 size-4 animate-spin" />
                      ) : (
                        <Save className="mr-2 size-4" />
                      )}
                      {notifSaving ? "Saving..." : "Save Notification Settings"}
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ══════ Driver settings ══════ */}
          {activeTab === "driver" && (
            <div className="space-y-6 max-w-2xl">
              <div>
                <h2 className="text-xl font-semibold">Driver app</h2>
                <p className="text-sm text-muted-foreground">Custom settings to manage drivers</p>
              </div>

              {driverLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="size-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  <div className="space-y-5">
                    {/* Dispatch to online drivers only */}
                    <div className="flex items-start gap-4">
                      <Switch
                        id="dispatch-online"
                        checked={driver.dispatchOnlineOnly}
                        onCheckedChange={(v) => updateDriver("dispatchOnlineOnly", v)}
                        className="mt-0.5"
                      />
                      <div>
                        <Label htmlFor="dispatch-online" className="font-semibold cursor-pointer">
                          Dispatch to online drivers only
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          This is only show drivers active now on the driver page
                        </p>
                      </div>
                    </div>

                    {/* Auto-accept orders */}
                    <div className="flex items-start gap-4">
                      <Switch
                        id="auto-accept"
                        checked={driver.autoAcceptOrders}
                        onCheckedChange={(v) => updateDriver("autoAcceptOrders", v)}
                        className="mt-0.5"
                      />
                      <div>
                        <Label htmlFor="auto-accept" className="font-semibold cursor-pointer">
                          Drivers will always accept assigned orders (auto-accept)
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          No accept/reject option for the driver
                        </p>
                      </div>
                    </div>

                    {/* Show order item price */}
                    <div className="flex items-start gap-4">
                      <Switch
                        id="show-price"
                        checked={driver.showOrderPrice}
                        onCheckedChange={(v) => updateDriver("showOrderPrice", v)}
                        className="mt-0.5"
                      />
                      <div>
                        <Label htmlFor="show-price" className="font-semibold cursor-pointer">
                          Show order item price to driver/customer
                        </Label>
                      </div>
                    </div>

                    {/* Show earning info */}
                    <div className="flex items-start gap-4">
                      <Switch
                        id="show-earning"
                        checked={driver.showEarningInfo}
                        onCheckedChange={(v) => updateDriver("showEarningInfo", v)}
                        className="mt-0.5"
                      />
                      <div>
                        <Label htmlFor="show-earning" className="font-semibold cursor-pointer">
                          Show earning info to drivers before they accept the order
                        </Label>
                      </div>
                    </div>

                    {/* Show driver phone */}
                    <div className="flex items-start gap-4">
                      <Switch
                        id="show-driver-phone"
                        checked={driver.showDriverPhone}
                        onCheckedChange={(v) => updateDriver("showDriverPhone", v)}
                        className="mt-0.5"
                      />
                      <div>
                        <Label htmlFor="show-driver-phone" className="font-semibold cursor-pointer">
                          Show driver phone number to customers
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Customers will be able to call drivers directly
                        </p>
                      </div>
                    </div>

                    {/* Show sensitive customer details */}
                    <div className="flex items-start gap-4">
                      <Switch
                        id="sensitive-details"
                        checked={driver.showSensitiveCustomerDetails}
                        onCheckedChange={(v) => updateDriver("showSensitiveCustomerDetails", v)}
                        className="mt-0.5"
                      />
                      <div>
                        <Label htmlFor="sensitive-details" className="font-semibold cursor-pointer">
                          Show sensitive customer details (Customer name &amp; phone number) to the driver
                        </Label>
                      </div>
                    </div>

                    {/* Item check on pick-up */}
                    <div className="flex items-start gap-4">
                      <Switch
                        id="item-check"
                        checked={driver.itemCheckOnPickup}
                        onCheckedChange={(v) => updateDriver("itemCheckOnPickup", v)}
                        className="mt-0.5"
                      />
                      <div>
                        <Label htmlFor="item-check" className="font-semibold cursor-pointer">
                          Item check on pick-up
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Drivers have to confirm items on pick-up
                        </p>
                      </div>
                    </div>

                    {/* Require Proof of Delivery */}
                    <div className="flex items-start gap-4">
                      <Switch
                        id="proof-delivery"
                        checked={driver.requireProofOfDelivery}
                        onCheckedChange={(v) => updateDriver("requireProofOfDelivery", v)}
                        className="mt-0.5"
                      />
                      <div>
                        <Label htmlFor="proof-delivery" className="font-semibold cursor-pointer">
                          Require Proof of Delivery
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Drivers must take proof of delivery (Signature or Picture) to complete an order
                        </p>
                      </div>
                    </div>

                    {/* Require Proof of Pickup */}
                    <div className="flex items-start gap-4">
                      <Switch
                        id="proof-pickup"
                        checked={driver.requireProofOfPickup}
                        onCheckedChange={(v) => updateDriver("requireProofOfPickup", v)}
                        className="mt-0.5"
                      />
                      <div>
                        <Label htmlFor="proof-pickup" className="font-semibold cursor-pointer">
                          Require Proof of Pickup
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Drivers must take proof of pickup (Only Picture) to pick up an order
                        </p>
                      </div>
                    </div>

                    {/* Requires ID scanning */}
                    <div className="flex items-start gap-4">
                      <Switch
                        id="id-scanning"
                        checked={driver.requireIdScanning}
                        onCheckedChange={(v) => updateDriver("requireIdScanning", v)}
                        className="mt-0.5"
                      />
                      <div>
                        <Label htmlFor="id-scanning" className="font-semibold cursor-pointer">
                          Requires ID scanning
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Drivers must do id scanning
                        </p>
                      </div>
                    </div>

                    {/* Drivers can re-optimize route */}
                    <div className="flex items-start gap-4">
                      <Switch
                        id="reoptimize-route"
                        checked={driver.driversCanReoptimizeRoute}
                        onCheckedChange={(v) => updateDriver("driversCanReoptimizeRoute", v)}
                        className="mt-0.5"
                      />
                      <div>
                        <Label htmlFor="reoptimize-route" className="font-semibold cursor-pointer">
                          Drivers can re-optimize the route from their App
                        </Label>
                      </div>
                    </div>
                  </div>

                  {/* Save button */}
                  <div className="pt-4">
                    <Button onClick={saveDriverSettings} disabled={driverSaving} className="w-full sm:w-auto">
                      {driverSaving ? (
                        <Loader2 className="mr-2 size-4 animate-spin" />
                      ) : (
                        <Save className="mr-2 size-4" />
                      )}
                      {driverSaving ? "Saving..." : "Save Driver Settings"}
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ══════ Placeholder tabs ══════ */}
          {!["business", "notification", "driver"].includes(activeTab) && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <Settings2 className="size-10 text-muted-foreground/50 mb-3" />
                <h3 className="text-lg font-medium text-foreground">
                  {settingsNav.find((n) => n.key === activeTab)?.label}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  This section is coming soon.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

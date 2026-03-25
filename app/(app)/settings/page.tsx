"use client"

import { useEffect, useState } from "react"
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
import { Save, Building2, Paintbrush, Megaphone, Settings2, Truck, Users, Bell, Route, MapPin, Loader2 } from "lucide-react"
import { doc, getDoc, setDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { toast } from "@/hooks/use-toast"

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

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("notification")
  const [saved, setSaved] = useState(false)

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

  /* ─── Business settings save (existing) ───── */
  function handleBusinessSave(e: React.FormEvent) {
    e.preventDefault()
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
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
            <form onSubmit={handleBusinessSave} className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Business Information</CardTitle>
                  <CardDescription>Update your company details</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="company-name">Company Name</Label>
                      <Input id="company-name" defaultValue="Sterlinglams Logistics" />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="email">Business Email</Label>
                      <Input id="email" type="email" defaultValue="info@sterlinglams.com" />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input id="phone" type="tel" defaultValue="+234 800 123 4567" />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="address">Business Address</Label>
                      <Textarea id="address" defaultValue="15 Broad Street, Lagos Island, Lagos, Nigeria" rows={3} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Operations Settings</CardTitle>
                  <CardDescription>Configure delivery operations</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="currency">Default Currency</Label>
                      <Input id="currency" defaultValue="NGN (Nigerian Naira)" />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="timezone">Timezone</Label>
                      <Input id="timezone" defaultValue="Africa/Lagos (WAT)" />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="dispatch-limit">Max Orders per Driver</Label>
                      <Input id="dispatch-limit" type="number" defaultValue="5" />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="notification-email">Notification Email</Label>
                      <Input id="notification-email" type="email" defaultValue="dispatch@sterlinglams.com" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="lg:col-span-2">
                <Button type="submit" className="w-full sm:w-auto">
                  <Save className="mr-2 size-4" />
                  {saved ? "Saved!" : "Save Settings"}
                </Button>
              </div>
            </form>
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

          {/* ══════ Placeholder tabs ══════ */}
          {!["business", "notification"].includes(activeTab) && (
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

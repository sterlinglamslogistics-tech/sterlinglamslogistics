"use client"

import { useEffect, useState } from "react"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Save, Loader2 } from "lucide-react"
import { doc, getDoc, setDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { toast } from "@/hooks/use-toast"

interface BrandSettings {
  primaryColor: string
  accentColor: string
  trackingPageTitle: string
  trackingPageTagline: string
  emailHeaderColor: string
  emailFooterText: string
}

const DEFAULT: BrandSettings = {
  primaryColor: "#000000",
  accentColor: "#6366f1",
  trackingPageTitle: "Track your delivery",
  trackingPageTagline: "Real-time updates for your order",
  emailHeaderColor: "#000000",
  emailFooterText: "Thank you for shopping with us.",
}

const SETTINGS_DOC = "brandSettings"

export function BrandSettingsPanel() {
  const [settings, setSettings] = useState<BrandSettings>(DEFAULT)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const snap = await getDoc(doc(db, "settings", SETTINGS_DOC))
        if (snap.exists()) {
          setSettings({ ...DEFAULT, ...snap.data() } as BrandSettings)
        }
      } catch (err) {
        console.error("Failed to load brand settings:", err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  async function save() {
    setSaving(true)
    try {
      await setDoc(doc(db, "settings", SETTINGS_DOC), settings)
      toast({ title: "Saved", description: "Brand settings updated." })
    } catch (err) {
      console.error("Failed to save brand settings:", err)
      toast({ title: "Error", description: "Failed to save settings.", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  function update<K extends keyof BrandSettings>(key: K, value: BrandSettings[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h2 className="text-xl font-semibold">Brand customization</h2>
        <p className="text-sm text-muted-foreground">
          Customize colours, tracking page text, and email branding
        </p>
      </div>

      {/* Colours */}
      <section className="space-y-4">
        <div>
          <h3 className="text-base font-semibold">Brand colours</h3>
          <p className="text-sm text-muted-foreground">
            Used on the customer-facing tracking page and email headers
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="primary-color">Primary colour</Label>
            <div className="flex items-center gap-3">
              <input
                id="primary-color"
                type="color"
                value={settings.primaryColor}
                onChange={(e) => update("primaryColor", e.target.value)}
                className="h-9 w-12 cursor-pointer rounded border border-input bg-transparent p-1"
              />
              <Input
                value={settings.primaryColor}
                onChange={(e) => update("primaryColor", e.target.value)}
                placeholder="#000000"
                className="font-mono uppercase"
                maxLength={7}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="accent-color">Accent colour</Label>
            <div className="flex items-center gap-3">
              <input
                id="accent-color"
                type="color"
                value={settings.accentColor}
                onChange={(e) => update("accentColor", e.target.value)}
                className="h-9 w-12 cursor-pointer rounded border border-input bg-transparent p-1"
              />
              <Input
                value={settings.accentColor}
                onChange={(e) => update("accentColor", e.target.value)}
                placeholder="#6366f1"
                className="font-mono uppercase"
                maxLength={7}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Tracking page */}
      <section className="space-y-4">
        <div>
          <h3 className="text-base font-semibold">Tracking page</h3>
          <p className="text-sm text-muted-foreground">
            Text shown to customers on <code className="font-mono text-xs">/track/[tracking]</code>
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="tracking-title">Page title</Label>
          <Input
            id="tracking-title"
            value={settings.trackingPageTitle}
            onChange={(e) => update("trackingPageTitle", e.target.value)}
            placeholder="Track your delivery"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="tracking-tagline">Tagline / subtitle</Label>
          <Input
            id="tracking-tagline"
            value={settings.trackingPageTagline}
            onChange={(e) => update("trackingPageTagline", e.target.value)}
            placeholder="Real-time updates for your order"
          />
        </div>
      </section>

      {/* Email */}
      <section className="space-y-4">
        <div>
          <h3 className="text-base font-semibold">Email branding</h3>
          <p className="text-sm text-muted-foreground">
            Applies to order notification emails sent via Resend
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email-header-color">Email header background colour</Label>
          <div className="flex items-center gap-3">
            <input
              id="email-header-color"
              type="color"
              value={settings.emailHeaderColor}
              onChange={(e) => update("emailHeaderColor", e.target.value)}
              className="h-9 w-12 cursor-pointer rounded border border-input bg-transparent p-1"
            />
            <Input
              value={settings.emailHeaderColor}
              onChange={(e) => update("emailHeaderColor", e.target.value)}
              placeholder="#000000"
              className="font-mono uppercase"
              maxLength={7}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email-footer">Email footer text</Label>
          <Input
            id="email-footer"
            value={settings.emailFooterText}
            onChange={(e) => update("emailFooterText", e.target.value)}
            placeholder="Thank you for shopping with us."
          />
        </div>
      </section>

      <div className="pt-2">
        <Button onClick={save} disabled={saving} className="w-full sm:w-auto">
          {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
          {saving ? "Saving..." : "Save Brand Settings"}
        </Button>
      </div>
    </div>
  )
}

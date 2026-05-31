"use client"

import { useEffect, useState } from "react"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Save, Loader2, Copy, Check, Eye, EyeOff, RefreshCw } from "lucide-react"
import { doc, getDoc, setDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { toast } from "@/hooks/use-toast"

interface IntegrationSettings {
  woocommerceWebhookUrl: string
  woocommerceSecret: string
  paystackPublicKey: string
  paystackSecretKey: string
  apiKey: string
}

const DEFAULT: IntegrationSettings = {
  woocommerceWebhookUrl: "",
  woocommerceSecret: "",
  paystackPublicKey: "",
  paystackSecretKey: "",
  apiKey: "",
}

const SETTINGS_DOC = "integrationSettings"

function generateApiKey(): string {
  const arr = new Uint8Array(24)
  crypto.getRandomValues(arr)
  return "slk_" + Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("")
}

function MaskedInput({ value, onChange, placeholder, id }: { value: string; onChange: (v: string) => void; placeholder?: string; id: string }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative flex items-center">
      <Input
        id={id}
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pr-10 font-mono text-sm"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-3 text-muted-foreground hover:text-foreground"
        aria-label={show ? "Hide" : "Show"}
      >
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  )
}

export function IntegrationsSettingsPanel() {
  const [settings, setSettings] = useState<IntegrationSettings>(DEFAULT)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const snap = await getDoc(doc(db, "settings", SETTINGS_DOC))
        if (snap.exists()) {
          setSettings({ ...DEFAULT, ...snap.data() } as IntegrationSettings)
        }
      } catch (err) {
        console.error("Failed to load integration settings:", err)
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
      toast({ title: "Saved", description: "Integration settings updated." })
    } catch (err) {
      console.error("Failed to save integration settings:", err)
      toast({ title: "Error", description: "Failed to save settings.", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  function update<K extends keyof IntegrationSettings>(key: K, value: IntegrationSettings[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  function copyToClipboard(text: string, field: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(field)
      setTimeout(() => setCopiedField(null), 2000)
    })
  }

  function regenerateApiKey() {
    const key = generateApiKey()
    update("apiKey", key)
    toast({ title: "New key generated", description: "Save settings to persist the new API key." })
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
        <h2 className="text-xl font-semibold">Integrations</h2>
        <p className="text-sm text-muted-foreground">
          Connect external services — WooCommerce, Paystack, and your public API key
        </p>
      </div>

      {/* API key */}
      <section className="space-y-4">
        <div>
          <h3 className="text-base font-semibold">API key</h3>
          <p className="text-sm text-muted-foreground">
            Your platform API key for authenticating external requests and webhooks
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="api-key">API key</Label>
          <div className="flex gap-2">
            <div className="relative flex flex-1 items-center">
              <Input
                id="api-key"
                readOnly
                value={settings.apiKey || "No key generated yet"}
                className="font-mono text-xs pr-10 bg-secondary/40"
              />
              {settings.apiKey && (
                <button
                  type="button"
                  onClick={() => copyToClipboard(settings.apiKey, "apiKey")}
                  className="absolute right-3 text-muted-foreground hover:text-foreground"
                  aria-label="Copy API key"
                >
                  {copiedField === "apiKey" ? <Check className="size-4 text-emerald-500" /> : <Copy className="size-4" />}
                </button>
              )}
            </div>
            <Button type="button" variant="outline" onClick={regenerateApiKey} className="shrink-0">
              <RefreshCw className="mr-1.5 size-4" />
              {settings.apiKey ? "Regenerate" : "Generate"}
            </Button>
          </div>
          {settings.apiKey && (
            <p className="text-xs text-amber-600">Keep this key secret. Regenerating will invalidate the old key.</p>
          )}
        </div>
      </section>

      <hr className="border-border" />

      {/* WooCommerce */}
      <section className="space-y-4">
        <div>
          <h3 className="text-base font-semibold">WooCommerce</h3>
          <p className="text-sm text-muted-foreground">
            Configure the webhook so WooCommerce pushes new orders directly into the platform
          </p>
        </div>

        <div className="space-y-2">
          <Label>Webhook URL (paste into WooCommerce → Settings → Advanced → Webhooks)</Label>
          <div className="flex gap-2">
            <Input
              readOnly
              value={typeof window !== "undefined" ? `${window.location.origin}/api/woocommerce/webhook` : "/api/woocommerce/webhook"}
              className="font-mono text-xs bg-secondary/40 flex-1"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => copyToClipboard(typeof window !== "undefined" ? `${window.location.origin}/api/woocommerce/webhook` : "/api/woocommerce/webhook", "webhookUrl")}
              className="shrink-0"
            >
              {copiedField === "webhookUrl" ? <Check className="size-4 text-emerald-500" /> : <Copy className="size-4" />}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="wc-secret">Webhook secret</Label>
          <MaskedInput
            id="wc-secret"
            value={settings.woocommerceSecret}
            onChange={(v) => update("woocommerceSecret", v)}
            placeholder="wc_secret_..."
          />
          <p className="text-xs text-muted-foreground">Must match the secret set in WooCommerce → Webhooks → Secret</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="wc-webhook">WooCommerce REST API base URL (optional)</Label>
          <Input
            id="wc-webhook"
            value={settings.woocommerceWebhookUrl}
            onChange={(e) => update("woocommerceWebhookUrl", e.target.value)}
            placeholder="https://your-store.com/wp-json/wc/v3"
          />
        </div>
      </section>

      <hr className="border-border" />

      {/* Paystack */}
      <section className="space-y-4">
        <div>
          <h3 className="text-base font-semibold">Paystack</h3>
          <p className="text-sm text-muted-foreground">
            Used to verify payment status on orders before dispatching
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="paystack-public">Public key</Label>
          <Input
            id="paystack-public"
            value={settings.paystackPublicKey}
            onChange={(e) => update("paystackPublicKey", e.target.value)}
            placeholder="pk_live_..."
            className="font-mono text-sm"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="paystack-secret">Secret key</Label>
          <MaskedInput
            id="paystack-secret"
            value={settings.paystackSecretKey}
            onChange={(v) => update("paystackSecretKey", v)}
            placeholder="sk_live_..."
          />
          <p className="text-xs text-muted-foreground">
            Secret key is stored in Firestore — do not share. Prefer storing in Vercel environment variables instead for production.
          </p>
        </div>
      </section>

      <div className="pt-2">
        <Button onClick={save} disabled={saving} className="w-full sm:w-auto">
          {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
          {saving ? "Saving..." : "Save Integration Settings"}
        </Button>
      </div>
    </div>
  )
}

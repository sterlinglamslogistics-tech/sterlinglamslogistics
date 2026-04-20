"use client"

import { useEffect, useState, useRef } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Save, Loader2, Pencil, Store, Package } from "lucide-react"
import { doc, getDoc, setDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { toast } from "@/hooks/use-toast"
import Image from "next/image"

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

const BUSINESS_SETTINGS_DOC = "businessSettings"

export function BusinessSettingsPanel() {
  const [biz, setBiz] = useState<BusinessSettings>(DEFAULT_BUSINESS_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)

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
        setLoading(false)
      }
    }
    load()
  }, [])

  async function save() {
    setSaving(true)
    try {
      await setDoc(doc(db, "settings", BUSINESS_SETTINGS_DOC), biz)
      toast({ title: "Saved", description: "Business settings updated." })
      setEditingName(false)
    } catch (err) {
      console.error("Failed to save business settings:", err)
      toast({ title: "Error", description: "Failed to save settings.", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  function update<K extends keyof BusinessSettings>(key: K, value: BusinessSettings[K]) {
    setBiz((prev) => ({ ...prev, [key]: value }))
  }

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "Error", description: "Logo must be under 2MB.", variant: "destructive" })
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      update("businessLogoUrl", reader.result as string)
    }
    reader.readAsDataURL(file)
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
      <h2 className="text-xl font-semibold">Business settings</h2>

      <section className="space-y-6">
        <div>
          <h3 className="text-base font-semibold">Business details</h3>
          <p className="text-sm text-muted-foreground">Set your business details</p>
        </div>

        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">Business name</p>
            {editingName ? (
              <Input
                value={biz.businessName}
                onChange={(e) => update("businessName", e.target.value)}
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

        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Business logo</p>
            <div className="relative size-16 rounded-lg border border-border overflow-hidden bg-muted">
              <Image src={biz.businessLogoUrl} alt="Business logo" fill className="object-contain" />
            </div>
            <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
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
              onClick={() => update("businessType", "merchant")}
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
              onClick={() => update("businessType", "delivery_company")}
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

        <div className="space-y-2">
          <Label htmlFor="merchant-phone">Merchant phone number</Label>
          <Input
            id="merchant-phone"
            type="tel"
            value={biz.merchantPhone}
            onChange={(e) => update("merchantPhone", e.target.value)}
            className="max-w-sm"
            placeholder="+234 9160009893"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="merchant-address">Merchant store address</Label>
          <Input
            id="merchant-address"
            value={biz.merchantAddress}
            onChange={(e) => update("merchantAddress", e.target.value)}
            className="max-w-sm"
            placeholder="Your store address"
          />
        </div>
      </section>

      <div className="pt-4">
        <Button onClick={save} disabled={saving} className="w-full sm:w-auto">
          {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
          {saving ? "Saving..." : "Save Business Settings"}
        </Button>
      </div>
    </div>
  )
}

"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"

const PREFS_KEY = "driverDeliveryPrefs"

interface Preference {
  key: string
  label: string
  description?: string
  enabled: boolean
}

const DEFAULT_PREFS: Preference[] = [
  { key: "newOrderAlert", label: "New Order Alert", description: "Get notified when a new order is assigned", enabled: true },
  { key: "statusConfirmation", label: "Status Confirmation", description: "Confirm before changing order status", enabled: false },
  { key: "pod", label: "Proof of Delivery / POD", description: "Require photo proof on delivery", enabled: true },
  { key: "cashTips", label: "Add Cash Tips", description: "Allow customers to add cash tips", enabled: false },
]

export function getDeliveryPref(key: string): boolean {
  try {
    const saved = localStorage.getItem(PREFS_KEY)
    if (!saved) return DEFAULT_PREFS.find((p) => p.key === key)?.enabled ?? false
    const parsed = JSON.parse(saved) as Record<string, boolean>
    return parsed[key] ?? DEFAULT_PREFS.find((p) => p.key === key)?.enabled ?? false
  } catch {
    return DEFAULT_PREFS.find((p) => p.key === key)?.enabled ?? false
  }
}

export default function DriverDeliveryPreferenceSettingsPage() {
  const router = useRouter()
  const [prefs, setPrefs] = useState<Preference[]>(DEFAULT_PREFS)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(PREFS_KEY)
      if (saved) {
        const parsed = JSON.parse(saved) as Record<string, boolean>
        setPrefs((prev) => prev.map((p) => ({ ...p, enabled: parsed[p.key] ?? p.enabled })))
      }
    } catch { /* ignore */ }
  }, [])

  function toggle(key: string) {
    setPrefs((prev) => {
      const next = prev.map((p) => (p.key === key ? { ...p, enabled: !p.enabled } : p))
      try {
        const map = Object.fromEntries(next.map((p) => [p.key, p.enabled]))
        localStorage.setItem(PREFS_KEY, JSON.stringify(map))
      } catch { /* ignore */ }
      return next
    })
  }

  return (
    <div className="mx-auto max-w-md px-4 pb-8">
      <div className="sticky top-0 z-40 flex items-center gap-3 bg-background py-3">
        <button type="button" onClick={() => router.back()} className="rounded-lg p-1.5 hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-bold">Preferences</h1>
      </div>

      <div className="space-y-1">
        {prefs.map((pref) => (
          <div key={pref.key} className="flex items-center justify-between rounded-xl px-3 py-4">
            <div className="flex-1 pr-4">
              <p className="text-sm font-medium">{pref.label}</p>
              {pref.description && <p className="text-xs text-muted-foreground">{pref.description}</p>}
            </div>
            <button
              type="button"
              onClick={() => toggle(pref.key)}
              className={`relative h-7 w-12 rounded-full transition-colors ${pref.enabled ? "bg-green-500" : "bg-gray-300"}`}
            >
              <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${pref.enabled ? "translate-x-5" : "translate-x-0.5"}`} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

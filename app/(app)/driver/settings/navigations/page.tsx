"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Check } from "lucide-react"
import { cn } from "@/lib/utils"

export const NAV_APP_KEY = "driverNavApp"

export type NavApp = "google" | "waze" | "apple"

const navOptions: { value: NavApp; label: string; description: string }[] = [
  { value: "google", label: "Google Maps", description: "Opens in Google Maps app or web" },
  { value: "waze", label: "Waze", description: "Opens in Waze for live traffic routing" },
  { value: "apple", label: "Apple Maps", description: "Opens in Apple Maps (iOS only)" },
]

export function buildNavUrl(address: string, app: NavApp = "google"): string {
  const encoded = encodeURIComponent(address)
  if (app === "waze") return `https://waze.com/ul?q=${encoded}&navigate=yes`
  if (app === "apple") return `maps://maps.apple.com/?daddr=${encoded}`
  return `https://www.google.com/maps/dir/?api=1&destination=${encoded}`
}

export function getNavApp(): NavApp {
  try {
    const saved = localStorage.getItem(NAV_APP_KEY)
    if (saved === "google" || saved === "waze" || saved === "apple") return saved
  } catch { /* ignore */ }
  return "google"
}

export default function DriverNavigationsSettingsPage() {
  const router = useRouter()
  const [selected, setSelected] = useState<NavApp>("google")

  useEffect(() => {
    setSelected(getNavApp())
  }, [])

  function handleSelect(value: NavApp) {
    setSelected(value)
    try { localStorage.setItem(NAV_APP_KEY, value) } catch { /* ignore */ }
  }

  return (
    <div className="mx-auto max-w-md px-4 pb-8">
      <div className="sticky top-0 z-40 flex items-center gap-3 bg-background py-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-lg p-1.5 hover:bg-muted"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-bold">Navigation App</h1>
      </div>

      <p className="mb-4 text-sm text-muted-foreground">
        Choose which app opens when you tap Navigate on an order.
      </p>

      <div className="space-y-2">
        {navOptions.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => handleSelect(opt.value)}
            className={cn(
              "flex w-full items-center justify-between rounded-xl border px-4 py-4 text-left transition-colors hover:bg-muted",
              selected === opt.value && "border-green-600 bg-green-50"
            )}
          >
            <div>
              <p className={cn("font-medium", selected === opt.value ? "text-green-700" : "text-foreground")}>
                {opt.label}
              </p>
              <p className="text-xs text-muted-foreground">{opt.description}</p>
            </div>
            {selected === opt.value && <Check className="h-5 w-5 shrink-0 text-green-600" />}
          </button>
        ))}
      </div>
    </div>
  )
}

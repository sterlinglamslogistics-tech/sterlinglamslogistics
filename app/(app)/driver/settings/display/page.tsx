"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Check } from "lucide-react"
import { cn } from "@/lib/utils"

const options = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System Default" },
]

export default function DriverDisplaySettingsPage() {
  const router = useRouter()
  const [theme, setTheme] = useState("system")

  useEffect(() => {
    const saved = localStorage.getItem("driverTheme")
    if (saved) setTheme(saved)
  }, [])

  function selectTheme(value: string) {
    setTheme(value)
    localStorage.setItem("driverTheme", value)

    const root = document.documentElement
    if (value === "dark") {
      root.classList.add("dark")
    } else if (value === "light") {
      root.classList.remove("dark")
    } else {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
      root.classList.toggle("dark", prefersDark)
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 pb-8">
      {/* Header */}
      <div className="sticky top-0 z-40 flex items-center gap-3 bg-background py-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-lg p-1.5 hover:bg-muted"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-bold">Display</h1>
      </div>

      <div className="space-y-1">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => selectTheme(opt.value)}
            className={cn(
              "flex w-full items-center justify-between rounded-xl px-4 py-4 text-sm font-medium transition-colors",
              theme === opt.value ? "text-foreground" : "text-muted-foreground"
            )}
          >
            <span>{opt.label}</span>
            {theme === opt.value && (
              <Check className="h-5 w-5 text-green-600" />
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

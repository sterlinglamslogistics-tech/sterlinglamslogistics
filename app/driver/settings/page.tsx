"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChevronRight, LogOut, Settings2 } from "lucide-react"
import { Button } from "@/components/ui/button"

const settingLinks = [
  { label: "Profile", href: "/driver/settings/profile" },
  { label: "Delivery Preference", href: "/driver/settings/delivery-preference" },
  { label: "Navigations", href: "/driver/settings/navigations" },
  { label: "Display", href: "/driver/settings/display" },
  { label: "Help and Feedback", href: "/driver/settings/help-feedback" },
  { label: "Footer Page", href: "/driver/settings/footer-page" },
  { label: "Privacy", href: "/driver/settings/privacy" },
  { label: "About", href: "/driver/settings/about" },
]

export default function DriverSettingsPage() {
  const router = useRouter()

  function handleLogout() {
    localStorage.removeItem("driverSession")
    router.replace("/driver")
  }

  return (
    <div className="mx-auto max-w-md px-4 pb-8 pt-4">
      <div className="mb-4 flex items-center gap-2">
        <Settings2 className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-bold">Settings</h1>
      </div>
      <div className="space-y-2">
        {settingLinks.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center justify-between rounded-xl border bg-card px-4 py-3 text-sm font-medium hover:bg-muted"
          >
            <span>{item.label}</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        ))}
      </div>
      <Button variant="destructive" className="mt-4 w-full" onClick={handleLogout}>
        <LogOut className="mr-2 h-4 w-4" />
        Logout
      </Button>
    </div>
  )
}

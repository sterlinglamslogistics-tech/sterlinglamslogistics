"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Languages, Settings, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"

const tabs = [
  { label: "Complete Order", href: "/driver/completed-orders", icon: CheckCircle2 },
  { label: "Settings", href: "/driver/settings", icon: Settings },
  { label: "Language", href: "/driver/language", icon: Languages },
]

export function DriverTabs() {
  const pathname = usePathname()

  // Hide tabs on login and delivery confirmation pages.
  if (pathname === "/driver" || pathname.startsWith("/driver/delivery/")) {
    return null
  }

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/95 backdrop-blur">
      <div className="mx-auto grid max-w-md grid-cols-3 gap-1 px-2 py-2">
        {tabs.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex flex-col items-center justify-center rounded-lg py-2 text-[11px] font-medium",
                active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
              )}
            >
              <tab.icon className="mb-1 h-4 w-4" />
              {tab.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

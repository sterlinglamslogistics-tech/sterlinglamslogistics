"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Package, Map, Clock, MessageSquare, BarChart3 } from "lucide-react"
import { cn } from "@/lib/utils"

const tabs = [
  { label: "Orders", href: "/driver/dashboard", icon: Package },
  { label: "Map", href: "/driver/map", icon: Map },
  { label: "Waiting", href: "/driver/waiting", icon: Clock },
  { label: "Messages", href: "/driver/messages", icon: MessageSquare },
  { label: "Performance", href: "/driver/performance", icon: BarChart3 },
]

export function DriverTabs() {
  const pathname = usePathname()

  // Hide tabs on login and delivery confirmation pages.
  if (pathname === "/driver" || pathname.startsWith("/driver/delivery/")) {
    return null
  }

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/95 backdrop-blur safe-area-bottom">
      <div className="mx-auto grid max-w-md grid-cols-5 gap-0.5 px-1 py-1.5">
        {tabs.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex flex-col items-center justify-center rounded-lg py-1.5 text-[10px] font-medium transition-colors",
                active ? "text-green-600" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <tab.icon className={cn("mb-0.5 h-5 w-5", active && "text-green-600")} />
              {tab.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import {
  Send,
  Package,
  Users,
  Route,
  Star,
  BarChart3,
  Settings,
  Menu,
  X,
  LogOut,
  Bell,
  BellOff,
  HelpCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useState } from "react"
import { useAuth } from "@/components/auth-provider"
import { ThemeToggle } from "@/components/theme-provider"
import { useOrderAlert } from "@/components/order-alert-provider"

const navItems = [
  { label: "Dispatch", href: "/dispatch", icon: Send },
  { label: "Orders", href: "/orders", icon: Package },
  { label: "Drivers", href: "/drivers", icon: Users },
  { label: "Routes", href: "/routes", icon: Route },
  { label: "Reviews", href: "/reviews", icon: Star },
  { label: "Reports", href: "/reports", icon: BarChart3 },
]

export function AppSidebar() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const { user, logout } = useAuth()
  const { muted, toggleMute } = useOrderAlert()

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 items-center gap-4 px-4 lg:px-6">
        {/* Mobile menu button */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="lg:hidden"
          aria-label="Toggle navigation"
        >
          {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>

        {/* Logo */}
        <Link href="/dashboard" className="shrink-0">
          <Image
            src="/placeholder-logo.png"
            alt="Sterlinglams"
            width={80}
            height={80}
            className="rounded-lg"
          />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 lg:flex">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href))

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Right side actions */}
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={toggleMute}
            className={cn(
              "rounded-md p-2 transition-colors",
              muted
                ? "text-muted-foreground hover:text-foreground"
                : "text-foreground hover:text-primary"
            )}
            aria-label={muted ? "Unmute notifications" : "Mute notifications"}
            title={muted ? "Notifications muted — click to unmute" : "Notifications on — click to mute"}
          >
            {muted ? <BellOff className="size-4" /> : <Bell className="size-4" />}
          </button>
          <button
            className="rounded-md p-2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Help"
            title="Help"
          >
            <HelpCircle className="size-4" />
          </button>
          <ThemeToggle />
          {/* User avatar with dropdown */}
          <div className="relative group">
            <button
              className="flex size-8 items-center justify-center rounded-full bg-emerald-500 text-xs font-semibold text-white"
              aria-label="Account menu"
            >
              {user?.email ? user.email[0].toUpperCase() : "A"}
            </button>
            <div className="absolute right-0 top-full mt-1 hidden w-48 rounded-md border bg-popover p-1 shadow-lg group-hover:block">
              <p className="truncate px-3 py-1.5 text-xs text-muted-foreground">
                {user?.email ?? "admin@sterlinglams.com"}
              </p>
              <Link
                href="/settings"
                className="flex w-full items-center gap-2 rounded-sm px-3 py-1.5 text-sm text-foreground hover:bg-accent"
              >
                <Settings className="size-3.5" />
                Settings
              </Link>
              <button
                onClick={logout}
                className="flex w-full items-center gap-2 rounded-sm px-3 py-1.5 text-sm text-destructive hover:bg-accent"
              >
                <LogOut className="size-3.5" />
                Sign out
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile nav drawer */}
      {mobileOpen && (
        <nav className="border-t bg-background px-4 py-3 lg:hidden">
          <div className="flex flex-wrap gap-2">
            {navItems.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/" && pathname.startsWith(item.href))

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  )}
                >
                  <item.icon className="size-4" />
                  {item.label}
                </Link>
              )
            })}
          </div>
        </nav>
      )}
    </header>
  )
}

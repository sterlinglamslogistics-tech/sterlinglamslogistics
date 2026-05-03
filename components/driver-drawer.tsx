"use client"

import { useRouter } from "next/navigation"
import { useDriver } from "@/components/driver-context"
import { CheckCircle2, Settings, Globe, X, Star, MoreVertical } from "lucide-react"
import { cn } from "@/lib/utils"

export function DriverDrawer() {
  const router = useRouter()
  const { driver, isOnline, drawerOpen, setDrawerOpen, goOffline } = useDriver()

  function navigate(href: string) {
    setDrawerOpen(false)
    router.push(href)
  }

  async function handleGetOffline() {
    await goOffline()
    setDrawerOpen(false)
  }

  return (
    <>
      {/* Backdrop */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-[60] bg-black/50 transition-opacity"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* Drawer panel */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-[70] w-72 bg-background shadow-2xl transition-transform duration-300 ease-in-out",
          drawerOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-full flex-col">
          {/* Profile header */}
          <div className="px-5 pb-4 pt-10">
            <div className="mb-3 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-xl font-bold text-green-700">
                  {driver?.name?.charAt(0)?.toUpperCase() ?? "D"}
                </div>
                <div>
                  <h3 className="text-base font-bold">{driver?.name ?? "Driver"}</h3>
                  <div className="flex items-center gap-1.5">
                    <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                    <span className="text-sm font-medium">{driver?.rating?.toFixed(2) ?? "0.00"}</span>
                    {isOnline && (
                      <>
                        <span className="mx-1 text-muted-foreground">·</span>
                        <span className="flex items-center gap-1 text-xs text-green-600">
                          <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
                          Online
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="mt-1 rounded-lg p-1 hover:bg-muted"
              >
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>
          </div>

          {/* Menu items */}
          <div className="flex-1 px-3">
            <button
              type="button"
              onClick={() => navigate("/driver/completed-orders")}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium hover:bg-muted"
            >
              <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
              Completed Orders
            </button>
            <button
              type="button"
              onClick={() => navigate("/driver/settings")}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium hover:bg-muted"
            >
              <Settings className="h-5 w-5 text-muted-foreground" />
              Settings
            </button>
            <button
              type="button"
              onClick={() => navigate("/driver/language")}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium hover:bg-muted"
            >
              <Globe className="h-5 w-5 text-muted-foreground" />
              Language
            </button>
          </div>

          {/* Get Offline button */}
          {isOnline && (
            <div className="p-4">
              <button
                type="button"
                onClick={handleGetOffline}
                className="w-full rounded-xl bg-red-50 py-3 text-center text-sm font-semibold text-red-600 hover:bg-red-100"
              >
                Get Offline
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

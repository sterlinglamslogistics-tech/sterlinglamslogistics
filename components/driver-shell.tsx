"use client"

import { Toaster } from "@/components/ui/toaster"
import { DriverTabs } from "@/components/driver-tabs"
import { DriverProvider } from "@/components/driver-context"
import { DriverDrawer } from "@/components/driver-drawer"

export function DriverShell({ children }: { children: React.ReactNode }) {
  return (
    <DriverProvider>
      <div
        className="min-h-screen bg-background"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 4.5rem)" }}
      >
        <DriverDrawer />
        <DriverTabs />
        {children}
        <Toaster />
      </div>
    </DriverProvider>
  )
}

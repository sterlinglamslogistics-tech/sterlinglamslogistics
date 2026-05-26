"use client"

import { Toaster } from "@/components/ui/toaster"
import { DriverTabs } from "@/components/driver-tabs"
import { DriverProvider } from "@/components/driver-context"
import { DriverDrawer } from "@/components/driver-drawer"
import { DriverNativeChrome } from "@/components/driver-native-chrome"
import { DriverRouteTransition } from "@/components/driver-route-transition"

export function DriverShell({ children }: { children: React.ReactNode }) {
  return (
    <DriverProvider>
      <DriverNativeChrome />
      <div
        className="min-h-screen bg-background"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 4.5rem)" }}
      >
        <DriverDrawer />
        <DriverTabs />
        <DriverRouteTransition>{children}</DriverRouteTransition>
        <Toaster />
      </div>
    </DriverProvider>
  )
}

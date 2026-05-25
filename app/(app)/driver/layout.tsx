import type { Metadata, Viewport } from "next"
import { DriverShell } from "@/components/driver-shell"
import { DriverSWRegister } from "@/components/driver-sw-register"

export const metadata: Metadata = {
  title: "Sterlinglams - Driver App",
  description: "Driver mobile interface for Sterlinglams deliveries",
  manifest: "/driver/manifest.json",
}

export const viewport: Viewport = {
  themeColor: "#16a34a",
}

export default function DriverLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <DriverSWRegister />
      <DriverShell>
        {children}
      </DriverShell>
    </>
  )
}

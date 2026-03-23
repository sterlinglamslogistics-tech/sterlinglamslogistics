import type { Metadata } from "next"
import { Toaster } from "@/components/ui/toaster"
import { DriverTabs } from "@/components/driver-tabs"

export const metadata: Metadata = {
  title: "Sterlin Glams - Driver App",
  description: "Driver mobile interface for Sterlin Glams deliveries",
}

export default function DriverLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background pb-24">
      <DriverTabs />
      {children}
      <Toaster />
    </div>
  )
}

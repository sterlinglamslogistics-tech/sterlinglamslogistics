import type { Metadata } from "next"
import { DriverShell } from "@/components/driver-shell"

export const metadata: Metadata = {
  title: "Sterlinglams - Driver App",
  description: "Driver mobile interface for Sterlinglams deliveries",
}

export default function DriverLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <DriverShell>
      {children}
    </DriverShell>
  )
}

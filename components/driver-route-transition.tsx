"use client"

import { usePathname } from "next/navigation"
import type { ReactNode } from "react"

/**
 * Wraps the driver-app route children with a subtle slide-in + fade-in
 * animation each time the pathname changes. Re-keying by pathname forces
 * the children subtree to remount, which restarts the CSS animation.
 *
 * The animation uses tailwindcss-animate utilities (already configured
 * via shadcn) so there's no new dependency. ~200ms is fast enough to
 * feel responsive while still reading like a native page transition.
 */
export function DriverRouteTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  return (
    <div
      key={pathname}
      className="animate-in fade-in slide-in-from-right-4 duration-200 motion-reduce:animate-none"
    >
      {children}
    </div>
  )
}

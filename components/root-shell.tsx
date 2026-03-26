"use client"

import { usePathname, useRouter } from "next/navigation"
import { useEffect } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { useAuth } from "@/components/auth-provider"
import { Spinner } from "@/components/ui/spinner"

export function RootShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, loading } = useAuth()

  const isDriverRoute = pathname.startsWith("/driver")
  const isPublicTrackingRoute = pathname.startsWith("/track/")
  const isLoginRoute = pathname === "/login"
  const isLandingRoute = pathname === "/"

  // These routes don't need admin auth
  const isPublicRoute = isDriverRoute || isPublicTrackingRoute || isLoginRoute || isLandingRoute

  useEffect(() => {
    if (loading) return
    if (!isPublicRoute && !user) {
      router.replace("/")
    }
    if (isLoginRoute && user) {
      router.replace("/dashboard")
    }
  }, [loading, user, isPublicRoute, isLoginRoute, router])

  // Public routes: render immediately without auth check
  if (isDriverRoute || isPublicTrackingRoute || isLandingRoute) {
    return <>{children}</>
  }

  // Login page: show children directly (login form handles its own layout)
  if (isLoginRoute) {
    if (loading) {
      return (
        <div className="flex min-h-screen items-center justify-center">
          <Spinner className="size-8" />
        </div>
      )
    }
    return <>{children}</>
  }

  // Admin routes: need auth
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="size-8" />
      </div>
    )
  }

  if (!user) {
    return null // will redirect via useEffect
  }

  return (
    <>
      <AppSidebar />
      <main className="min-h-[calc(100vh-3.5rem)] bg-background">
        <div className="mx-auto max-w-[1600px] px-4 py-6 lg:px-6">{children}</div>
      </main>
    </>
  )
}

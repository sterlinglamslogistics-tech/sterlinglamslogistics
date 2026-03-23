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

  // These routes don't need admin auth
  const isPublicRoute = isDriverRoute || isPublicTrackingRoute || isLoginRoute

  useEffect(() => {
    if (loading) return
    if (!isPublicRoute && !user) {
      router.replace("/login")
    }
    if (isLoginRoute && user) {
      router.replace("/")
    }
  }, [loading, user, isPublicRoute, isLoginRoute, router])

  // Public routes: render immediately without auth check
  if (isDriverRoute || isPublicTrackingRoute) {
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
      <main className="min-h-screen bg-background pl-0 lg:pl-64">
        <div className="mx-auto max-w-7xl px-4 py-6 pt-16 lg:px-8 lg:pt-6">{children}</div>
      </main>
    </>
  )
}

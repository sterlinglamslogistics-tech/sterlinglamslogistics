"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Menu, MessageSquare } from "lucide-react"
import { useDriver } from "@/components/driver-context"

export default function DriverMessagesPage() {
  const router = useRouter()
  const { session, loadingSession, setDrawerOpen } = useDriver()

  useEffect(() => {
    if (!loadingSession && !session) {
      router.replace("/driver")
    }
  }, [loadingSession, session, router])

  if (loadingSession || !session) return null

  return (
    <div className="mx-auto max-w-md px-4 pb-8">
      <div className="sticky top-0 z-40 flex items-center gap-3 bg-background py-3">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="rounded-lg p-1.5 hover:bg-muted"
        >
          <Menu className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-bold">Messages</h1>
      </div>

      <div className="flex flex-col items-center justify-center py-20">
        <MessageSquare className="mb-3 h-12 w-12 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">No messages yet</p>
        <p className="text-xs text-muted-foreground">Dispatch messages will appear here</p>
      </div>
    </div>
  )
}

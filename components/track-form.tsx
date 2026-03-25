"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Search, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"

export function TrackForm() {
  const [trackingId, setTrackingId] = useState("")
  const router = useRouter()

  function handleTrack(e: React.FormEvent) {
    e.preventDefault()
    if (trackingId.trim()) {
      router.push(`/track/${encodeURIComponent(trackingId.trim())}`)
    }
  }

  return (
    <form
      onSubmit={handleTrack}
      className="mt-6 flex flex-col gap-3 sm:flex-row"
    >
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Enter tracking ID"
          value={trackingId}
          onChange={(e) => setTrackingId(e.target.value)}
          className="h-11 w-full rounded-lg border border-input bg-background pl-10 pr-4 text-sm outline-none ring-ring transition-shadow focus:ring-2"
        />
      </div>
      <Button type="submit" size="lg" className="gap-2">
        Track
        <ArrowRight className="size-4" />
      </Button>
    </form>
  )
}

"use client"

import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react"
import { subscribeOrdersRealtime } from "@/lib/firestore"
import type { Order } from "@/lib/data"

interface OrderAlertContextValue {
  muted: boolean
  toggleMute: () => void
  latestOrder: Order | null
}

const OrderAlertContext = createContext<OrderAlertContextValue>({
  muted: false,
  toggleMute: () => {},
  latestOrder: null,
})

export function useOrderAlert() {
  return useContext(OrderAlertContext)
}

/** Play a two-tone chime using Web Audio API */
function playAlertSound() {
  try {
    const ctx = new AudioContext()
    const now = ctx.currentTime

    // First tone
    const osc1 = ctx.createOscillator()
    const gain1 = ctx.createGain()
    osc1.type = "sine"
    osc1.frequency.value = 880
    gain1.gain.setValueAtTime(0.3, now)
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.3)
    osc1.connect(gain1).connect(ctx.destination)
    osc1.start(now)
    osc1.stop(now + 0.3)

    // Second tone (higher)
    const osc2 = ctx.createOscillator()
    const gain2 = ctx.createGain()
    osc2.type = "sine"
    osc2.frequency.value = 1174.66
    gain2.gain.setValueAtTime(0.3, now + 0.15)
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.5)
    osc2.connect(gain2).connect(ctx.destination)
    osc2.start(now + 0.15)
    osc2.stop(now + 0.5)

    // Cleanup
    setTimeout(() => ctx.close(), 1000)
  } catch {
    // Audio not available
  }
}

export function OrderAlertProvider({ children }: { children: React.ReactNode }) {
  const [muted, setMuted] = useState(() => {
    if (typeof window === "undefined") return false
    return localStorage.getItem("order-alert-muted") === "true"
  })
  const [latestOrder, setLatestOrder] = useState<Order | null>(null)
  const knownOrderIdsRef = useRef<Set<string> | null>(null)
  const mutedRef = useRef(muted)

  useEffect(() => {
    mutedRef.current = muted
    localStorage.setItem("order-alert-muted", String(muted))
  }, [muted])

  const toggleMute = useCallback(() => setMuted((m) => !m), [])

  useEffect(() => {
    const unsubscribe = subscribeOrdersRealtime((orders: Order[]) => {
      const currentIds = new Set(orders.map((o) => o.id))

      if (knownOrderIdsRef.current === null) {
        // First load — just record what we already have, no sound
        knownOrderIdsRef.current = currentIds
        return
      }

      // Find newly added orders (ids not in the previous set)
      const newOrders = orders.filter((o) => !knownOrderIdsRef.current!.has(o.id))

      if (newOrders.length > 0) {
        setLatestOrder(newOrders[0])
        if (!mutedRef.current) {
          playAlertSound()
        }
      }

      knownOrderIdsRef.current = currentIds
    })

    return () => unsubscribe()
  }, [])

  return (
    <OrderAlertContext.Provider value={{ muted, toggleMute, latestOrder }}>
      {children}
    </OrderAlertContext.Provider>
  )
}

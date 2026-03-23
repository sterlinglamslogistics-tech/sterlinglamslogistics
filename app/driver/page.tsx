"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, Truck } from "lucide-react"
import { authenticateDriver } from "@/lib/firestore"
import { toast } from "@/hooks/use-toast"

export default function DriverLoginPage() {
  const router = useRouter()
  const [phone, setPhone] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const raw = localStorage.getItem("driverSession")
    if (!raw) return

    try {
      const parsed = JSON.parse(raw) as { id?: string }
      if (parsed?.id) {
        router.replace("/driver/dashboard")
      }
    } catch {
      localStorage.removeItem("driverSession")
    }
  }, [router])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!phone.trim() || !password.trim()) {
      toast({ title: "Error", description: "Please enter phone and password.", variant: "destructive" })
      return
    }
    setLoading(true)
    try {
      const driver = await authenticateDriver(phone.trim(), password)
      if (!driver) {
        toast({ title: "Login failed", description: "Invalid phone number or password.", variant: "destructive" })
        setLoading(false)
        return
      }
      // store driver session in localStorage
      localStorage.setItem("driverSession", JSON.stringify({ id: driver.id, name: driver.name, phone: driver.phone }))
      router.push("/driver/dashboard")
    } catch {
      toast({ title: "Error", description: "Something went wrong. Try again.", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center space-y-2 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <Truck className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Sterlin Glams</h1>
          <p className="text-sm text-muted-foreground">Driver Login</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Phone Number</label>
            <Input
              type="tel"
              placeholder="+234 801 234 5678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Password</label>
            <Input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Sign In
          </Button>
        </form>
      </div>
    </div>
  )
}

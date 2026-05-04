"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2 } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import Image from "next/image"
import { setDriverToken } from "@/lib/driver-client"

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
      const res = await fetch("/api/driver/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: phone.trim(),
          password,
        }),
      })

      const data = (await res.json()) as {
        ok: boolean
        error?: string
        driver?: { id: string; name: string; phone: string }
        token?: string
      }

      if (!res.ok || !data.ok || !data.driver) {
        toast({ title: "Login failed", description: "Invalid phone number or password.", variant: "destructive" })
        setLoading(false)
        return
      }
      // store driver session in localStorage
      localStorage.setItem("driverSession", JSON.stringify({ id: data.driver.id, name: data.driver.name, phone: data.driver.phone }))
      if (data.token) setDriverToken(data.token)
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
        <div className="flex flex-col items-center space-y-4 text-center">
          <Image
            src="/placeholder-logo.png"
            alt="Sterlinglams"
            width={160}
            height={160}
          />
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

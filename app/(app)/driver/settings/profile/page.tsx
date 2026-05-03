"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Pencil } from "lucide-react"
import { useDriver } from "@/components/driver-context"
import { toast } from "@/hooks/use-toast"
import { driverFetch } from "@/lib/driver-client"

const vehicleOptions = ["MOTORCYCLE", "CAR", "BICYCLE", "VAN", "TRUCK"]

export default function DriverProfileSettingsPage() {
  const router = useRouter()
  const { session, driver } = useDriver()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [personalId, setPersonalId] = useState("")
  const [vehicle, setVehicle] = useState("MOTORCYCLE")
  const [model, setModel] = useState("")
  const [plate, setPlate] = useState("")
  const [city, setCity] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (driver) {
      setName(driver.name ?? "")
      setEmail(driver.email ?? "")
      setPhone(driver.phone ?? "")
      setVehicle(driver.vehicle ?? "MOTORCYCLE")
      setCity(driver.area ?? "")
    }
  }, [driver])

  async function handleSave() {
    if (!session) return
    setSaving(true)
    try {
      const res = await driverFetch("/api/driver/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          driverId: session.id,
          name,
          email,
          phone,
          vehicle,
          area: city,
        }),
      })
      if (!res.ok) {
        throw new Error("Failed to save profile")
      }
      toast({ title: "Profile saved" })
    } catch {
      toast({ title: "Error", description: "Failed to save profile.", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 pb-8">
      {/* Header */}
      <div className="sticky top-0 z-40 flex items-center justify-between bg-background py-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-lg p-1.5 hover:bg-muted"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-bold">Profile</h1>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="text-sm font-semibold text-green-600 hover:text-green-700 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>

      {/* Avatar */}
      <div className="mb-6 flex flex-col items-center">
        <div className="relative mb-2">
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-green-100 text-3xl font-bold text-green-700">
            {name?.charAt(0)?.toUpperCase() ?? "D"}
          </div>
          <button
            type="button"
            className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-green-600 text-white shadow-lg"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </div>
        <p className="font-semibold">{name || "Driver"}</p>
      </div>

      {/* Form */}
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground uppercase tracking-wider">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl border bg-card px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-green-500/30"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground uppercase tracking-wider">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border bg-card px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-green-500/30"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground uppercase tracking-wider">Phone</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-xl border bg-card px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-green-500/30"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground uppercase tracking-wider">Personal ID</label>
          <input
            type="text"
            value={personalId}
            onChange={(e) => setPersonalId(e.target.value)}
            placeholder="Enter personal ID"
            className="w-full rounded-xl border bg-card px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-green-500/30"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground uppercase tracking-wider">Vehicle</label>
          <select
            value={vehicle}
            onChange={(e) => setVehicle(e.target.value)}
            className="w-full rounded-xl border bg-card px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-green-500/30"
          >
            {vehicleOptions.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground uppercase tracking-wider">Model</label>
          <input
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="Vehicle model"
            className="w-full rounded-xl border bg-card px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-green-500/30"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground uppercase tracking-wider">Plate</label>
          <input
            type="text"
            value={plate}
            onChange={(e) => setPlate(e.target.value)}
            placeholder="License plate"
            className="w-full rounded-xl border bg-card px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-green-500/30"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground uppercase tracking-wider">City</label>
          <input
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Operating city"
            className="w-full rounded-xl border bg-card px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-green-500/30"
          />
        </div>

        <button
          type="button"
          className="w-full rounded-xl border py-3 text-sm font-medium text-muted-foreground hover:bg-muted"
        >
          Change password
        </button>
      </div>
    </div>
  )
}

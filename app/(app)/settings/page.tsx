"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Save } from "lucide-react"

export default function SettingsPage() {
  const [saved, setSaved] = useState(false)

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Settings
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your business settings and preferences
        </p>
      </div>

      <form onSubmit={handleSave} className="grid gap-6 lg:grid-cols-2">
        {/* Business info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Business Information</CardTitle>
            <CardDescription>
              Update your company details
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="company-name">Company Name</Label>
                <Input
                  id="company-name"
                  defaultValue="Sterlinglams Logistics"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="email">Business Email</Label>
                <Input
                  id="email"
                  type="email"
                  defaultValue="info@sterlinglams.com"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  defaultValue="+234 800 123 4567"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="address">Business Address</Label>
                <Textarea
                  id="address"
                  defaultValue="15 Broad Street, Lagos Island, Lagos, Nigeria"
                  rows={3}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Operations */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Operations Settings</CardTitle>
            <CardDescription>
              Configure delivery operations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="currency">Default Currency</Label>
                <Input id="currency" defaultValue="NGN (Nigerian Naira)" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="timezone">Timezone</Label>
                <Input id="timezone" defaultValue="Africa/Lagos (WAT)" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="dispatch-limit">
                  Max Orders per Driver
                </Label>
                <Input id="dispatch-limit" type="number" defaultValue="5" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="notification-email">
                  Notification Email
                </Label>
                <Input
                  id="notification-email"
                  type="email"
                  defaultValue="dispatch@sterlinglams.com"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Save */}
        <div className="lg:col-span-2">
          <Button type="submit" className="w-full sm:w-auto">
            <Save className="mr-2 size-4" />
            {saved ? "Saved!" : "Save Settings"}
          </Button>
        </div>
      </form>
    </div>
  )
}

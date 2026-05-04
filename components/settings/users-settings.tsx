"use client"

import { useEffect, useState } from "react"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Loader2, Trash2, UserPlus, Shield, User } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { doc, getDoc, setDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { toast } from "@/hooks/use-toast"

interface AdminUser {
  email: string
  name: string
  role: "owner" | "admin" | "viewer"
  addedAt: string
}

interface UsersSettings {
  users: AdminUser[]
}

const DEFAULT: UsersSettings = { users: [] }
const SETTINGS_DOC = "usersSettings"

const ROLE_LABELS: Record<AdminUser["role"], string> = {
  owner: "Owner",
  admin: "Admin",
  viewer: "Viewer",
}

const ROLE_BADGE_VARIANT: Record<AdminUser["role"], "default" | "secondary" | "outline"> = {
  owner: "default",
  admin: "secondary",
  viewer: "outline",
}

export function UsersSettingsPanel() {
  const [settings, setSettings] = useState<UsersSettings>(DEFAULT)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showInvite, setShowInvite] = useState(false)
  const [inviteName, setInviteName] = useState("")
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState<AdminUser["role"]>("admin")

  useEffect(() => {
    async function load() {
      try {
        const snap = await getDoc(doc(db, "settings", SETTINGS_DOC))
        if (snap.exists()) {
          setSettings({ ...DEFAULT, ...snap.data() } as UsersSettings)
        }
      } catch (err) {
        console.error("Failed to load users settings:", err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  async function save(updated: UsersSettings) {
    setSaving(true)
    try {
      await setDoc(doc(db, "settings", SETTINGS_DOC), updated)
      setSettings(updated)
      toast({ title: "Saved", description: "Team settings updated." })
    } catch (err) {
      console.error("Failed to save users settings:", err)
      toast({ title: "Error", description: "Failed to save settings.", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  function handleInvite() {
    const email = inviteEmail.trim().toLowerCase()
    const name = inviteName.trim()
    if (!email || !name) {
      toast({ title: "Missing fields", description: "Name and email are required.", variant: "destructive" })
      return
    }
    if (settings.users.some((u) => u.email === email)) {
      toast({ title: "Already exists", description: "A user with that email is already listed.", variant: "destructive" })
      return
    }
    const newUser: AdminUser = { email, name, role: inviteRole, addedAt: new Date().toISOString() }
    const updated: UsersSettings = { users: [...settings.users, newUser] }
    save(updated)
    setInviteName("")
    setInviteEmail("")
    setInviteRole("admin")
    setShowInvite(false)
  }

  function handleRemove(email: string) {
    const updated: UsersSettings = { users: settings.users.filter((u) => u.email !== email) }
    save(updated)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Users &amp; team</h2>
          <p className="text-sm text-muted-foreground">
            Manage admin access to the dashboard
          </p>
        </div>
        <Button onClick={() => setShowInvite(true)} size="sm">
          <UserPlus className="mr-2 size-4" />
          Invite user
        </Button>
      </div>

      {/* User list */}
      {settings.users.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No team members added yet. Invite someone to get started.
        </div>
      ) : (
        <ul className="divide-y rounded-lg border">
          {settings.users.map((user) => (
            <li key={user.email} className="flex items-center gap-4 px-4 py-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
                {user.role === "owner" ? (
                  <Shield className="size-4 text-muted-foreground" />
                ) : (
                  <User className="size-4 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{user.name}</p>
                <p className="truncate text-xs text-muted-foreground">{user.email}</p>
              </div>
              <Badge variant={ROLE_BADGE_VARIANT[user.role]}>{ROLE_LABELS[user.role]}</Badge>
              {user.role !== "owner" && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => handleRemove(user.email)}
                  disabled={saving}
                >
                  <Trash2 className="size-4" />
                  <span className="sr-only">Remove user</span>
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Invite dialog */}
      <Dialog open={showInvite} onOpenChange={setShowInvite}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite team member</DialogTitle>
            <DialogDescription>
              Add a new admin user. They will need to sign in with the email below.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label htmlFor="invite-name">Full name</Label>
              <Input
                id="invite-name"
                placeholder="Jane Doe"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="invite-email">Email address</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="jane@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="invite-role">Role</Label>
              <select
                id="invite-role"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as AdminUser["role"])}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="admin">Admin — full access</option>
                <option value="viewer">Viewer — read-only</option>
              </select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInvite(false)}>Cancel</Button>
            <Button onClick={handleInvite} disabled={saving}>
              {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <UserPlus className="mr-2 size-4" />}
              Add user
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

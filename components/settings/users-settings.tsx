"use client"

import { useEffect, useState, useCallback } from "react"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Loader2, Trash2, UserPlus, Shield, User, MoreHorizontal,
  KeyRound, UserCog, UserX, UserCheck, RefreshCw,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "@/hooks/use-toast"
import { ROLES, INVITABLE_ROLES, type UserRole } from "@/lib/roles"
import { useAuth } from "@/components/auth-provider"
import { auth } from "@/lib/firebase"

interface TeamUser {
  uid: string
  email: string
  name: string
  role: UserRole
  disabled: boolean
  lastSignInTime: string | null
  creationTime: string | null
}

function RoleBadge({ role }: { role: UserRole }) {
  const def = ROLES[role] ?? ROLES.viewer
  return <Badge variant={def.badge}>{def.label}</Badge>
}

function formatDate(iso: string | null) {
  if (!iso) return "Never"
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  })
}

async function apiFetch(url: string, opts?: RequestInit) {
  const token = await auth?.currentUser?.getIdToken()
  return fetch(url, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...opts?.headers,
    },
  })
}

export function UsersSettingsPanel() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState<TeamUser[]>([])
  const [loading, setLoading] = useState(true)
  const [showInvite, setShowInvite] = useState(false)
  const [inviting, setInviting] = useState(false)
  const [inviteName, setInviteName] = useState("")
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState<UserRole>("dispatcher")

  // Manage dialog state
  const [managingUser, setManagingUser] = useState<TeamUser | null>(null)
  const [showManage, setShowManage] = useState(false)
  const [newRole, setNewRole] = useState<UserRole>("dispatcher")
  const [actionLoading, setActionLoading] = useState(false)

  const loadUsers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiFetch("/api/admin/users")
      if (!res.ok) throw new Error("Failed")
      const data = await res.json()
      setUsers(data.users ?? [])
    } catch {
      toast({ title: "Error", description: "Could not load team members.", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadUsers() }, [loadUsers])

  async function handleInvite() {
    const email = inviteEmail.trim().toLowerCase()
    const name = inviteName.trim()
    if (!email || !name) {
      toast({ title: "Missing fields", description: "Name and email are required.", variant: "destructive" })
      return
    }
    setInviting(true)
    try {
      const res = await apiFetch("/api/admin/users", {
        method: "POST",
        body: JSON.stringify({ email, name, role: inviteRole }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: "Failed to invite", description: data.error ?? "Unknown error", variant: "destructive" })
        return
      }
      toast({ title: "Invited!", description: `${name} will receive an email to set their password.` })
      setShowInvite(false)
      setInviteName("")
      setInviteEmail("")
      setInviteRole("dispatcher")
      loadUsers()
    } catch {
      toast({ title: "Error", description: "Failed to send invite.", variant: "destructive" })
    } finally {
      setInviting(false)
    }
  }

  function openManage(user: TeamUser) {
    setManagingUser(user)
    setNewRole(user.role)
    setShowManage(true)
  }

  async function handleUpdateRole() {
    if (!managingUser) return
    setActionLoading(true)
    try {
      const res = await apiFetch(`/api/admin/users/${managingUser.uid}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "update_role", role: newRole }),
      })
      if (!res.ok) {
        const d = await res.json()
        toast({ title: "Error", description: d.error, variant: "destructive" })
        return
      }
      toast({ title: "Role updated", description: `${managingUser.name}'s role is now ${ROLES[newRole].label}.` })
      setShowManage(false)
      loadUsers()
    } catch {
      toast({ title: "Error", description: "Failed to update role.", variant: "destructive" })
    } finally {
      setActionLoading(false)
    }
  }

  async function handleResetPassword(user: TeamUser) {
    setActionLoading(true)
    try {
      const res = await apiFetch(`/api/admin/users/${user.uid}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "reset_password" }),
      })
      if (!res.ok) {
        const d = await res.json()
        toast({ title: "Error", description: d.error, variant: "destructive" })
        return
      }
      toast({ title: "Password reset sent", description: `A reset email has been sent to ${user.email}.` })
    } catch {
      toast({ title: "Error", description: "Failed to send reset email.", variant: "destructive" })
    } finally {
      setActionLoading(false)
    }
  }

  async function handleToggleDisabled(user: TeamUser) {
    setActionLoading(true)
    try {
      const res = await apiFetch(`/api/admin/users/${user.uid}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "toggle_disabled" }),
      })
      if (!res.ok) {
        const d = await res.json()
        toast({ title: "Error", description: d.error, variant: "destructive" })
        return
      }
      const action = user.disabled ? "enabled" : "disabled"
      toast({ title: `Account ${action}`, description: `${user.name}'s account has been ${action}.` })
      loadUsers()
    } catch {
      toast({ title: "Error", description: "Failed to update account status.", variant: "destructive" })
    } finally {
      setActionLoading(false)
    }
  }

  async function handleDelete(user: TeamUser) {
    if (!confirm(`Remove ${user.name} from the team? This cannot be undone.`)) return
    setActionLoading(true)
    try {
      const res = await apiFetch(`/api/admin/users/${user.uid}`, { method: "DELETE" })
      if (!res.ok) {
        const d = await res.json()
        toast({ title: "Error", description: d.error, variant: "destructive" })
        return
      }
      toast({ title: "User removed", description: `${user.name} has been removed from the team.` })
      setShowManage(false)
      loadUsers()
    } catch {
      toast({ title: "Error", description: "Failed to remove user.", variant: "destructive" })
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="space-y-8 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Users &amp; team</h2>
          <p className="text-sm text-muted-foreground">
            Manage dashboard access. Invited users receive an email to set their password.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={loadUsers} disabled={loading} title="Refresh">
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button onClick={() => setShowInvite(true)} size="sm">
            <UserPlus className="mr-2 size-4" />
            Invite user
          </Button>
        </div>
      </div>

      {/* Role legend */}
      <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Available roles</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {(Object.entries(ROLES) as [UserRole, typeof ROLES[UserRole]][]).map(([key, def]) => (
            <div key={key} className="flex items-start gap-2">
              <Badge variant={def.badge} className="mt-0.5 shrink-0">{def.label}</Badge>
              <p className="text-xs text-muted-foreground">{def.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* User list */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : users.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No team members added yet. Invite someone to get started.
        </div>
      ) : (
        <ul className="divide-y rounded-lg border">
          {users.map((user) => (
            <li
              key={user.uid}
              className={`flex items-center gap-4 px-4 py-3 ${user.disabled ? "opacity-60" : ""}`}
            >
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
                {user.role === "owner" ? (
                  <Shield className="size-4 text-muted-foreground" />
                ) : (
                  <User className="size-4 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium">{user.name}</p>
                  {user.disabled && (
                    <Badge variant="outline" className="text-xs text-muted-foreground">Disabled</Badge>
                  )}
                  {user.uid === currentUser?.uid && (
                    <Badge variant="outline" className="text-xs">You</Badge>
                  )}
                </div>
                <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                <p className="text-xs text-muted-foreground">
                  Last sign-in: {formatDate(user.lastSignInTime)}
                </p>
              </div>
              <RoleBadge role={user.role} />
              {user.uid !== currentUser?.uid && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground">
                      <MoreHorizontal className="size-4" />
                      <span className="sr-only">Manage {user.name}</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openManage(user)}>
                      <UserCog className="mr-2 size-4" />
                      Change role
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleResetPassword(user)}>
                      <KeyRound className="mr-2 size-4" />
                      Send password reset
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleToggleDisabled(user)}>
                      {user.disabled ? (
                        <><UserCheck className="mr-2 size-4" />Enable account</>
                      ) : (
                        <><UserX className="mr-2 size-4" />Disable account</>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => handleDelete(user)}
                    >
                      <Trash2 className="mr-2 size-4" />
                      Remove from team
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
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
              They will receive an email with a link to set their own password.
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
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as UserRole)}>
                <SelectTrigger id="invite-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INVITABLE_ROLES.map((role) => (
                    <SelectItem key={role} value={role}>
                      <div>
                        <p className="font-medium">{ROLES[role].label}</p>
                        <p className="text-xs text-muted-foreground">{ROLES[role].description}</p>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInvite(false)}>Cancel</Button>
            <Button onClick={handleInvite} disabled={inviting}>
              {inviting ? <Loader2 className="mr-2 size-4 animate-spin" /> : <UserPlus className="mr-2 size-4" />}
              Send invite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change role dialog */}
      <Dialog open={showManage} onOpenChange={setShowManage}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change role — {managingUser?.name}</DialogTitle>
            <DialogDescription>
              Select a new role for this team member. Changes take effect on their next sign-in.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Select value={newRole} onValueChange={(v) => setNewRole(v as UserRole)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INVITABLE_ROLES.map((role) => (
                  <SelectItem key={role} value={role}>
                    <div>
                      <p className="font-medium">{ROLES[role].label}</p>
                      <p className="text-xs text-muted-foreground">{ROLES[role].description}</p>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowManage(false)}>Cancel</Button>
            <Button onClick={handleUpdateRole} disabled={actionLoading || newRole === managingUser?.role}>
              {actionLoading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Update role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

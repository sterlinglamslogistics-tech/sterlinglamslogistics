export const ROLES = {
  owner: {
    label: "Owner",
    description: "Full access including user management and billing",
    badge: "default" as const,
  },
  admin: {
    label: "Admin",
    description: "Full operational access — orders, drivers, dispatch, and settings",
    badge: "secondary" as const,
  },
  dispatcher: {
    label: "Dispatcher",
    description: "Assign and manage orders, assign drivers, and update order statuses",
    badge: "outline" as const,
  },
  operations_manager: {
    label: "Operations Manager",
    description: "Manage orders, routes, and drivers; view all reports",
    badge: "outline" as const,
  },
  accountant: {
    label: "Accountant",
    description: "View financial reports and order summaries — no operational changes",
    badge: "outline" as const,
  },
  viewer: {
    label: "Viewer",
    description: "Read-only access to the dashboard",
    badge: "outline" as const,
  },
} as const

export type UserRole = keyof typeof ROLES

export const ALL_ROLES = Object.keys(ROLES) as UserRole[]

/** Roles that can be assigned when inviting a new team member (owners are set manually). */
export const INVITABLE_ROLES: UserRole[] = [
  "admin",
  "dispatcher",
  "operations_manager",
  "accountant",
  "viewer",
]

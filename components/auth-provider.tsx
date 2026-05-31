"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { onAuthStateChanged, signOut, type User } from "firebase/auth"
import { auth } from "@/lib/firebase"
import type { UserRole } from "@/lib/roles"

interface AuthContextValue {
  user: User | null
  role: UserRole | null
  loading: boolean
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  role: null,
  loading: true,
  logout: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [role, setRole] = useState<UserRole | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!auth) {
      setLoading(false)
      return
    }
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Force refresh so latest custom claims (role) are available
        const result = await firebaseUser.getIdTokenResult(true)
        const claims = result.claims as Record<string, unknown>
        // If no role claim but user has admin:true (legacy accounts), default to owner
        const resolvedRole =
          (claims.role as UserRole) ??
          (claims.admin === true ? "owner" : null)
        setRole(resolvedRole)
      } else {
        setRole(null)
      }
      setUser(firebaseUser)
      setLoading(false)
    })
    return unsubscribe
  }, [])

  async function logout() {
    if (auth) await signOut(auth)
    setUser(null)
    setRole(null)
  }

  return (
    <AuthContext.Provider value={{ user, role, loading, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}

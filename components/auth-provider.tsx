"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { onAuthStateChanged, signOut, type User } from "firebase/auth"
import { auth } from "@/lib/firebase"

interface AuthContextValue {
  user: User | null
  loading: boolean
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  logout: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!auth) {
      setLoading(false)
      return
    }
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Force token refresh so custom claims (e.g. admin) are available
        await firebaseUser.getIdToken(true)
      }
      setUser(firebaseUser)
      setLoading(false)
    })
    return unsubscribe
  }, [])

  async function logout() {
    if (auth) await signOut(auth)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}

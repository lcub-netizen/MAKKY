import { createContext, useContext, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'

export type AuthUser = {id: string; email: string}

type AuthContextValue = {
  user: AuthUser | null
  loading: boolean
  signIn: (email: string, password: string, createAccount: boolean) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

async function responseError(response: Response) {
  const body = await response.json().catch(() => null)
  return body?.detail ?? `Request failed (${response.status})`
}

export function AuthProvider({children}: {children: React.ReactNode}) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    const restore = async () => {
      try {
        let response = await fetch('/auth/me', {credentials: 'include'})
        if (response.status === 401) {
          const refreshed = await fetch('/auth/refresh', {method: 'POST', credentials: 'include'})
          if (refreshed.ok) response = await fetch('/auth/me', {credentials: 'include'})
        }
        if (active && response.ok) setUser(await response.json())
      } catch {
        if (active) setUser(null)
      } finally {
        if (active) setLoading(false)
      }
    }
    void restore()
    return () => { active = false }
  }, [])

  const signIn = async (email: string, password: string, createAccount: boolean) => {
    const response = await fetch(createAccount ? '/auth/register' : '/auth/login', {
      method: 'POST',
      credentials: 'include',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({email, password}),
    })
    if (!response.ok) throw new Error(await responseError(response))
    setUser(await response.json())
  }

  const signOut = async () => {
    await fetch('/auth/logout', {method: 'POST', credentials: 'include'})
    setUser(null)
  }

  return <AuthContext.Provider value={{user, loading, signIn, signOut}}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}

export function ProtectedRoute({children}: {children: React.ReactNode}) {
  const {user, loading} = useAuth()
  if (loading) return <div className="min-h-screen grid place-items-center text-sm text-gray-400">Restoring session…</div>
  return user ? children : <Navigate to="/login" replace />
}
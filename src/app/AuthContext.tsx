/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { PIN_USERS } from '../config/pins'
import type { AppUser } from '../types/auth'

type AuthContextValue = {
  user: AppUser | null
  isAuthenticated: boolean
  loginWithPin: (pin: string) => Promise<boolean>
  logout: () => Promise<void>
}

const USER_STORAGE_KEY = 'fourk.auth.user'
const AuthContext = createContext<AuthContextValue | null>(null)

const readStoredUser = (): AppUser | null => {
  const raw = window.localStorage.getItem(USER_STORAGE_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as AppUser
    if (!parsed?.id || !parsed?.pin || !parsed?.name || !parsed?.role) return null
    return parsed
  } catch {
    return null
  }
}

const writeStoredUser = (user: AppUser | null) => {
  if (!user) {
    window.localStorage.removeItem(USER_STORAGE_KEY)
    return
  }
  window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user))
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AppUser | null>(readStoredUser)

  const loginWithPin = useCallback(async (pin: string) => {
    const matched = PIN_USERS.find((entry) => entry.pin === pin)
    if (!matched) return false

    setUser(matched)
    writeStoredUser(matched)
    return true
  }, [])

  const logout = useCallback(async () => {
    setUser(null)
    writeStoredUser(null)
  }, [])

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      loginWithPin,
      logout,
    }),
    [user, loginWithPin, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuthContext = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuthContext must be used within AuthProvider')
  }
  return context
}

/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { PIN_USERS } from '../config/pins'
import type { AppUser } from '../types/auth'
import { isSupabaseConfigured } from '../lib/supabase'
import {
  createActivityLogInSupabase,
  resolveActiveRestaurantIdFromSupabase,
} from '../lib/supabaseStore'

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

const logAuthEvent = async (user: AppUser, action: 'login' | 'logout') => {
  if (!isSupabaseConfigured) return
  try {
    const restaurantId = await resolveActiveRestaurantIdFromSupabase()
    if (!restaurantId) return

    await createActivityLogInSupabase(restaurantId, {
      actorPin: user.pin,
      actorName: user.name,
      actorRole: user.role,
      action,
      entityType: 'auth',
      entityId: user.pin,
      details: `${user.name} ${action}`,
    })
  } catch (error) {
    console.error(`Failed to log auth action ${action}.`, error)
  }
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AppUser | null>(readStoredUser)

  const loginWithPin = useCallback(async (pin: string) => {
    const matched = PIN_USERS.find((entry) => entry.pin === pin)
    if (!matched) return false

    setUser(matched)
    writeStoredUser(matched)
    await logAuthEvent(matched, 'login')
    return true
  }, [])

  const logout = useCallback(async () => {
    if (user) {
      await logAuthEvent(user, 'logout')
    }
    setUser(null)
    writeStoredUser(null)
  }, [user])

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

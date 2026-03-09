'use client'

import { User } from '@supabase/supabase-js'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

import { createClient } from '@/lib/supabase/client'
import { isPlaywrightSmokeClient } from '@/lib/testing/playwright-smoke'

type UserRole = 'user' | 'teacher' | 'moderator' | 'admin'

interface Profile {
  id: string
  role: UserRole
  username: string | null
  display_name: string | null
  avatar_url: string | null
  bio: string | null
  gender: string | null
  xp: number
  coins: number
  equipped_avatar_frame_id: string | null
  equipped_name_color_id: string | null
  created_at: string
}

interface AuthContextType {
  user: User | null
  profile: Profile | null
  loading: boolean
  isAdmin: boolean
  isModerator: boolean
  isTeacher: boolean
  canReview: boolean
  canExpertReview: boolean
  canDeleteComments: boolean
  canManageTags: boolean
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const smokeMode = isPlaywrightSmokeClient()
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [supabase] = useState(() => (smokeMode ? null : createClient()))
  const lastFetchedUserIdRef = useRef<string | null>(null)

  const fetchProfile = useCallback(async (userId: string) => {
    if (!supabase) {
      return null
    }

    const { data } = await supabase
      .from('profiles')
      .select('id, role, username, display_name, avatar_url, bio, gender, xp, coins, equipped_avatar_frame_id, equipped_name_color_id, created_at')
      .eq('id', userId)
      .single()

    return data as Profile | null
  }, [supabase])

  const refreshProfile = useCallback(async () => {
    if (!user || !supabase) {
      return
    }

    const profileData = await fetchProfile(user.id)
    setProfile(profileData)
  }, [fetchProfile, supabase, user])

  useEffect(() => {
    if (smokeMode || !supabase) {
      setLoading(false)
      return
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          const userId = session.user.id
          setUser(session.user)
          if (lastFetchedUserIdRef.current !== userId) {
            lastFetchedUserIdRef.current = userId
            const profileData = await fetchProfile(userId)
            setProfile(profileData)
          }
        } else {
          lastFetchedUserIdRef.current = null
          setUser(null)
          setProfile(null)
        }
        setLoading(false)
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [fetchProfile, smokeMode, supabase])

  const signOut = useCallback(async () => {
    try {
      if (supabase) {
        const signOutPromise = supabase.auth.signOut()
        const timeoutPromise = new Promise((resolve) => setTimeout(resolve, 500))
        await Promise.race([signOutPromise, timeoutPromise])
      }
    } catch (error) {
      console.error('Error signing out:', error)
    } finally {
      if (typeof window !== 'undefined') {
        Object.keys(localStorage).forEach((key) => {
          if (key.startsWith('sb-')) {
            localStorage.removeItem(key)
          }
        })

        document.cookie.split(';').forEach((cookie) => {
          const key = cookie.trim().split('=')[0]
          if (key.startsWith('sb-')) {
            document.cookie = `${key}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`
          }
        })
      }

      setUser(null)
      setProfile(null)
      window.location.href = '/'
    }
  }, [supabase])

  const isAdmin = profile?.role === 'admin'
  const isModerator = profile?.role === 'moderator'
  const isTeacher = profile?.role === 'teacher'
  const canReview = isAdmin || isModerator
  const canExpertReview = isAdmin || isTeacher
  const canDeleteComments = isAdmin || isModerator || isTeacher
  const canManageTags = isAdmin || isModerator

  const contextValue = useMemo(() => ({
    user,
    profile,
    loading,
    isAdmin,
    isModerator,
    isTeacher,
    canReview,
    canExpertReview,
    canDeleteComments,
    canManageTags,
    signOut,
    refreshProfile,
  }), [
    canDeleteComments,
    canExpertReview,
    canManageTags,
    canReview,
    isAdmin,
    isModerator,
    isTeacher,
    loading,
    profile,
    refreshProfile,
    signOut,
    user,
  ])

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

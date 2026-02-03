'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

type UserRole = 'user' | 'moderator' | 'admin'

interface Profile {
  id: string
  role: UserRole
  username: string | null
  display_name: string | null
  avatar_url: string | null
  xp: number
  created_at: string
}

interface AuthContextType {
  user: User | null
  profile: Profile | null
  loading: boolean
  isAdmin: boolean
  isModerator: boolean
  canReview: boolean
  canDeleteComments: boolean
  canManageTags: boolean
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('id, role, username, display_name, avatar_url, xp, created_at')
      .eq('id', userId)
      .single()

    return data as Profile | null
  }

  const refreshProfile = async () => {
    if (user) {
      const profileData = await fetchProfile(user.id)
      setProfile(profileData)
    }
  }

  useEffect(() => {
    // 获取当前登录用户
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      if (user) {
        const profileData = await fetchProfile(user.id)
        setProfile(profileData)
      }
      setLoading(false)
    }

    getUser()

    // 监听认证状态变化
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          // Only update if user ID changed or we don't have user yet
          // Actually, profile might need refresh if role changed etc, but simpler to just fetch
          setUser(session.user)
          const profileData = await fetchProfile(session.user.id)
          setProfile(profileData)
        } else {
          setUser(null)
          setProfile(null)
        }
        setLoading(false)
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const signOut = async () => {
    try {
      // 尝试调用 Supabase 退出登录，但限制等待时间，防止网络问题导致卡死
      const signOutPromise = supabase.auth.signOut()
      const timeoutPromise = new Promise(resolve => setTimeout(resolve, 500)) // 500ms 超时

      await Promise.race([signOutPromise, timeoutPromise])
    } catch (error) {
      console.error('Error signing out:', error)
    } finally {
      // 无论 Supabase 调用是否成功，都执行本地清理和跳转

      // 清除所有 Supabase 相关的 localStorage 数据
      if (typeof window !== 'undefined') {
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('sb-')) {
            localStorage.removeItem(key)
          }
        })

        // 尝试清除 Cookies (以 sb- 开头的)
        document.cookie.split(";").forEach((c) => {
          const key = c.trim().split("=")[0];
          if (key.startsWith("sb-")) {
            document.cookie = `${key}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
          }
        });
      }

      // 清除状态
      setUser(null)
      setProfile(null)

      // 刷新页面以确保所有状态被清除
      window.location.href = '/'
    }
  }

  const isAdmin = profile?.role === 'admin'
  const isModerator = profile?.role === 'moderator'
  const canReview = isAdmin || isModerator
  const canDeleteComments = isAdmin || isModerator
  const canManageTags = isAdmin || isModerator

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      loading,
      isAdmin,
      isModerator,
      canReview,
      canDeleteComments,
      canManageTags,
      signOut,
      refreshProfile,
    }}>
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

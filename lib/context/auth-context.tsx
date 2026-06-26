'use client'

import { User } from '@supabase/supabase-js'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

import { createClient } from '@/lib/supabase/client'
import { isPlaywrightSmokeClient } from '@/lib/testing/playwright-smoke'
import { logger } from '@/lib/logger'
import { toast } from '@/hooks/use-toast'

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
  equipped_theme_id: string | null
  birth_date: string | null
  created_at: string
  membership_tier: string
  membership_period: string
  membership_started_at: string | null
  membership_expires_at: string | null
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
  // 区分「主动登出」与「被远端 T 下线 / token 失效」：signOut 期间置 true，避免重复提示。
  const signingOutRef = useRef(false)
  // 记录上一次是否有已登录 user，用于检测「已登录 → 无 session」的被动登出转换。
  const hadUserRef = useRef(false)

  const fetchProfile = useCallback(async (userId: string) => {
    if (!supabase) {
      return null
    }

    const { data } = await supabase
      .from('profiles')
      .select('id, role, username, display_name, avatar_url, bio, gender, xp, coins, equipped_avatar_frame_id, equipped_name_color_id, equipped_theme_id, birth_date, created_at, membership_tier, membership_period, membership_started_at, membership_expires_at')
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

    // 注意：onAuthStateChange 的回调内部禁止直接 `await` Supabase 客户端调用。
    // GoTrue 派发回调时持有内部 `_acquireLock`，若回调中再触发 token 刷新（例如查询 profiles
    // 时发现 access_token 过期），刷新流程也要争抢同一把锁，会与 await 形成死锁，
    // 表现就是 `setLoading(false)` 永远不执行、骨架图一直转圈（典型场景：第二天打开页面
    // access_token 已过期）。
    // 因此这里同步处理 user/loading，把任何 Supabase 调用 defer 到下一个事件循环。
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (session?.user) {
          const sessionUser = session.user
          const userId = sessionUser.id
          setUser(sessionUser)
          hadUserRef.current = true

          if (lastFetchedUserIdRef.current !== userId) {
            lastFetchedUserIdRef.current = userId
            setTimeout(() => {
              // 切换到下一个 tick 后，GoTrue 的锁已释放，可以安全地查询 profile
              fetchProfile(userId)
                .then((profileData) => {
                  if (lastFetchedUserIdRef.current === userId) {
                    setProfile(profileData)
                  }
                })
                .catch((error) => {
                  logger.warn('Failed to load profile after auth change', { error })
                })
            }, 0)
          }
        } else {
          // 被动登出（在另一设备登录 / 账号被 T 下线 / token 失效）：
          // 此前确实登录过、且不是本端主动 signOut 触发时，给一次提示。
          if (hadUserRef.current && !signingOutRef.current) {
            toast({
              title: '登录已失效',
              description: '账号可能在其他设备登录，请重新登录。',
            })
          }
          hadUserRef.current = false
          lastFetchedUserIdRef.current = null
          setUser(null)
          setProfile(null)
        }
        // 同步置 false：UI 至少能拿到 user，避免长任务挂起 loading。
        setLoading(false)
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [fetchProfile, smokeMode, supabase])

  const signOut = useCallback(async () => {
    signingOutRef.current = true
    try {
      if (supabase) {
        const signOutPromise = supabase.auth.signOut()
        const timeoutPromise = new Promise((resolve) => setTimeout(resolve, 500))
        await Promise.race([signOutPromise, timeoutPromise])
      }
    } catch (error) {
      logger.error(error, { context: 'Error signing out' })
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
      hadUserRef.current = false
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

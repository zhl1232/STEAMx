'use client'
import Link from 'next/link'
import { useAuth } from '@/context/auth-context'
import { useProjects } from '@/context/project-context'
import { Button } from '@/components/ui/button'
import { ProjectCard } from '@/components/features/project-card'
import { EditProfileDialog } from '@/components/features/profile/edit-profile-dialog'
import { BadgeGalleryDialog } from '@/components/features/gamification/badge-gallery-dialog'
import { ProfileSkeleton } from '@/components/features/profile/profile-skeleton'
import { ProjectListSkeleton } from '@/components/features/profile/project-list-skeleton'
import { AvatarWithFrame } from '@/components/ui/avatar-with-frame'
import { Zap, Coins, ChevronRight } from 'lucide-react'
import { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useGamification, BADGES } from '@/context/gamification-context'
import { getBadgesForDisplay } from '@/lib/gamification/badges'
import { LevelProgress } from '@/components/features/gamification/level-progress'
import { LevelGuideDialog } from '@/components/features/gamification/level-guide-dialog'
import { createClient } from '@/lib/supabase/client'

import type { Project } from '@/lib/types'
import { mapProject, type DbProject } from '@/lib/mappers/project'
import { MobileProfilePage } from '@/components/profile/mobile-profile-page'
import React from 'react'
import { BadgeIcon } from "@/components/features/gamification/badge-icon"
import { cn } from '@/lib/utils'
import { getNameColorClassName } from '@/lib/shop/items'

export default function ProfilePage() {
  const { user, profile, loading: authLoading } = useAuth()
  const { likedProjects, completedProjects, collectedProjects, isLoading: projectsLoading } = useProjects()
  const [activeTab, setActiveTab] = useState<'my-projects' | 'liked' | 'collected' | 'completed'>('collected')
  const { unlockedBadges, userBadgeDetails, coins } = useGamification()
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  // 独立加载的项目列表
  const [myProjects, setMyProjects] = useState<Project[]>([])
  const [likedProjectsList, setLikedProjectsList] = useState<Project[]>([])
  const [collectedProjectsList, setCollectedProjectsList] = useState<Project[]>([])
  const [completedProjectsList, setCompletedProjectsList] = useState<Project[]>([])
  const [followerCount, setFollowerCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [isInitialLoad, setIsInitialLoad] = useState(true)

  // 使用 ref 追踪是否已经加载过，避免重复请求
  const hasLoadedRef = useRef(false)


  // 如果未登录，重定向到登录页
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login')
    }
  }, [user, authLoading, router])



  // 将 Set 转换为稳定的字符串作为依赖，避免引用变化导致的重复执行
  const likedIdsKey = React.useMemo(() => Array.from(likedProjects).sort().join(','), [likedProjects])
  const collectedIdsKey = React.useMemo(() => Array.from(collectedProjects).sort().join(','), [collectedProjects])
  const completedIdsKey = React.useMemo(() => Array.from(completedProjects).sort().join(','), [completedProjects])

  // 加载用户的项目数据
  useEffect(() => {
    // Wait for both user authentication and project context (interactions) to be ready
    if (!user || projectsLoading) return

    // 如果已经加载过且交互数据没有变化，跳过
    if (hasLoadedRef.current && !isInitialLoad) return

    const loadUserProjects = async () => {
      try {
        // 并行执行所有查询，提升性能
        const [myProjectsData, likedData, collectedData, completedData, followersData, followingData] = await Promise.all([
          // 查询用户发布的项目
          supabase
            .from('projects')
            .select('*')
            .eq('author_id', user.id)
            .order('created_at', { ascending: false })
            .then(({ data }) => data),

          // 查询用户点赞的项目
          likedProjects.size > 0
            ? supabase
              .from('projects')
              .select(`
                  *,
                  profiles:author_id (display_name)
                `)
              .in('id', Array.from(likedProjects))
              .order('created_at', { ascending: false })
              .then(({ data }) => data)
            : Promise.resolve(null),

          // 查询用户收藏的项目
          collectedProjects.size > 0
            ? supabase
              .from('projects')
              .select(`
                  *,
                  profiles:author_id (display_name)
                `)
              .in('id', Array.from(collectedProjects))
              .order('created_at', { ascending: false })
              .then(({ data }) => data)
            : Promise.resolve(null),

          // 查询用户完成的项目
          completedProjects.size > 0
            ? supabase
              .from('projects')
              .select(`
                  *,
                  profiles:author_id (display_name)
                `)
              .in('id', Array.from(completedProjects))
              .order('created_at', { ascending: false })
              .then(({ data }) => data)
            : Promise.resolve(null),

          // 查询粉丝数
          supabase
            .from('follows')
            .select('follower_id', { count: 'exact', head: true })
            .eq('following_id', user.id)
            .then(({ count }) => count),

          // 查询关注数
          supabase
            .from('follows')
            .select('following_id', { count: 'exact', head: true })
            .eq('follower_id', user.id)
            .then(({ count }) => count)
        ])

        // 使用统一的映射函数处理数据
        if (myProjectsData) {
          setMyProjects(myProjectsData.map(p => mapProject(p as DbProject, profile?.display_name || undefined)))
        }
        
        setFollowerCount(followersData || 0)
        setFollowingCount(followingData || 0)

        if (likedData) {
          setLikedProjectsList(likedData.map((p) => mapProject(p as DbProject)))
        } else {
          setLikedProjectsList([])
        }

        if (collectedData) {
          setCollectedProjectsList(collectedData.map((p) => mapProject(p as DbProject)))
        } else {
          setCollectedProjectsList([])
        }

        if (completedData) {
          setCompletedProjectsList(completedData.map((p) => mapProject(p as DbProject)))
        } else {
          setCompletedProjectsList([])
        }

        // 标记已加载完成
        hasLoadedRef.current = true
      } catch (err) {
        console.error('Exception in loadUserProjects:', err)
      } finally {
        setIsInitialLoad(false)
      }
    }

    loadUserProjects()
    // likedIdsKey/collectedIdsKey/completedIdsKey 为 Set 内容的稳定表示，避免 Set 引用变化导致重复执行
  }, [user, supabase, likedProjects, collectedProjects, completedProjects, likedIdsKey, collectedIdsKey, completedIdsKey, profile?.display_name, projectsLoading, isInitialLoad])


  if (authLoading) {
    return <ProfileSkeleton />
  }

  if (!user) {
    return null
  }

  // 获取用户信息
  const userName = profile?.display_name || user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || '未命名用户'
  const userAvatar = profile?.avatar_url || user.user_metadata?.avatar_url || null


  return (
    <>
        <div className="md:hidden">
            <MobileProfilePage 
                user={user}
                profile={profile}
                myProjects={myProjects}
                likedProjectsList={likedProjectsList}
                collectedProjectsList={collectedProjectsList}
                completedProjectsList={completedProjectsList}
                followerCount={followerCount}
                followingCount={followingCount}
            />
        </div>

        <div className="hidden md:block container mx-auto py-8 px-4 max-w-7xl">
      <div className="flex gap-8 items-start">
        {/* ===== 左栏：身份卡片 ===== */}
        <div className="w-[320px] shrink-0 sticky top-24">
          <div className="bg-card rounded-2xl border shadow-sm overflow-hidden">
            {/* 顶部装饰渐变条 */}
            <div className="h-20 bg-gradient-to-r from-primary/80 via-primary/60 to-secondary/70 relative">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.15),transparent_70%)]" />
            </div>

            {/* 头像 - 上移与渐变条交叉 */}
            <div className="px-6 -mt-12">
              <div className="relative inline-block group">
                <AvatarWithFrame
                  src={userAvatar}
                  alt={userName}
                  fallback={userName[0]?.toUpperCase()}
                  avatarFrameId={profile?.equipped_avatar_frame_id}
                  className="h-24 w-24 shrink-0 border-4 border-card shadow-xl transition-transform duration-300 group-hover:scale-105"
                  avatarClassName="rounded-full object-cover bg-gradient-to-tr from-primary to-secondary"
                />
                <div className="absolute bottom-1 right-1 h-4 w-4 rounded-full bg-green-500 border-2 border-card ring-2 ring-green-500/20" title="在线" />
              </div>
            </div>

            {/* 用户名 + 等级 */}
            <div className="px-6 pt-3 pb-2">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className={cn("text-xl font-bold tracking-tight", getNameColorClassName(profile?.equipped_name_color_id ?? null) || "text-foreground")}>{userName}</h1>
                <div className="flex items-center gap-0.5 bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-2 py-0.5 rounded-full text-[10px] font-bold shadow-sm uppercase tracking-wider select-none">
                  <Zap className="h-3 w-3 fill-current" />
                  Lv.{Math.floor(Math.sqrt((profile?.xp || 0) / 100)) + 1}
                </div>
              </div>
            </div>

            {/* 徽章展示 */}
            <div className="px-6 pb-4">
              <BadgeGalleryDialog badges={BADGES} unlockedBadges={unlockedBadges} userBadgeDetails={userBadgeDetails}>
                <div className="flex -space-x-1.5 cursor-pointer hover:opacity-90 transition-opacity">
                  {(unlockedBadges.size > 0 ? getBadgesForDisplay(BADGES, unlockedBadges, 5) : BADGES.slice(0, 5)).map((b) => (
                    <BadgeIcon
                      key={b.id}
                      icon={b.icon}
                      tier={b.tier}
                      size="sm"
                      className="w-7 h-7"
                      showGlow={false}
                      locked={!unlockedBadges.has(b.id)}
                    />
                  ))}
                </div>
              </BadgeGalleryDialog>
            </div>

            {/* 简介 */}
            <div className="px-6 pb-4">
              {profile?.bio ? (
                <p className="text-sm text-foreground/80 leading-relaxed break-words">{profile.bio}</p>
              ) : (
                <p className="text-sm text-muted-foreground italic">这个人很懒，什么都没写~</p>
              )}
            </div>

            {/* 硬币展示 */}
            <div className="px-6 mb-4">
               <Link href="/coins" className="group block">
                <div className="bg-gradient-to-r from-amber-50/80 to-amber-100/50 dark:from-amber-950/30 dark:to-amber-900/10 border border-amber-200/60 dark:border-amber-800/30 rounded-xl p-3 flex items-center justify-between group-hover:border-amber-300 dark:group-hover:border-amber-700 transition-colors">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform">
                      <Coins className="h-4 w-4" />
                    </div>
                    <span className="text-sm font-medium text-amber-900/80 dark:text-amber-100/80">我的硬币</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-lg font-bold text-amber-600 dark:text-amber-400 tabular-nums tracking-tight">
                      {coins.toLocaleString()}
                    </span>
                    <ChevronRight className="h-4 w-4 text-amber-400/70 opacity-0 -ml-2 group-hover:opacity-100 group-hover:ml-0 transition-all" />
                  </div>
                </div>
               </Link>
            </div>

            {/* 统计数据 - 2x2 网格 */}
            <div className="mx-6 mb-4 grid grid-cols-2 gap-px bg-border/50 rounded-xl overflow-hidden border border-border/50">
              <div className="bg-card flex flex-col items-center py-3.5 hover:bg-muted/40 transition-colors cursor-default">
                <span className="text-lg font-bold text-foreground tabular-nums leading-none">{followerCount}</span>
                <span className="text-[11px] text-muted-foreground font-medium mt-1">粉丝</span>
              </div>
              <div className="bg-card flex flex-col items-center py-3.5 hover:bg-muted/40 transition-colors cursor-default">
                <span className="text-lg font-bold text-foreground tabular-nums leading-none">{followingCount}</span>
                <span className="text-[11px] text-muted-foreground font-medium mt-1">关注</span>
              </div>
              <div className="bg-card flex flex-col items-center py-3.5 hover:bg-muted/40 transition-colors cursor-default">
                <span className="text-lg font-bold text-foreground tabular-nums leading-none">{myProjects.reduce((acc, p) => acc + p.likes, 0)}</span>
                <span className="text-[11px] text-muted-foreground font-medium mt-1">获赞</span>
              </div>
              <div className="bg-card flex flex-col items-center py-3.5 hover:bg-muted/40 transition-colors cursor-default">
                <span className="text-lg font-bold text-foreground tabular-nums leading-none">{myProjects.length}</span>
                <span className="text-[11px] text-muted-foreground font-medium mt-1">作品</span>
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="px-6 pb-6">
              <EditProfileDialog>
                <Button variant="outline" className="w-full gap-2 shadow-sm hover:bg-muted/80">
                  编辑资料
                </Button>
              </EditProfileDialog>
            </div>
          </div>
        </div>

        {/* ===== 右栏：主内容区 ===== */}
        <div className="flex-1 min-w-0">
          {/* 等级进度卡片 */}
          <div className="bg-card rounded-2xl border shadow-sm p-6 mb-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-muted-foreground">当前等级进度</span>
              <LevelGuideDialog>
                <button className="text-xs text-primary hover:text-primary/80 transition-colors hover:underline flex items-center gap-1">
                  如何快速升级?
                </button>
              </LevelGuideDialog>
            </div>
            <LevelProgress className="w-full" />
          </div>

          {/* 标签页切换 */}
          <div className="flex gap-1 mb-6 border-b overflow-x-auto pb-0 scrollbar-none">
            <Button
              variant={activeTab === 'my-projects' ? 'default' : 'ghost'}
              onClick={() => setActiveTab('my-projects')}
              className="rounded-b-none whitespace-nowrap flex-shrink-0 px-5"
            >
              我的发布 ({myProjects.length})
            </Button>
            <Button
              variant={activeTab === 'collected' ? 'default' : 'ghost'}
              onClick={() => setActiveTab('collected')}
              className="rounded-b-none whitespace-nowrap flex-shrink-0 px-5"
            >
              我的收藏 ({collectedProjects.size})
            </Button>
            <Button
              variant={activeTab === 'liked' ? 'default' : 'ghost'}
              onClick={() => setActiveTab('liked')}
              className="rounded-b-none whitespace-nowrap flex-shrink-0 px-5"
            >
              我点赞的 ({likedProjects.size})
            </Button>
            <Button
              variant={activeTab === 'completed' ? 'default' : 'ghost'}
              onClick={() => setActiveTab('completed')}
              className="rounded-b-none whitespace-nowrap flex-shrink-0 px-5"
            >
              我做过的 ({completedProjects.size})
            </Button>
          </div>

          {/* 项目列表 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
            {isInitialLoad ||
              (activeTab === 'my-projects' && isInitialLoad) ||
              (activeTab === 'collected' && collectedProjects.size > 0 && collectedProjectsList.length === 0) ||
              (activeTab === 'liked' && likedProjects.size > 0 && likedProjectsList.length === 0) ||
              (activeTab === 'completed' && completedProjects.size > 0 && completedProjectsList.length === 0) ? (
              <ProjectListSkeleton />
            ) : (
              <>
                {activeTab === 'my-projects' && myProjects.length === 0 && (
                  <div className="col-span-full text-center py-16 text-muted-foreground">
                    <p className="mb-4">你还没有发布任何项目</p>
                    <Link href="/share">
                      <Button>分享你的第一个项目</Button>
                    </Link>
                  </div>
                )}
                {activeTab === 'my-projects' &&
                  myProjects.map((project) => <ProjectCard key={project.id} project={project} showStatus={true} />)}

                {activeTab === 'collected' && collectedProjectsList.length === 0 && (
                  <div className="col-span-full text-center py-16 text-muted-foreground">
                    <p className="mb-4">你还没有收藏任何项目</p>
                    <Link href="/explore">
                      <Button>去发现有趣的项目</Button>
                    </Link>
                  </div>
                )}
                {activeTab === 'collected' &&
                  collectedProjectsList.map((project) => <ProjectCard key={project.id} project={project} />)}

                {activeTab === 'liked' && likedProjectsList.length === 0 && (
                  <div className="col-span-full text-center py-16 text-muted-foreground">
                    <p className="mb-4">你还没有点赞任何项目</p>
                    <Link href="/explore">
                      <Button>去发现有趣的项目</Button>
                    </Link>
                  </div>
                )}
                {activeTab === 'liked' &&
                  likedProjectsList.map((project) => <ProjectCard key={project.id} project={project} />)}

                {activeTab === 'completed' && completedProjectsList.length === 0 && (
                  <div className="col-span-full text-center py-16 text-muted-foreground">
                    <p className="mb-4">你还没有完成任何项目</p>
                    <Link href="/explore">
                      <Button>开始你的第一个项目</Button>
                    </Link>
                  </div>
                )}
                {activeTab === 'completed' &&
                  completedProjectsList.map((project) => <ProjectCard key={project.id} project={project} />)}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
    </>
  )
}

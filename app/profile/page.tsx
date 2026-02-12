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
import { Zap, Sparkles } from 'lucide-react'
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
import { BadgeIcon } from "@/components/features/gamification/badge-icon";
import { cn } from "@/lib/utils";

export default function ProfilePage() {
  const { user, profile, loading: authLoading } = useAuth()
  const { likedProjects, completedProjects, collectedProjects, isLoading: projectsLoading } = useProjects()
  const [activeTab, setActiveTab] = useState<'my-projects' | 'liked' | 'collected' | 'completed'>('collected')
  const { unlockedBadges, userBadgeDetails } = useGamification()
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
  const userEmail = user.email || ''

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

        <div className="hidden md:block container mx-auto py-8 px-4 max-w-6xl">
      {/* 用户信息区：头像左 + 粉丝/关注/获赞/作品 横向 + 编辑资料（参考图布局） */}
      <div className="bg-gradient-to-br from-primary/10 via-secondary/10 to-background rounded-2xl p-8 mb-6 border">
        <div className="flex gap-8 items-start">
          <div className="relative shrink-0">
            <AvatarWithFrame
              src={userAvatar}
              alt={userName}
              fallback={userName[0]?.toUpperCase()}
              avatarFrameId={profile?.equipped_avatar_frame_id}
              className="h-24 w-24 shrink-0 border-4 border-background shadow-lg"
              avatarClassName="rounded-full object-cover bg-gradient-to-tr from-primary to-secondary"
            />
            <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-green-500 border-2 border-background" title="在线" />
          </div>
          <div className="flex flex-col justify-center gap-4 min-w-0 flex-1">
            <div className="flex items-stretch divide-x divide-border">
              <div className="flex flex-col items-center justify-center px-5 py-1 min-w-[4.5rem]">
                <span className="text-xl font-bold text-foreground tabular-nums">{followerCount}</span>
                <span className="text-xs text-muted-foreground mt-1">粉丝</span>
              </div>
              <div className="flex flex-col items-center justify-center px-5 py-1 min-w-[4.5rem]">
                <span className="text-xl font-bold text-foreground tabular-nums">{followingCount}</span>
                <span className="text-xs text-muted-foreground mt-1">关注</span>
              </div>
              <div className="flex flex-col items-center justify-center px-5 py-1 min-w-[4.5rem]">
                <span className="text-xl font-bold text-foreground tabular-nums">{myProjects.reduce((acc, p) => acc + p.likes, 0)}</span>
                <span className="text-xs text-muted-foreground mt-1">获赞</span>
              </div>
              <div className="flex flex-col items-center justify-center px-5 py-1 min-w-[4.5rem]">
                <span className="text-xl font-bold text-foreground tabular-nums">{myProjects.length}</span>
                <span className="text-xs text-muted-foreground mt-1">作品</span>
              </div>
            </div>
            <EditProfileDialog>
              <Button variant="outline" size="sm" className="rounded-lg border-primary/50 text-primary hover:bg-primary/10 w-fit px-5 font-medium h-9">
                编辑资料
              </Button>
            </EditProfileDialog>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold text-foreground">{userName}</h1>
          <div className="flex items-center gap-1 bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-2 py-0.5 rounded-full text-xs font-bold shadow-sm">
            <Zap className="h-3 w-3 fill-current" />
            Lv.{Math.floor(Math.sqrt((profile?.xp || 0) / 100)) + 1}
          </div>
          <BadgeGalleryDialog badges={BADGES} unlockedBadges={unlockedBadges} userBadgeDetails={userBadgeDetails}>
            <div className="flex -space-x-1.5 cursor-pointer hover:opacity-80 transition-opacity">
              {(unlockedBadges.size > 0 ? getBadgesForDisplay(BADGES, unlockedBadges, 4) : BADGES.slice(0, 4)).map((b) => (
                <BadgeIcon key={b.id} icon={b.icon} tier={b.tier} size="sm" className="w-7 h-7 border-2 border-background" showGlow={false} locked={!unlockedBadges.has(b.id)} />
              ))}
            </div>
          </BadgeGalleryDialog>
        </div>
        <div className="mt-4">
          <LevelProgress className="max-w-xs" />
          <LevelGuideDialog>
            <button className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 mt-1">
              <Zap className="h-3 w-3" />
              如何快速升级？
            </button>
          </LevelGuideDialog>
        </div>
        {profile?.bio && <p className="text-sm text-muted-foreground mt-3 max-w-2xl">{profile.bio}</p>}
      </div>

      {/* 进入商店 */}
      <div className="mb-6">
        <Link href="/shop" className="inline-flex items-center gap-2 rounded-xl border border-dashed border-border bg-muted/30 px-4 py-3 text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors">
          <Sparkles className="h-5 w-5" />
          <span className="text-sm font-medium">进入商店</span>
        </Link>
      </div>

      {/* 标签页切换 */}
      <div className="flex gap-2 mb-6 border-b overflow-x-auto pb-1 scrollbar-none snap-x">
        <Button
          variant={activeTab === 'my-projects' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('my-projects')}
          className="rounded-b-none whitespace-nowrap flex-shrink-0 px-4 snap-start"
        >
          我的发布 ({myProjects.length})
        </Button>
        <Button
          variant={activeTab === 'collected' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('collected')}
          className="rounded-b-none whitespace-nowrap flex-shrink-0 px-4 snap-start"
        >
          我的收藏 ({collectedProjects.size})
        </Button>
        <Button
          variant={activeTab === 'liked' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('liked')}
          className="rounded-b-none whitespace-nowrap flex-shrink-0 px-4 snap-start"
        >
          我点赞的 ({likedProjects.size})
        </Button>
        <Button
          variant={activeTab === 'completed' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('completed')}
          className="rounded-b-none whitespace-nowrap flex-shrink-0 px-4 snap-start"
        >
          我做过的 ({completedProjects.size})
        </Button>
      </div>

      {/* 项目列表 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* 判断是否正在加载 */}
        {isInitialLoad ||
          (activeTab === 'my-projects' && isInitialLoad) ||
          (activeTab === 'collected' && collectedProjects.size > 0 && collectedProjectsList.length === 0) ||
          (activeTab === 'liked' && likedProjects.size > 0 && likedProjectsList.length === 0) ||
          (activeTab === 'completed' && completedProjects.size > 0 && completedProjectsList.length === 0) ? (
          <ProjectListSkeleton />
        ) : (
          <>
            {activeTab === 'my-projects' && myProjects.length === 0 && (
              <div className="col-span-full text-center py-12 text-muted-foreground">
                <p className="mb-4">你还没有发布任何项目</p>
                <Link href="/share">
                  <Button>分享你的第一个项目</Button>
                </Link>
              </div>
            )}
            {activeTab === 'my-projects' &&
              myProjects.map((project) => <ProjectCard key={project.id} project={project} showStatus={true} />)}

            {activeTab === 'collected' && collectedProjectsList.length === 0 && (
              <div className="col-span-full text-center py-12 text-muted-foreground">
                <p className="mb-4">你还没有收藏任何项目</p>
                <Link href="/explore">
                  <Button>去发现有趣的项目</Button>
                </Link>
              </div>
            )}
            {activeTab === 'collected' &&
              collectedProjectsList.map((project) => <ProjectCard key={project.id} project={project} />)}

            {activeTab === 'liked' && likedProjectsList.length === 0 && (
              <div className="col-span-full text-center py-12 text-muted-foreground">
                <p className="mb-4">你还没有点赞任何项目</p>
                <Link href="/explore">
                  <Button>去发现有趣的项目</Button>
                </Link>
              </div>
            )}
            {activeTab === 'liked' &&
              likedProjectsList.map((project) => <ProjectCard key={project.id} project={project} />)}

            {activeTab === 'completed' && completedProjectsList.length === 0 && (
              <div className="col-span-full text-center py-12 text-muted-foreground">
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
    </>
  )
}

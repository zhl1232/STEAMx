'use client'
import Link from 'next/link'
import Image from 'next/image'

import { useAuth } from '@/context/auth-context'
import { useProjects } from '@/context/project-context'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ProjectCard } from '@/components/features/project-card'
import { EditProfileDialog } from '@/components/features/profile/edit-profile-dialog'
import { BadgeGalleryDialog } from '@/components/features/gamification/badge-gallery-dialog'
import { ProfileSkeleton } from '@/components/features/profile/profile-skeleton'
import { ProjectListSkeleton } from '@/components/features/profile/project-list-skeleton'
import { Award, Zap } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useGamification, BADGES } from '@/context/gamification-context'
import { LevelProgress } from '@/components/features/gamification/level-progress'
import { LevelGuideDialog } from '@/components/features/gamification/level-guide-dialog'
import { createClient } from '@/lib/supabase/client'
import type { Project } from '@/lib/types'
import { mapProject } from '@/lib/mappers/project'

export default function ProfilePage() {
  const { user, profile, loading: authLoading } = useAuth()
  const { likedProjects, completedProjects, collectedProjects } = useProjects()
  const [activeTab, setActiveTab] = useState<'my-projects' | 'liked' | 'collected' | 'completed'>('collected')
  const { unlockedBadges } = useGamification()
  const router = useRouter()
  const supabase = createClient()

  // 独立加载的项目列表
  const [myProjects, setMyProjects] = useState<Project[]>([])
  const [likedProjectsList, setLikedProjectsList] = useState<Project[]>([])
  const [collectedProjectsList, setCollectedProjectsList] = useState<Project[]>([])
  const [completedProjectsList, setCompletedProjectsList] = useState<Project[]>([])
  const [isInitialLoad, setIsInitialLoad] = useState(true)

  // 如果未登录，重定向到登录页
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login')
    }
  }, [user, authLoading, router])

  // 加载用户的项目数据
  useEffect(() => {
    if (!user) return

    const loadUserProjects = async () => {
      try {
        // 并行执行所有查询，提升性能
        const [myProjectsData, likedData, collectedData, completedData] = await Promise.all([
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
            : Promise.resolve(null)
        ])

        // 使用统一的映射函数处理数据
        if (myProjectsData) {
          setMyProjects(myProjectsData.map(p => mapProject(p as any, profile?.display_name || undefined)))
        }

        if (likedData) {
          setLikedProjectsList(likedData.map((p: any) => mapProject(p)))
        } else {
          setLikedProjectsList([])
        }

        if (collectedData) {
          setCollectedProjectsList(collectedData.map((p: any) => mapProject(p)))
        } else {
          setCollectedProjectsList([])
        }

        if (completedData) {
          setCompletedProjectsList(completedData.map((p: any) => mapProject(p)))
        } else {
          setCompletedProjectsList([])
        }
      } catch (err) {
        console.error('Exception in loadUserProjects:', err)
      } finally {
        setIsInitialLoad(false)
      }
    }

    loadUserProjects()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, likedProjects, collectedProjects, completedProjects, profile?.display_name])


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
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      {/* 用户信息卡片 */}
      <div className="bg-gradient-to-br from-primary/10 via-secondary/10 to-background rounded-2xl p-8 mb-8 border">
        <div className="flex flex-col md:flex-row items-center gap-6">
          {/* 头像 */}
          <div className="relative">
            {userAvatar ? (
              <Image
                src={userAvatar}
                alt={userName}
                width={96}
                height={96}
                className="rounded-full border-4 border-background shadow-lg object-cover"
              />
            ) : (
              <div className="h-24 w-24 rounded-full bg-gradient-to-tr from-primary to-secondary flex items-center justify-center text-4xl font-bold text-primary-foreground shadow-lg">
                {userName[0].toUpperCase()}
              </div>
            )}
            <div className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full bg-green-500 border-4 border-background" title="在线" />
          </div>

          {/* 用户信息 */}
          <div className="flex-1 text-center md:text-left w-full">
            <div className="flex flex-col md:flex-row justify-between items-center md:items-start mb-4">
              <div>
                <h1 className="text-3xl font-bold mb-2">{userName}</h1>
                <p className="text-muted-foreground">{userEmail}</p>
              </div>
              <div className="w-full md:w-64 mt-4 md:mt-0">
                <LevelProgress />
                <div className="mt-2 flex justify-end">
                  <LevelGuideDialog>
                    <button className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">
                      <Zap className="h-3 w-3" />
                      如何快速升级？
                    </button>
                  </LevelGuideDialog>
                </div>
              </div>
            </div>
          </div>

          {/* 编辑按钮 */}
          <EditProfileDialog>
            <Button variant="outline">编辑资料</Button>
          </EditProfileDialog>
        </div>
      </div>

      {/* 统计仪表盘 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">已发布项目</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold">{myProjects.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">获赞总数</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold">
              {myProjects.reduce((acc, p) => acc + p.likes, 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">收藏项目</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold">{collectedProjects.size}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">已完成挑战</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold">{completedProjects.size}</div>
          </CardContent>
        </Card>
      </div>

      {/* 徽章展示 */}
      <div className="bg-card rounded-lg border p-6 mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Award className="h-5 w-5 text-primary" />
            我的成就徽章
            <span className="text-sm font-normal text-muted-foreground">
              ({unlockedBadges.size}/{BADGES.length})
            </span>
          </h2>
          <div className="md:hidden">
            {/* Mobile View: Simple link or button if needed, but Dialog covers it */}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {/* 只显示前 5 个已解锁的徽章，或者如果没有解锁的，显示前 5 个未解锁的 */}
          {(unlockedBadges.size > 0
            ? BADGES.filter(b => unlockedBadges.has(b.id)).slice(0, 5)
            : BADGES.slice(0, 5)
          ).map((badge) => {
            const isUnlocked = unlockedBadges.has(badge.id);
            return (
              <div
                key={badge.id}
                className={`p-4 rounded-lg border text-center transition-all ${isUnlocked
                  ? 'bg-gradient-to-br from-primary/5 to-secondary/5 border-primary/20 scale-100'
                  : 'bg-muted/30 opacity-50 grayscale'
                  }`}
              >
                <div className="text-3xl mb-2 flex justify-center">
                  {badge.icon}
                </div>
                <div className="font-medium text-sm mb-1">{badge.name}</div>
                <div className="text-xs text-muted-foreground line-clamp-1">{badge.description}</div>
              </div>
            )
          })}
        </div>

        <div className="mt-4 flex justify-center">
          <BadgeGalleryDialog badges={BADGES} unlockedBadges={unlockedBadges}>
            <Button variant="outline" className="w-full md:w-auto gap-2">
              查看全部徽章
              <span className="bg-muted px-2 py-0.5 rounded-full text-xs">
                {BADGES.length}
              </span>
            </Button>
          </BadgeGalleryDialog>
        </div>
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
  )
}

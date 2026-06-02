'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ChevronLeft, Heart } from 'lucide-react'

import { ProfileLikedProjectsSkeleton } from '@/components/features/profile/profile-liked-projects-skeleton'
import { ProjectCard } from '@/components/features/project-card'
import { Button } from '@/components/ui/button'
import { MobilePageHeader } from '@/components/ui/mobile-page-header'
import { logger } from '@/lib/logger'
import type { Project } from '@/lib/mappers/types'

export function ProfileLikedProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [totalProjects, setTotalProjects] = useState(0)
  const [totalLikesReceived, setTotalLikesReceived] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()

    const loadProjects = async () => {
      setIsLoading(true)

      try {
        const response = await fetch('/api/profile/likes-received', { signal: controller.signal })
        const payload = await response.json().catch(() => ({}))

        if (!response.ok) {
          throw new Error(payload?.error || '获赞详情加载失败')
        }

        if (controller.signal.aborted) return

        setProjects((payload?.projects as Project[]) || [])
        setTotalProjects(Number(payload?.totalProjects || 0))
        setTotalLikesReceived(Number(payload?.totalLikesReceived || 0))
      } catch (error) {
        if ((error as { name?: string }).name === 'AbortError') return
        logger.error('Failed to load likes received projects', { error })
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    void loadProjects()

    return () => controller.abort()
  }, [])

  if (isLoading) {
    return <ProfileLikedProjectsSkeleton />
  }

  return (
    <div className="page-shell pb-24 pt-6 md:py-8">
      <div className="md:hidden">
        <MobilePageHeader title="获赞" fallbackHref="/profile" />
      </div>

      <div className="space-y-6">
        <section className="surface-panel overflow-hidden">
          <div className="flex items-center gap-3 px-6 py-5">
            <Button asChild variant="ghost" size="icon" className="hidden h-10 w-10 rounded-sm md:inline-flex">
              <Link href="/profile" aria-label="返回个人主页">
                <ChevronLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-tight text-foreground">获赞</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                共收到 {totalLikesReceived} 个赞，分布在 {totalProjects} 个作品上
              </p>
            </div>
          </div>
        </section>

        {projects.length === 0 ? (
          <section className="surface-panel px-6 py-16 text-center">
            <Heart className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h2 className="mt-4 text-lg font-semibold text-foreground">还没有收到赞</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">先发布作品，后续这里会显示哪些作品带来了点赞。</p>
          </section>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} showStatus />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

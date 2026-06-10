"use client"

import Link from 'next/link'
import type { ComponentType } from 'react'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/context/auth-context'
import { createClient } from '@/lib/supabase/client'
import { AllProjectsManagement, type AdminProjectSummary } from '@/components/admin/all-projects-management'
import { ProjectReviewCard } from '@/components/admin/project-review-card'
import { CompletionReviewCard } from '@/components/admin/completion-review-card'
import { ChallengeSubmissionReviewCard } from '@/components/admin/challenge-submission-review-card'
import { ObservationReviewCard, type ObservationForReview } from '@/components/admin/observation-review-card'
import { ModeratorApplicationsList } from '@/components/admin/moderator-applications-list'
import { ReportsList } from '@/components/admin/reports-list'
import { ChallengeManagement } from '@/components/admin/challenge-management'
import { CourseManagement } from '@/components/admin/course-management'
import { ResourceManagement } from '@/components/admin/resource-management'
import { UserMembershipManagement } from '@/components/admin/user-membership-management'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MobilePageHeader } from '@/components/ui/mobile-page-header'
import { Button } from '@/components/ui/button'
import {
  Archive,
  CheckCircle2,
  FileClock,
  Flag,
  Leaf,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'

// ... Keep existing interfaces if needed, or refine ...
interface Project {
  id: number
  title: string
  description: string
  category: string
  image_url: string
  status: string
  created_at: string
  difficulty: string
  sub_category?: string
  project_steps: {
    id: number
    title: string
    description: string
    image_url: string | null
    sort_order: number
  }[]
  project_materials: {
    id: number
    material: string
    sort_order: number
  }[]
  profiles: {
    username: string
    display_name: string
    avatar_url: string
  }
}

interface CompletionForReview {
  id: number
  user_id: string
  project_id: number
  completed_at: string
  proof_images: string[]
  proof_captions: string[] | null
  proof_video_url: string | null
  notes: string | null
  status: string
  profiles: {
    display_name: string
    avatar_url: string | null
  } | null
  projects: {
    title: string
    category: string
  } | null
}

interface PendingCompletionRow {
  id: number
  user_id: string
  project_id: number
  completed_at: string
  proof_images: string[]
  proof_captions: string[] | null
  proof_video_url: string | null
  notes: string | null
  status: string
}

interface CompletionProfileRow {
  id: string
  display_name: string | null
  avatar_url: string | null
}

interface CompletionProjectRow {
  id: number
  title: string | null
  category: string | null
}

interface PendingObservationRow {
  id: number
  user_id: string
  observed_at: string
  created_at: string
  location_name: string
  habitat: string | null
  weather: string | null
  notes: string | null
  media_urls: string[]
  is_public: boolean
  status: string
  nature_topic: string | null
  lifecycle_stage: string | null
  sex: string | null
}

interface ChallengeSubmissionForReview {
  id: number
  challenge_id: number
  user_id: string
  title: string
  notes: string | null
  proof_images: string[]
  proof_captions: string[] | null
  proof_video_url: string | null
  is_public: boolean
  status: string
  challenges: {
    title: string
  } | null
  profiles: {
    display_name: string
    avatar_url: string | null
  } | null
  referenceProjects: {
    id: number
    title: string
  }[]
}

interface PendingChallengeSubmissionRow {
  id: number
  challenge_id: number
  user_id: string
  title: string
  notes: string | null
  proof_images: string[]
  proof_captions: string[] | null
  proof_video_url: string | null
  is_public: boolean
  status: string
}

interface AdminMetricCardProps {
  icon: ComponentType<{ className?: string }>
  label: string
  value: number
  helper: string
  tone: string
}

function AdminMetricCard({ icon: Icon, label, value, helper, tone }: AdminMetricCardProps) {
  return (
    <div className="surface-subtle flex min-w-0 items-center gap-3 rounded-lg border border-border/70 bg-background/78 p-4 shadow-none">
      <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-md ${tone}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-1 text-3xl font-black leading-none tabular-nums text-foreground">{value}</p>
        <p className="mt-1 truncate text-xs text-muted-foreground">{helper}</p>
      </div>
    </div>
  )
}

export default function AdminPage() {
  const { canReview, isAdmin, loading, profile } = useAuth()
  const [pendingProjects, setPendingProjects] = useState<Project[]>([])
  const [pendingCompletions, setPendingCompletions] = useState<CompletionForReview[]>([])
  const [pendingObservations, setPendingObservations] = useState<ObservationForReview[]>([])
  const [pendingChallengeSubmissions, setPendingChallengeSubmissions] = useState<ChallengeSubmissionForReview[]>([])
  const [allProjects, setAllProjects] = useState<AdminProjectSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [supabase] = useState(() => createClient())

  // Fetch pending projects for review
  const fetchPendingProjects = useCallback(async () => {
    // setIsLoading(true) // Don't trigger full page loader for this individual fetch if possible, or handle nicely
    const { data, error } = await supabase
      .from('projects')
      .select(`
        *,
        profiles:author_id (
          username,
          display_name,
          avatar_url
        ),
        project_steps (*),
        project_materials (*)
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (!error && data) {
      setPendingProjects(data as unknown as Project[])
    }
    // setIsLoading(false)
  }, [supabase])

  const fetchPendingCompletions = useCallback(async () => {
    const { data, error } = await supabase
      .from('completed_projects')
      .select(`
        id, user_id, project_id, completed_at,
        proof_images, proof_captions, proof_video_url,
        notes, status
      `)
      .eq('status', 'pending')
      .order('completed_at', { ascending: false })
      .limit(50)

    if (error) {
      console.error('Failed to fetch pending completions', error)
      return
    }

    const completionRows = (data || []) as PendingCompletionRow[]
    if (completionRows.length === 0) {
      setPendingCompletions([])
      return
    }

    const userIds = [...new Set(completionRows.map((row) => row.user_id))]
    const projectIds = [...new Set(completionRows.map((row) => row.project_id))]

    const [{ data: profilesData, error: profilesError }, { data: projectsData, error: projectsError }] =
      await Promise.all([
        supabase.from('profiles').select('id, display_name, avatar_url').in('id', userIds),
        supabase.from('projects').select('id, title, category').in('id', projectIds),
      ])

    if (profilesError) {
      console.error('Failed to fetch completion profiles', profilesError)
    }

    if (projectsError) {
      console.error('Failed to fetch completion projects', projectsError)
    }

    const profilesById = new Map(
      ((profilesData || []) as CompletionProfileRow[]).map((profile) => [
        profile.id,
        {
          display_name: profile.display_name ?? '未知用户',
          avatar_url: profile.avatar_url,
        },
      ]),
    )

    const projectsById = new Map(
      ((projectsData || []) as CompletionProjectRow[]).map((project) => [
        project.id,
        {
          title: project.title ?? '未知项目',
          category: project.category ?? '',
        },
      ]),
    )

    setPendingCompletions(
      completionRows.map((row) => ({
        ...row,
        profiles: profilesById.get(row.user_id) ?? null,
        projects: projectsById.get(row.project_id) ?? null,
      })),
    )
  }, [supabase])

  const fetchPendingObservations = useCallback(async () => {
    const { data, error } = await supabase
      .from('observation_events')
      .select(`
        id, user_id, observed_at, created_at, location_name,
        habitat, weather, notes, media_urls, is_public, status,
        nature_topic, lifecycle_stage, sex
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      console.error('Failed to fetch pending observations', error)
      return
    }

    const observationRows = (data || []) as PendingObservationRow[]
    if (observationRows.length === 0) {
      setPendingObservations([])
      return
    }

    const userIds = [...new Set(observationRows.map((row) => row.user_id))]
    const observationIds = observationRows.map((row) => row.id)

    const [{ data: profilesData, error: profilesError }, { data: speciesLinks, error: speciesLinksError }] =
      await Promise.all([
        supabase.from('profiles').select('id, display_name, avatar_url').in('id', userIds),
        supabase.from('observation_event_species').select('observation_event_id, species_id').in('observation_event_id', observationIds),
      ])

    if (profilesError) {
      console.error('Failed to fetch observation profiles', profilesError)
    }

    if (speciesLinksError) {
      console.error('Failed to fetch observation species links', speciesLinksError)
    }

    const speciesIds = [...new Set(((speciesLinks || []) as { species_id: number }[]).map((row) => row.species_id))]
    const { data: speciesData, error: speciesError } = speciesIds.length
      ? await supabase.from('species').select('id, common_name, scientific_name').in('id', speciesIds)
      : { data: [] as { id: number; common_name: string | null; scientific_name: string | null }[], error: null }

    if (speciesError) {
      console.error('Failed to fetch observation species', speciesError)
    }

    const profilesById = new Map(
      ((profilesData || []) as CompletionProfileRow[]).map((profile) => [
        profile.id,
        {
          display_name: profile.display_name ?? '未知用户',
          avatar_url: profile.avatar_url,
        },
      ]),
    )
    const speciesById = new Map(
      ((speciesData || []) as { id: number; common_name: string | null; scientific_name: string | null }[]).map((species) => [
        species.id,
        {
          id: species.id,
          common_name: species.common_name ?? '未知物种',
          scientific_name: species.scientific_name,
        },
      ]),
    )
    const speciesByObservationId = new Map<number, ObservationForReview['species']>()

    for (const row of ((speciesLinks || []) as { observation_event_id: number; species_id: number }[])) {
      const species = speciesById.get(row.species_id)
      if (!species) continue
      const current = speciesByObservationId.get(row.observation_event_id) || []
      current.push(species)
      speciesByObservationId.set(row.observation_event_id, current)
    }

    setPendingObservations(
      observationRows.map((row) => ({
        ...row,
        profiles: profilesById.get(row.user_id) ?? null,
        species: speciesByObservationId.get(row.id) ?? [],
      })),
    )
  }, [supabase])

  const fetchPendingChallengeSubmissions = useCallback(async () => {
    const { data, error } = await supabase
      .from('challenge_submissions')
      .select('id, challenge_id, user_id, title, notes, proof_images, proof_captions, proof_video_url, is_public, status')
      .eq('status', 'pending')
      .order('updated_at', { ascending: false })

    if (error) {
      console.error('Failed to fetch pending challenge submissions', error)
      return
    }

    const submissionRows = (data || []) as PendingChallengeSubmissionRow[]
    if (submissionRows.length === 0) {
      setPendingChallengeSubmissions([])
      return
    }

    const userIds = [...new Set(submissionRows.map((row) => row.user_id))]
    const challengeIds = [...new Set(submissionRows.map((row) => row.challenge_id))]
    const submissionIds = submissionRows.map((row) => row.id)

    const [
      { data: profilesData },
      { data: challengesData },
      { data: referenceLinks },
    ] = await Promise.all([
      supabase.from('profiles').select('id, display_name, avatar_url').in('id', userIds),
      supabase.from('challenges').select('id, title').in('id', challengeIds),
      supabase.from('challenge_submission_projects').select('submission_id, project_id, sort_order').in('submission_id', submissionIds),
    ])

    const referenceProjectIds = [...new Set(((referenceLinks || []) as { project_id: number }[]).map((row) => row.project_id))]
    const { data: projectsData } = referenceProjectIds.length
      ? await supabase.from('projects').select('id, title').in('id', referenceProjectIds)
      : { data: [] as { id: number; title: string }[] }

    const profilesById = new Map(
      ((profilesData || []) as CompletionProfileRow[]).map((profile) => [
        profile.id,
        {
          display_name: profile.display_name ?? '未知用户',
          avatar_url: profile.avatar_url,
        },
      ]),
    )
    const challengesById = new Map(
      ((challengesData || []) as { id: number; title: string | null }[]).map((challenge) => [
        challenge.id,
        { title: challenge.title ?? '未知挑战' },
      ]),
    )
    const projectsById = new Map(
      ((projectsData || []) as { id: number; title: string | null }[]).map((project) => [
        project.id,
        { id: project.id, title: project.title ?? '未知项目' },
      ]),
    )
    const referencesBySubmissionId = new Map<number, { id: number; title: string }[]>()

    for (const row of ((referenceLinks || []) as { submission_id: number; project_id: number; sort_order: number }[]).sort((a, b) => a.sort_order - b.sort_order)) {
      const project = projectsById.get(row.project_id)
      if (!project) continue
      const current = referencesBySubmissionId.get(row.submission_id) || []
      current.push(project)
      referencesBySubmissionId.set(row.submission_id, current)
    }

    setPendingChallengeSubmissions(
      submissionRows.map((row) => ({
        ...row,
        profiles: profilesById.get(row.user_id) ?? null,
        challenges: challengesById.get(row.challenge_id) ?? null,
        referenceProjects: referencesBySubmissionId.get(row.id) ?? [],
      })),
    )
  }, [supabase])

  // Fetch all projects for management
  const fetchAllProjects = useCallback(async () => {
    const { data, error } = await supabase
      .from('projects')
      .select(`
        id,
        title,
        description,
        category,
        image_url,
        status,
        created_at,
        profiles:author_id (
          username,
          display_name,
          avatar_url
        )
      `)
      .order('created_at', { ascending: false })
      .limit(50)

    if (!error && data) {
      setAllProjects(data as unknown as AdminProjectSummary[])
    }
  }, [supabase])

  const loadData = useCallback(async () => {
    setIsLoading(true)
    await Promise.all([
      fetchPendingProjects(),
      fetchPendingCompletions(),
      fetchPendingObservations(),
      fetchPendingChallengeSubmissions(),
      fetchAllProjects(),
    ])
    setIsLoading(false)
  }, [fetchPendingProjects, fetchPendingCompletions, fetchPendingObservations, fetchPendingChallengeSubmissions, fetchAllProjects])

  useEffect(() => {
    if (!loading && canReview) {
      loadData()
    }
  }, [loading, canReview, loadData])


  if (loading || isLoading) {
    return (
      <div className="page-shell py-8">
        <section className="surface-panel px-6 py-12 text-center">
          <p className="text-center">加载中...</p>
        </section>
      </div>
    )
  }

  if (!canReview) {
    return null
  }

  const normalizedQuery = query.trim().toLowerCase()
  const filterText = (...parts: Array<string | number | null | undefined>) =>
    !normalizedQuery || parts.filter(Boolean).join(' ').toLowerCase().includes(normalizedQuery)
  const visiblePendingProjects = pendingProjects.filter((project) =>
    filterText(
      project.title,
      project.description,
      project.category,
      project.sub_category,
      project.profiles.display_name,
      project.profiles.username,
      project.id,
    ),
  )
  const visiblePendingCompletions = pendingCompletions.filter((completion) =>
    filterText(
      completion.projects?.title,
      completion.projects?.category,
      completion.profiles?.display_name,
      completion.notes,
      completion.id,
    ),
  )
  const visiblePendingObservations = pendingObservations.filter((observation) =>
    filterText(
      observation.location_name,
      observation.nature_topic,
      observation.profiles?.display_name,
      observation.notes,
      observation.species.map((species) => species.common_name).join(' '),
      observation.id,
    ),
  )
  const visiblePendingChallengeSubmissions = pendingChallengeSubmissions.filter((submission) =>
    filterText(
      submission.title,
      submission.challenges?.title,
      submission.profiles?.display_name,
      submission.notes,
      submission.id,
    ),
  )
  const visibleAllProjects = allProjects.filter((project) =>
    filterText(
      project.title,
      project.description,
      project.category,
      project.status,
      project.profiles?.display_name,
      project.profiles?.username,
      project.id,
    ),
  )
  const adminName = profile?.display_name || profile?.username || '管理员'
  const roleLabel = isAdmin ? '超级管理员' : '审核员'
  const todayLabel = new Date().toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'long',
  })

  return (
    <div className="page-shell pt-6 pb-24 md:py-8">
      <div className="md:hidden">
        <MobilePageHeader title="管理员控制台" fallbackHref="/profile" />
      </div>

      <section className="surface-panel overflow-hidden px-5 py-6 sm:px-7 sm:py-7 lg:px-8">
        <div className="mb-7 overflow-hidden rounded-[var(--radius-lg)] border border-[hsl(var(--brand-blue)/0.18)] bg-[linear-gradient(135deg,hsl(var(--surface-raised)/0.95),hsl(var(--brand-blue)/0.08))] p-4 shadow-[0_22px_62px_-48px_hsl(var(--surface-shadow)/0.48)] sm:p-5 lg:p-6">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div className="flex min-w-0 items-center gap-4">
              <Avatar className="h-16 w-16 shrink-0 border-4 border-background shadow-sm sm:h-20 sm:w-20">
                <AvatarImage src={profile?.avatar_url || undefined} />
                <AvatarFallback className="bg-[hsl(var(--brand-blue)/0.12)] text-lg font-bold text-[hsl(var(--brand-blue))]">
                  {adminName.slice(0, 1)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="section-kicker">后台管理</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <h1 className="truncate text-3xl font-semibold tracking-tight">{adminName}</h1>
                  <span className="inline-flex items-center gap-1 rounded-sm bg-[hsl(var(--brand-blue)/0.12)] px-2.5 py-1 text-xs font-semibold text-[hsl(var(--brand-blue))]">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    {roleLabel}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">
                  今天是 {todayLabel}，请优先处理待审核内容与风险反馈。
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 lg:justify-end">
              <Button asChild variant="outline">
                <Link href="/settings/security">
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  安全中心
                </Link>
              </Button>
              <Button variant="outline" onClick={() => void loadData()}>
                <RefreshCw className="mr-2 h-4 w-4" />
                刷新队列
              </Button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <AdminMetricCard
              icon={FileClock}
              label="待审核项目"
              value={pendingProjects.length}
              helper={visiblePendingProjects.length !== pendingProjects.length ? `当前筛选 ${visiblePendingProjects.length}` : '项目发布队列'}
              tone="bg-blue-100 text-blue-700 dark:bg-blue-400/10 dark:text-blue-300"
            />
            <AdminMetricCard
              icon={Archive}
              label="探索记录"
              value={pendingCompletions.length}
              helper="完成证明队列"
              tone="bg-emerald-100 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300"
            />
            <AdminMetricCard
              icon={Leaf}
              label="自然观察"
              value={pendingObservations.length}
              helper="观察记录队列"
              tone="bg-teal-100 text-teal-700 dark:bg-teal-400/10 dark:text-teal-300"
            />
            <AdminMetricCard
              icon={Sparkles}
              label="挑战作品"
              value={pendingChallengeSubmissions.length}
              helper="挑战提交队列"
              tone="bg-amber-100 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300"
            />
            <AdminMetricCard
              icon={Flag}
              label="项目总览"
              value={allProjects.length}
              helper="最近 50 个项目"
              tone="bg-rose-100 text-rose-700 dark:bg-rose-400/10 dark:text-rose-300"
            />
          </div>
        </div>

        <Tabs defaultValue="pending" className="space-y-6">
          <TabsList className="segmented-control h-auto flex-wrap justify-start rounded-[var(--radius-lg)] bg-transparent p-1">
            <TabsTrigger value="pending" className="segmented-option rounded-full data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-sm">待审核项目 ({pendingProjects.length})</TabsTrigger>
            <TabsTrigger value="pending-completions" className="segmented-option rounded-full data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-sm">探索记录审核 ({pendingCompletions.length})</TabsTrigger>
            <TabsTrigger value="pending-observations" className="segmented-option rounded-full data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-sm">自然观察审核 ({pendingObservations.length})</TabsTrigger>
            <TabsTrigger value="pending-challenge-submissions" className="segmented-option rounded-full data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-sm">待审核挑战作品 ({pendingChallengeSubmissions.length})</TabsTrigger>
            <TabsTrigger value="reports" className="segmented-option rounded-full data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-sm">举报管理</TabsTrigger>
            <TabsTrigger value="projects" className="segmented-option rounded-full data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-sm">所有项目</TabsTrigger>
            {isAdmin && <TabsTrigger value="applications" className="segmented-option rounded-full data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-sm">审核员申请</TabsTrigger>}
            <TabsTrigger value="challenges" className="segmented-option rounded-full data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-sm">挑战</TabsTrigger>
            <TabsTrigger value="courses" className="segmented-option rounded-full data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-sm">训练营</TabsTrigger>
            <TabsTrigger value="resources" className="segmented-option rounded-full data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-sm">资料卡</TabsTrigger>
            <TabsTrigger value="tags" className="segmented-option rounded-full data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-sm">标签管理</TabsTrigger>
            <TabsTrigger value="users" className="segmented-option rounded-full data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-sm">用户管理</TabsTrigger>
          </TabsList>

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索标题、提交者、分类或 ID"
                className="control-field h-12 w-full rounded-md bg-[hsl(var(--surface-raised)/0.9)] pl-11 pr-4 text-sm"
              />
            </label>
            <div className="flex items-center gap-2 rounded-md border border-border/70 bg-background/70 px-4 py-3 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-[hsl(var(--brand-green))]" />
              最新提交优先
            </div>
          </div>

          <TabsContent value="pending" className="space-y-4">
            {visiblePendingProjects.length === 0 ? (
              <Card className="surface-subtle shadow-none">
                <CardContent className="py-8 text-center">
                  <p className="text-muted-foreground">{query ? '当前筛选下暂无待审核项目' : '暂无待审核项目'}</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {visiblePendingProjects.map((project) => (
                  <ProjectReviewCard
                    key={project.id}
                    project={project}
                    onReview={loadData}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="pending-completions" className="space-y-4">
            {visiblePendingCompletions.length === 0 ? (
              <Card className="surface-subtle shadow-none">
                <CardContent className="py-8 text-center">
                  <p className="text-muted-foreground">{query ? '当前筛选下暂无待审核作品' : '暂无待审核作品'}</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {visiblePendingCompletions.map((completion) => (
                  <CompletionReviewCard
                    key={completion.id}
                    completion={completion}
                    onReview={loadData}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="pending-observations" className="space-y-4">
            {visiblePendingObservations.length === 0 ? (
              <Card className="surface-subtle shadow-none">
                <CardContent className="py-8 text-center">
                  <p className="text-muted-foreground">{query ? '当前筛选下暂无待审核自然观察' : '暂无待审核自然观察'}</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {visiblePendingObservations.map((observation) => (
                  <ObservationReviewCard
                    key={observation.id}
                    observation={observation}
                    onReview={loadData}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="pending-challenge-submissions" className="space-y-4">
            {visiblePendingChallengeSubmissions.length === 0 ? (
              <Card className="surface-subtle shadow-none">
                <CardContent className="py-8 text-center">
                  <p className="text-muted-foreground">{query ? '当前筛选下暂无待审核挑战作品' : '暂无待审核挑战作品'}</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {visiblePendingChallengeSubmissions.map((submission) => (
                  <ChallengeSubmissionReviewCard
                    key={submission.id}
                    submission={submission}
                    onReview={loadData}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="reports" className="space-y-4">
            <ReportsList />
          </TabsContent>

          <TabsContent value="projects" className="space-y-4">
            <AllProjectsManagement projects={visibleAllProjects} />
          </TabsContent>

          {isAdmin && (
            <TabsContent value="applications" className="space-y-4">
              <ModeratorApplicationsList />
            </TabsContent>
          )}

          <TabsContent value="challenges" className="space-y-4">
            <ChallengeManagement />
          </TabsContent>

          <TabsContent value="courses" className="space-y-4">
            <CourseManagement />
          </TabsContent>

          <TabsContent value="resources" className="space-y-4">
            <ResourceManagement />
          </TabsContent>

          <TabsContent value="tags" className="space-y-4">
            <Card className="surface-subtle shadow-none">
              <CardHeader>
                <CardTitle>标签管理</CardTitle>
                <CardDescription>创建和管理项目标签</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">标签管理功能开发中...</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users" className="space-y-4">
            <UserMembershipManagement />
          </TabsContent>
        </Tabs>
      </section>
    </div>
  )
}

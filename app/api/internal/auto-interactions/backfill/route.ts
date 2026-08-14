import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { handleApiError } from '@/lib/api/auth'
import { enqueueAutoInteractionsForTarget } from '@/lib/auto-interactions'
import { logger } from '@/lib/logger'
import { supabaseAdmin } from '@/lib/supabase/admin'

const BackfillBodySchema = z.object({
  targetType: z.literal('project').default('project'),
  dryRun: z.boolean().default(true),
  limit: z.number().int().min(1).max(500).default(50),
  scanLimit: z.number().int().min(1).max(2000).optional(),
  sampleRate: z.number().min(0).max(1).default(0.25),
  likeRate: z.number().min(0).max(1).default(0.5),
  collectionRate: z.number().min(0).max(1).default(0.2),
})

type ProjectCandidate = {
  id: number
  title?: string | null
  author_id?: string | null
}

function verifyInternalAuth(request: NextRequest) {
  const secret = process.env.CRON_SECRET || process.env.INTERNAL_API_SECRET
  if (!secret) return false

  const auth = request.headers.get('authorization')
  return auth === `Bearer ${secret}`
}

function getAdminClient() {
  if (!supabaseAdmin) {
    throw new Error('supabaseAdmin not configured')
  }
  return supabaseAdmin
}

/**
 * POST /api/internal/auto-interactions/backfill
 * One-off helper for queuing delayed automatic interactions for historical approved projects.
 */
export async function POST(request: NextRequest) {
  if (!verifyInternalAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const parsed = BackfillBodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid backfill request', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const options = parsed.data
    const supabase = getAdminClient()
    const scanLimit = options.scanLimit ?? Math.min(2000, Math.max(options.limit * 5, options.limit))

    const { data: projectRows, error: projectsError } = await supabase
      .from('projects')
      .select('id, title, author_id')
      .eq('status', 'approved')
      .eq('moderation_state', 'approved')
      .not('author_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(scanLimit)

    if (projectsError) throw projectsError

    const projects = (projectRows || []) as ProjectCandidate[]
    const projectIds = projects.map((project) => Number(project.id)).filter(Number.isFinite)
    const authorIds = [...new Set(projects.map((project) => project.author_id).filter(Boolean) as string[])]

    const [{ data: jobRows, error: jobsError }, { data: autoAuthorRows, error: authorsError }] = await Promise.all([
      projectIds.length > 0
        ? supabase
            .from('auto_interaction_jobs')
            .select('target_id')
            .eq('target_type', options.targetType)
            .in('target_id', projectIds)
        : Promise.resolve({ data: [], error: null }),
      authorIds.length > 0
        ? supabase
            .from('profiles')
            .select('id')
            .eq('is_auto_interaction_account', true)
            .in('id', authorIds)
        : Promise.resolve({ data: [], error: null }),
    ])

    if (jobsError) throw jobsError
    if (authorsError) throw authorsError

    const existingTargets = new Set((jobRows || []).map((row) => Number((row as { target_id: number }).target_id)))
    const autoAuthorIds = new Set((autoAuthorRows || []).map((row) => (row as { id: string }).id))
    const eligibleProjects = projects.filter((project) => {
      const projectId = Number(project.id)
      return (
        Number.isFinite(projectId) &&
        !existingTargets.has(projectId) &&
        Boolean(project.author_id) &&
        !autoAuthorIds.has(project.author_id as string)
      )
    })

    const selectedProjects = eligibleProjects
      .filter(() => options.sampleRate >= 1 || Math.random() < options.sampleRate)
      .slice(0, options.limit)

    if (options.dryRun) {
      return NextResponse.json({
        dryRun: true,
        targetType: options.targetType,
        scanned: projects.length,
        alreadyQueued: existingTargets.size,
        eligible: eligibleProjects.length,
        selected: selectedProjects.length,
        rates: {
          sampleRate: options.sampleRate,
          likeRate: options.likeRate,
          collectionRate: options.collectionRate,
        },
        projects: selectedProjects.map((project) => ({ id: project.id, title: project.title })),
      })
    }

    let queuedJobs = 0
    let skippedTargets = 0
    let errors = 0
    const results: Array<{
      projectId: number
      title?: string | null
      queued?: number
      skipped?: string
      error?: string
    }> = []

    for (const project of selectedProjects) {
      try {
        const result = await enqueueAutoInteractionsForTarget(options.targetType, Number(project.id), {
          likeRate: options.likeRate,
          collectionRate: options.collectionRate,
        })
        queuedJobs += result.queued
        if ('skipped' in result) skippedTargets += 1
        results.push({ projectId: project.id, title: project.title, ...result })
      } catch (error) {
        errors += 1
        const message = error instanceof Error ? error.message : String(error)
        logger.error(error, {
          context: 'POST /api/internal/auto-interactions/backfill item failed',
          projectId: project.id,
        })
        results.push({ projectId: project.id, title: project.title, error: message })
      }
    }

    return NextResponse.json({
      dryRun: false,
      targetType: options.targetType,
      scanned: projects.length,
      alreadyQueued: existingTargets.size,
      eligible: eligibleProjects.length,
      selected: selectedProjects.length,
      queuedJobs,
      skippedTargets,
      errors,
      rates: {
        sampleRate: options.sampleRate,
        likeRate: options.likeRate,
        collectionRate: options.collectionRate,
      },
      results,
    })
  } catch (error) {
    logger.error(error, { context: 'POST /api/internal/auto-interactions/backfill' })
    return handleApiError(error)
  }
}

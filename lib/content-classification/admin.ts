import type { SupabaseClient } from '@supabase/supabase-js'

import { buildClassificationCandidate } from './rules'
import { mapAdminClassification } from './mapping'
import type {
  ClassificationCandidate,
  ClassificationCandidateSource,
  ContentClassificationRow,
  ContentType,
} from './types'
import type { Database } from '@/lib/supabase/types'

export type AdminContentType = ContentType
export type AdminDbClient = SupabaseClient<Database>
export type AdminContentRow = Record<string, unknown>

export const ADMIN_CONTENT_TYPES: readonly AdminContentType[] = ['course', 'project', 'challenge']

export function isAdminContentType(value: string | null | undefined): value is AdminContentType {
  return Boolean(value && ADMIN_CONTENT_TYPES.includes(value as AdminContentType))
}

export function getAdminContentTypes(value: string | null | undefined): AdminContentType[] {
  if (!value || value === 'all') return [...ADMIN_CONTENT_TYPES]
  return isAdminContentType(value) ? [value] : []
}

function asRecord(value: unknown): AdminContentRow {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as AdminContentRow
    : {}
}

function asRecordArray(value: unknown): AdminContentRow[] {
  return Array.isArray(value) ? value.map(asRecord) : []
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

function nestedTextArray(value: unknown, key: string): string[] {
  return asRecordArray(value)
    .map((item) => item[key])
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
}

export function rowToCandidateSource(row: AdminContentRow): ClassificationCandidateSource {
  const projectMaterials = nestedTextArray(row.project_materials, 'material')
  const materials = projectMaterials.length > 0
    ? projectMaterials
    : asStringArray(row.materials)
  const projectSteps = asRecordArray(row.project_steps)
  const steps = projectSteps.length > 0
    ? projectSteps.map((step) => ({
        title: typeof step.title === 'string' ? step.title : null,
        description: typeof step.description === 'string' ? step.description : null,
      }))
    : asRecordArray(row.steps).map((step) => ({
        title: typeof step.title === 'string' ? step.title : null,
        description: typeof step.description === 'string' ? step.description : null,
      }))

  return {
    title: typeof row.title === 'string' ? row.title : null,
    description: typeof row.description === 'string' ? row.description : null,
    tags: asStringArray(row.tags),
    materials,
    scenario: typeof row.scenario === 'string' ? row.scenario : null,
    driving_question: typeof row.driving_question === 'string' ? row.driving_question : null,
    expected_outcome: typeof row.expected_outcome === 'string' ? row.expected_outcome : null,
    constraints: row.constraints,
    steps,
    resources: row.resources,
    stages: row.stages,
    project_materials: row.project_materials,
    project_steps: row.project_steps,
    course_lessons: row.course_lessons,
    difficultyStars: typeof row.difficulty_stars === 'number' ? row.difficulty_stars : null,
    difficulty: typeof row.difficulty === 'string' ? row.difficulty : null,
  }
}

export function buildAdminCandidate(row: AdminContentRow): ClassificationCandidate {
  return buildClassificationCandidate(rowToCandidateSource(row))
}

export function mapAdminRow(row: AdminContentRow) {
  return mapAdminClassification(row as unknown as ContentClassificationRow)
}

export function isPublishedAdminContent(type: AdminContentType, row: AdminContentRow): boolean {
  if (type === 'course') return row.status === 'approved'
  if (type === 'project') return row.status === 'approved' && row.moderation_state === 'approved'
  return row.status === 'active' || row.status === 'ended'
}

export async function loadAdminContentRow(
  client: AdminDbClient,
  type: AdminContentType,
  id: number,
  detail = false,
): Promise<{ data: AdminContentRow | null; error: unknown }> {
  if (type === 'course') {
    const result = detail
      ? await client.from('courses').select('*, course_lessons(*)').eq('id', id).maybeSingle()
      : await client.from('courses').select('*').eq('id', id).maybeSingle()
    return { data: result.data as unknown as AdminContentRow | null, error: result.error }
  }

  if (type === 'project') {
    const result = detail
      ? await client
          .from('projects')
          .select('*, project_materials(*), project_steps(*), profiles:author_id(display_name), sub_categories(name)')
          .eq('id', id)
          .maybeSingle()
      : await client.from('projects').select('*').eq('id', id).maybeSingle()
    return { data: result.data as unknown as AdminContentRow | null, error: result.error }
  }

  const result = await client.from('challenges').select('*').eq('id', id).maybeSingle()
  return { data: result.data as unknown as AdminContentRow | null, error: result.error }
}

export async function loadAdminQueueRows(
  client: AdminDbClient,
  type: AdminContentType,
  status: 'unreviewed' | 'reviewed' | 'all',
  limit: number,
): Promise<{ data: AdminContentRow[]; error: unknown }> {
  if (type === 'course') {
    const query = client
      .from('courses')
      .select('id,title,description,tags,status,updated_at,difficulty_stars,recommended_min_age,recommended_max_age,support_level,classification_status,classification_source,classification_reviewed_at,classification_reviewed_by,classification_revision,course_lessons(title)')
      .order('updated_at', { ascending: false })
      .limit(limit)
    if (status !== 'all') query.eq('classification_status', status)
    const result = await query
    return { data: (result.data ?? []) as unknown as AdminContentRow[], error: result.error }
  }

  if (type === 'project') {
    const query = client
      .from('projects')
      .select('id,title,description,tags,status,moderation_state,updated_at,difficulty_stars,recommended_min_age,recommended_max_age,support_level,classification_status,classification_source,classification_reviewed_at,classification_reviewed_by,classification_revision,project_materials(material),project_steps(title,description)')
      .order('updated_at', { ascending: false })
      .limit(limit)
    if (status !== 'all') query.eq('classification_status', status)
    const result = await query
    return { data: (result.data ?? []) as unknown as AdminContentRow[], error: result.error }
  }

  const query = client
    .from('challenges')
    .select('id,title,description,tags,scenario,driving_question,expected_outcome,constraints,status,created_at,difficulty_stars,recommended_min_age,recommended_max_age,support_level,classification_status,classification_source,classification_reviewed_at,classification_reviewed_by,classification_revision,stages,resources')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (status !== 'all') query.eq('classification_status', status)
  const result = await query
  return { data: (result.data ?? []) as unknown as AdminContentRow[], error: result.error }
}

export async function updateAdminDifficultyStars(
  client: AdminDbClient,
  type: AdminContentType,
  id: number,
  difficultyStars: number,
): Promise<{ error: unknown }> {
  const payload = { difficulty_stars: difficultyStars }
  if (type === 'course') {
    const result = await client.from('courses').update(payload).eq('id', id)
    return { error: result.error }
  }
  if (type === 'project') {
    const result = await client.from('projects').update(payload).eq('id', id)
    return { error: result.error }
  }
  const result = await client.from('challenges').update(payload).eq('id', id)
  return { error: result.error }
}

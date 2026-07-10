/**
 * 类型映射工具
 * 从数据库类型 (Database) 转换为前端友好的类型
 * 这是类型定义的单一来源 (Single Source of Truth)
 */

import type { Database } from '@/lib/supabase/types'
import type { NatureTopicKey } from '@/lib/config/nature-topics'
import type {
    PlantCultivationStatus,
    PlantLifeForm,
    PlantUseKey,
} from '@/lib/observations/plant-attributes'
import type { ObservationLifecycleStage, ObservationSex } from '@/lib/observations/traits'
import { formatRelativeTime } from '@/lib/date-utils'

export type { ObservationLifecycleStage, ObservationSex } from '@/lib/observations/traits'

// ============================================================
// 数据库表类型提取
// ============================================================

type DbProject = Database['public']['Tables']['projects']['Row']
type DbProfile = Database['public']['Tables']['profiles']['Row']
type _DbComment = Database['public']['Tables']['comments']['Row']
type DbDiscussion = Database['public']['Tables']['discussions']['Row']
type _DbDiscussionReply = Database['public']['Tables']['discussion_replies']['Row']
type DbChallenge = Database['public']['Tables']['challenges']['Row']
type DbProjectMaterial = Database['public']['Tables']['project_materials']['Row']
type DbProjectStep = Database['public']['Tables']['project_steps']['Row']
type DbSubCategory = Database['public']['Tables']['sub_categories']['Row']
type DbCompletedProject = Database['public']['Tables']['completed_projects']['Row']
type DbChallengeSubmission = Database['public']['Tables']['challenge_submissions']['Row']
type DbSpecies = Database['public']['Tables']['species']['Row']
type DbObservationEvent = Database['public']['Tables']['observation_events']['Row']
type DbObservationEventSpecies = Database['public']['Tables']['observation_event_species']['Row']

function normalizeTagList(tags?: string[] | null): string[] {
    return Array.from(
        new Set(
            (tags || [])
                .map((tag) => tag?.trim())
                .filter((tag): tag is string => Boolean(tag))
        )
    )
}

// 评论/回复的数据库查询结果类型（comments 或 discussion_replies 联表 profiles 后的形状）
export interface DbCommentWithProfile {
    id: number
    author_id: string
    content: string
    created_at: string
    updated_at?: string | null
    parent_id?: number | null
    likes_count?: number | null
    reply_to_user_id?: string | null
    reply_to_username?: string | null
    image_url?: string | null
    profiles?: {
        display_name?: string | null
        avatar_url?: string | null
        equipped_avatar_frame_id?: string | null
        equipped_name_color_id?: string | null
        role?: string | null
    } | null
}

/** observation_comments 联表 profiles 后的行，与 Comment 映射字段一致，另含 observation_event_id */
export type DbObservationCommentWithProfile = DbCommentWithProfile & {
    observation_event_id?: number
}

// 讨论详情联表 author 后的查询结果类型（不含 replies）
export type DbDiscussionWithProfile = DbDiscussion & {
    profiles?: Pick<DbProfile, 'display_name' | 'avatar_url' | 'equipped_avatar_frame_id'> & { equipped_name_color_id?: string | null } | null
}

// ============================================================
// 前端类型定义
// ============================================================

/**
 * 项目类型
 * 从数据库 projects 表映射而来
 */
export interface Project {
    id: string | number
    title: string
    author: string
    author_id: string
    image: string
    category: string
    sub_category_id?: number
    sub_category?: string // 子分类名称
    likes: number
    views_count?: number
    coins_count?: number
    comments_count?: number
    description?: string
    materials?: string[]
    steps?: ProjectStep[]
    comments?: Comment[]
    difficulty?: 'easy' | 'medium' | 'hard'
    difficulty_stars?: number  // 1-6 星
    tags?: string[]
    status?: 'draft' | 'pending' | 'approved' | 'rejected'
    rejection_reason?: string | null
    challenge_id?: number | null
    reflection?: string
    problem_statement?: string
    iterations?: Iteration[]
    steam_weights?: SteamWeights | null
}

/**
 * 项目步骤类型
 */
export interface ProjectStep {
    title: string
    description: string
    image_url?: string
}

/**
 * 回复目标，用于底部输入框切换"回复 @xxx"模式
 */
export interface ReplyTarget {
    id: number | string
    author: string
    userId?: string
}

/**
 * 评论类型
 */
export interface Comment {
    id: string | number
    author: string
    userId?: string
    avatar?: string
    avatarFrameId?: string | null
    nameColorId?: string | null
    role?: 'user' | 'teacher' | 'moderator' | 'admin'
    content: string
    /** 评论附图 URL（Lv.2+ 特权） */
    image_url?: string | null
    /** 点赞数 */
    likes_count?: number
    date: string
    /** ISO 时间字符串，用于排序（如按时间正序/倒序） */
    created_at?: string
    /** 编辑时间，非 null 表示已编辑 */
    updated_at?: string | null
    parent_id?: number | null
    reply_to_user_id?: string | null
    reply_to_username?: string | null
}

/**
 * 讨论类型
 */
export interface Discussion {
    id: string | number
    title: string
    author: string
    authorId: string
    authorAvatar?: string
    authorAvatarFrameId?: string | null
    authorNameColorId?: string | null
    content: string
    date: string
    replies: Comment[]
    likes: number
    tags: string[]
}

export type ChallengeType = 'timed' | 'evergreen'
export type ChallengeStatus = 'draft' | 'active' | 'ended' | 'archived'

export interface SteamWeights {
    S: number; T: number; E: number; A: number; M: number
}

/**
 * 挑战脚手架资源三分类：
 * - project：参考项目（站内项目教程，给灵感不要求照做）
 * - skill：前置技能（借用项目/技能课程课时，补一个具体薄弱点）
 * - reference：资料卡（链 /resources/[id]，过程中随查随用）
 */
export const CHALLENGE_RESOURCE_TYPES = ['project', 'skill', 'reference'] as const

export type ChallengeResourceType = (typeof CHALLENGE_RESOURCE_TYPES)[number]

export interface ChallengeResource {
    title: string
    url: string
    type: ChallengeResourceType
    /** 一句话说明该资源补什么能力 / 什么时候回来查 */
    description?: string
}

/** 旧 type 值归一化映射；不在映射内的（template/entry/internal 等 CTA 类）不属于学习资料，直接剔除 */
const LEGACY_RESOURCE_TYPE_MAP: Record<string, ChallengeResourceType> = {
    project: 'project',
    skill: 'skill',
    reference: 'reference',
    guide: 'reference',
    article: 'reference',
    video: 'reference',
    pdf: 'reference',
    link: 'reference',
}

/**
 * 归一化挑战 resources jsonb：兼容历史数据的混杂 type 值，
 * 收敛为 project / skill / reference 三分类，并剔除 CTA 型条目。
 */
export function normalizeChallengeResources(raw: unknown): ChallengeResource[] | undefined {
    if (!Array.isArray(raw)) return undefined

    const normalized: ChallengeResource[] = []

    for (const item of raw) {
        if (!item || typeof item !== 'object') continue
        const { title, url, type, description } = item as Record<string, unknown>
        if (typeof title !== 'string' || !title || typeof url !== 'string' || !url) continue

        const mappedType = LEGACY_RESOURCE_TYPE_MAP[typeof type === 'string' ? type : '']
        if (!mappedType) continue

        normalized.push({
            title,
            url,
            type: mappedType,
            ...(typeof description === 'string' && description ? { description } : {}),
        })
    }

    return normalized.length > 0 ? normalized : undefined
}

export type ChallengeStageKind = 'observe' | 'design' | 'build_test' | 'iterate' | 'generic'

export interface ChallengeStage {
    title: string; description: string; hint?: string; kind?: ChallengeStageKind
    /** 完成清单（成功标准）：只定义"做到什么算这步做好了"，不规定做法 */
    checklist?: string[]
}

export type StageProgressStatus = 'not_started' | 'in_progress' | 'completed'

export interface StageProgress {
    stageIndex: number
    status: StageProgressStatus
    notes?: string
    images: string[]
    data?: Record<string, unknown>
    videoUrl?: string
    aiFeedback?: StageAiFeedback | null
    updatedAt?: string
}

export interface StageAiFeedback {
    strengths: string[]
    gaps: string[]
    nextActions: string[]
    generatedAt?: string
}

/**
 * 挑战类型
 */
export interface Challenge {
    id: string | number
    title: string
    description: string
    image: string
    participants: number
    daysLeft: number
    endDate?: string
    startDate?: string
    joined: boolean
    tags: string[]
    challengeType: ChallengeType
    status: ChallengeStatus
    difficultyStars?: number
    scenario?: string
    drivingQuestion?: string
    expectedOutcome?: string
    constraints?: string[]
    resources?: ChallengeResource[]
    stages?: ChallengeStage[]
    steamWeights?: SteamWeights
    recommendedProjects?: ObservationLinkedItem[]
    submissionsCount?: number
    completionsCount?: number
    completed?: boolean
    mySubmissionId?: number
    mySubmissionStatus?: 'pending' | 'approved' | 'rejected'
    canEditSubmission?: boolean
}

export interface ChallengeSubmissionRatingSummary {
    avgCreativeExpression: number
    avgCompletionQuality: number
    avgEvidenceCompleteness: number
    avgReflectionDepth: number
    avgScore: number
    ratingCount: number
}

export interface ChallengeSubmission {
    id: number
    challengeId: number
    userId: string
    title: string
    author: string
    avatar?: string
    avatarFrameId?: string | null
    nameColorId?: string | null
    createdAt: string
    updatedAt: string
    proofImages: string[]
    proofCaptions?: string[]
    proofVideoUrl?: string
    notes?: string
    isPublic: boolean
    status?: 'pending' | 'approved' | 'rejected'
    rejectionReason?: string
    ratingSummary: ChallengeSubmissionRatingSummary
    referenceProjects: ObservationLinkedItem[]
}

export interface ObservationLinkedItem {
    id: number
    title: string
    slug?: string
    subtitle?: string | null
    relationRole?: string
}

export interface ObservationSpeciesSummary {
    speciesId: number
    speciesSlug?: string
    commonName: string
    scientificName?: string | null
    count?: number | null
    behaviorTags: string[]
    confidence?: number | null
    notes?: string | null
}

export interface ObservationIdentification {
    id: number
    speciesId: number
    speciesSlug?: string | null
    commonName: string
    scientificName?: string | null
    lifecycleStage?: ObservationLifecycleStage | null
    sex?: ObservationSex | null
    source: 'human' | 'ai'
    identifierUserId?: string | null
    identifierDisplayName?: string | null
    identifierAvatarUrl?: string | null
    identifierAvatarFrameId?: string | null
    confidence?: number | null
    modelName?: string | null
    createdAt: string
}

export interface ObservationEvent {
    id: number
    userId: string
    authorDisplayName?: string | null
    observedAt: string
    createdAt: string
    locationName: string
    latitude?: number | null
    longitude?: number | null
    locationPrecision?: string | null
    habitat?: string | null
    weather?: string | null
    notes?: string | null
    mediaUrls: string[]
    isPublic: boolean
    status: 'pending' | 'approved' | 'rejected' | string
    natureTopic?: NatureTopicKey | null
    identificationStatus: 'needs_id' | 'community_confirmed'
    observedAtSource?: 'photo_exif' | 'manual' | null
    locationSource?: 'photo_exif' | 'place_search' | 'map_pin' | 'device_location' | null
    coordinateSystem?: 'gcj02' | 'legacy_unknown' | null
    likesCount: number
    commentsCount: number
    species: ObservationSpeciesSummary[]
    identifications?: ObservationIdentification[]
}

export interface ObservationHotspotSpeciesSummary {
    speciesId: number
    speciesSlug?: string
    commonName: string
    scientificName?: string | null
    observationCount: number
    totalCount: number | null
    latestObservedAt: string
}

export interface ObservationLocationSummary {
    locationName: string
    observationCount: number
    latestObservedAt: string
    latitude?: number | null
    longitude?: number | null
    species?: ObservationHotspotSpeciesSummary[]
}

export interface SpeciesContributorSummary {
    userId: string
    displayName: string
    avatarUrl?: string | null
    observationCount: number
}

export interface SpeciesIdentifierSummary {
    userId: string
    displayName: string
    avatarUrl?: string | null
    identificationCount: number
}

export interface SpeciesMonthlyAggregate {
    month: number
    count: number
}

export interface SpeciesYearlyAggregate {
    year: number
    count: number
}

export interface SpeciesLifecycleAggregate {
    stage: ObservationLifecycleStage
    count: number
}

export interface SpeciesSexAggregate {
    sex: ObservationSex
    count: number
}

export interface SpeciesStats {
    totalObservationCount: number
    latestObservedAt: string | null
    topObservers: SpeciesContributorSummary[]
    topIdentifiers: SpeciesIdentifierSummary[]
    monthlyAggregates: SpeciesMonthlyAggregate[]
    yearlyAggregates: SpeciesYearlyAggregate[]
    lifecycleAggregates: SpeciesLifecycleAggregate[]
    sexAggregates: SpeciesSexAggregate[]
}

export interface Species {
    id: number
    slug: string
    commonName: string
    scientificName?: string | null
    aliases: string[]
    taxonGroup?: string | null
    identificationNotes?: string | null
    habitatNotes?: string | null
    seasonalityNotes?: string | null
    coverImageUrl?: string | null
    imageUrls?: string[]
    audioUrl?: string | null
    isActive: boolean
    topicKey?: NatureTopicKey | null
    topicLabel?: string
    lifeForm?: PlantLifeForm | null
    cultivationStatus?: PlantCultivationStatus | null
    plantUses?: PlantUseKey[]
    observedByCurrentUser?: boolean
    observationCount?: number
    aliasesDisplay?: string
    recentObservations?: ObservationEvent[]
    topLocations?: ObservationLocationSummary[]
    stats?: SpeciesStats
}

export interface ChallengeRating {
    id: number
    projectId: number
    userId: string
    creativity: number
    practicality: number
    technical: number
    reflectionDepth: number
}

export interface RatingSummary {
    avgCreativity: number
    avgPracticality: number
    avgTechnical: number
    avgReflectionDepth: number
    totalScore: number
    ratingCount: number
}

export interface SteamRadarDimension {
    raw: number
    display: number
    tier: 'none' | 'foundation' | 'intermediate' | 'advanced'
}

export interface SteamRadarResult {
    S: SteamRadarDimension
    T: SteamRadarDimension
    E: SteamRadarDimension
    A: SteamRadarDimension
    M: SteamRadarDimension
}

export interface Iteration {
    description: string
    result: string
    created_at: string
}

/**
 * 用户资料类型
 */
export interface Profile {
    id: string
    username: string | null
    display_name: string | null
    avatar_url: string | null
    bio: string | null
    gender: string | null
    xp: number
    coins?: number
    equipped_avatar_frame_id?: string | null
    equipped_name_color_id?: string | null
    role: 'user' | 'teacher' | 'moderator' | 'admin'
}

export type WorkSource =
    | {
        type: 'project'
        id: number
        title: string
        href: string
        image?: string
      }
    | {
        type: 'course_lesson'
        id: number
        title: string
        href: string
        image?: string
        courseId: number
        courseTitle: string
      }

/** 项目或课程课时产出的统一作品。 */
export interface Work {
    id: number
    userId: string
    projectId: string | number | null
    courseLessonId?: number
    source?: WorkSource
    author: string
    avatar?: string
    avatarFrameId?: string | null
    nameColorId?: string | null
    completedAt: string
    /** ISO 8601，用于相对时间展示 */
    completedAtIso?: string
    authorLevel?: number
    commentsCount?: number
    proofImages: string[]
    proofCaptions?: string[]
    proofVideoUrl?: string
    notes?: string
    isPublic: boolean
    likes: number
    coins: number
    status?: 'pending' | 'approved' | 'rejected'
    rejectionReason?: string
    recordKind?: 'progress' | 'final'
    recordType?: string
    stageLabel?: string
    explorationStartedAt?: string
}

/** @deprecated Prefer Work. Kept while project record components are migrated. */
export type ProjectCompletion = Work

// ============================================================
// 类型映射函数
// ============================================================

/**
 * 将数据库 Project 类型映射为前端 Project 类型
 */
export function mapDbProject(
    dbProject: DbProject & {
        profiles?: Pick<DbProfile, 'display_name'> | null
        project_materials?: DbProjectMaterial[]
        project_steps?: DbProjectStep[]
        sub_categories?: Pick<DbSubCategory, 'name'> | null
        comments?: DbCommentWithProfile[]
        tags?: string[]
    }
): Project {
    const tags = normalizeTagList(dbProject.tags)

    return {
        id: dbProject.id,
        title: dbProject.title,
        author: dbProject.profiles?.display_name || 'Unknown',
        author_id: dbProject.author_id || '',
        image: dbProject.image_url || '',
        category: dbProject.category || '',
        sub_category_id: dbProject.sub_category_id || undefined,
        sub_category: dbProject.sub_categories?.name || undefined,
        likes: dbProject.likes_count,
        views_count: ('views_count' in dbProject ? Number((dbProject as Record<string, unknown>).views_count) : 0),
        coins_count: ('coins_count' in dbProject ? Number((dbProject as Record<string, unknown>).coins_count) : 0),
        comments_count: ('comments_count' in dbProject ? Number((dbProject as Record<string, unknown>).comments_count) : 0),
        description: dbProject.description || '',
        materials: dbProject.project_materials
            ?.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
            .map(m => m.material) || [],
        steps: dbProject.project_steps
            ?.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
            .map(s => ({
                title: s.title,
                description: s.description || '',
                image_url: s.image_url || undefined
            })) || [],
        comments: dbProject.comments?.map(c => mapDbComment(c)) || [],
        difficulty: (dbProject.difficulty as 'easy' | 'medium' | 'hard') || undefined,
        difficulty_stars: dbProject.difficulty_stars ?? 3,
        tags,
        status: (dbProject.status as 'draft' | 'pending' | 'approved' | 'rejected') || 'pending',
        rejection_reason: dbProject.rejection_reason ?? null,
        challenge_id: ('challenge_id' in dbProject ? (dbProject as Record<string, unknown>).challenge_id as number | null : null),
        reflection: ('reflection' in dbProject ? (dbProject as Record<string, unknown>).reflection as string | undefined : undefined),
        problem_statement: ('problem_statement' in dbProject ? (dbProject as Record<string, unknown>).problem_statement as string | undefined : undefined),
        iterations: ('iterations' in dbProject ? (dbProject as Record<string, unknown>).iterations as Iteration[] | undefined : undefined),
        steam_weights: ('steam_weights' in dbProject ? (dbProject as Record<string, unknown>).steam_weights as SteamWeights | null : null),
    }
}

/**
 * 将数据库 Comment 类型映射为前端 Comment 类型
 */
export function mapDbComment(
    dbComment: DbCommentWithProfile
): Comment {
    return {
        id: dbComment.id,
        author: dbComment.profiles?.display_name || 'Unknown',
        userId: dbComment.author_id,
        avatar: dbComment.profiles?.avatar_url || undefined,
        avatarFrameId: dbComment.profiles?.equipped_avatar_frame_id ?? undefined,
        nameColorId: dbComment.profiles?.equipped_name_color_id ?? undefined,
        role: (dbComment.profiles?.role as Comment['role']) || 'user',
        content: dbComment.content,
        image_url: dbComment.image_url ?? null,
        likes_count: dbComment.likes_count ?? 0,
        date: formatRelativeTime(dbComment.created_at),
        created_at: dbComment.created_at,
        updated_at: dbComment.updated_at ?? null,
        parent_id: dbComment.parent_id || null,
        reply_to_user_id: dbComment.reply_to_user_id || null,
        reply_to_username: dbComment.reply_to_username || null
    }
}

export function mapDbObservationComment(row: DbObservationCommentWithProfile): Comment {
    return mapDbComment(row)
}

/**
 * 将数据库 Discussion 类型映射为前端 Discussion 类型
 */
export function mapDbDiscussion(
    dbDiscussion: DbDiscussion & {
        profiles?: Pick<DbProfile, 'display_name' | 'avatar_url' | 'equipped_avatar_frame_id'> & { equipped_name_color_id?: string | null; xp?: number | null } | null
        discussion_replies?: DbCommentWithProfile[]
    }
): Discussion {
    return {
        id: dbDiscussion.id,
        title: dbDiscussion.title,
        author: dbDiscussion.profiles?.display_name || 'Unknown',
        authorId: dbDiscussion.author_id,
        authorAvatar: dbDiscussion.profiles?.avatar_url || undefined,
        authorAvatarFrameId: dbDiscussion.profiles?.equipped_avatar_frame_id ?? undefined,
        authorNameColorId: dbDiscussion.profiles?.equipped_name_color_id ?? undefined,
        content: dbDiscussion.content,
        date: new Date(dbDiscussion.created_at).toLocaleString('zh-CN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        }),
        replies: dbDiscussion.discussion_replies?.map(mapDbComment) || [],
        likes: dbDiscussion.likes_count,
        tags: dbDiscussion.tags || []
    }
}

/**
 * 仅从讨论行 + 已映射的回复列表组装 Discussion（用于详情页分页拉取讨论头与回复时）
 */
export function mapDiscussionFromRow(row: DbDiscussionWithProfile, replies: Comment[]): Discussion {
    return {
        id: row.id,
        title: row.title,
        author: row.profiles?.display_name || 'Unknown',
        authorId: row.author_id,
        authorAvatar: row.profiles?.avatar_url || undefined,
        authorAvatarFrameId: row.profiles?.equipped_avatar_frame_id ?? undefined,
        authorNameColorId: row.profiles?.equipped_name_color_id ?? undefined,
        content: row.content,
        date: formatRelativeTime(row.created_at),
        likes: row.likes_count,
        tags: row.tags || [],
        replies,
    }
}

/**
 * 将数据库 Challenge 类型映射为前端 Challenge 类型
 */
export function mapDbChallenge(
    dbChallenge: DbChallenge & Record<string, unknown>,
    joined: boolean = false,
    completed: boolean = false
): Challenge {
    const endDate = dbChallenge.end_date ? new Date(dbChallenge.end_date) : null
    const daysLeft = endDate
        ? Math.max(0, Math.ceil((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
        : 0

    return {
        id: dbChallenge.id,
        title: dbChallenge.title,
        description: dbChallenge.description || '',
        image: dbChallenge.image_url || '',
        participants: dbChallenge.participants_count,
        daysLeft,
        endDate: dbChallenge.end_date || undefined,
        startDate: (dbChallenge.start_date as string) || undefined,
        joined,
        tags: dbChallenge.tags || [],
        challengeType: ((dbChallenge.challenge_type as string) || 'timed') as ChallengeType,
        status: ((dbChallenge.status as string) || 'active') as ChallengeStatus,
        difficultyStars: (dbChallenge.difficulty_stars as number) ?? 3,
        scenario: (dbChallenge.scenario as string) || undefined,
        drivingQuestion: (dbChallenge.driving_question as string) || undefined,
        expectedOutcome: (dbChallenge.expected_outcome as string) || undefined,
        constraints: (dbChallenge.constraints as string[]) || undefined,
        resources: normalizeChallengeResources(dbChallenge.resources),
        stages: (dbChallenge.stages as unknown as ChallengeStage[]) || undefined,
        steamWeights: (dbChallenge.steam_weights as unknown as SteamWeights) || undefined,
        submissionsCount: (dbChallenge.submissions_count as number) ?? undefined,
        completionsCount: (dbChallenge.completions_count as number) ?? undefined,
        completed,
        mySubmissionId: (dbChallenge.my_submission_id as number) ?? undefined,
        mySubmissionStatus: (dbChallenge.my_submission_status as 'pending' | 'approved' | 'rejected') ?? undefined,
        canEditSubmission: (dbChallenge.can_edit_submission as boolean) ?? undefined,
    }
}

export function mapDbStageProgress(row: {
    stage_index: number
    status: string
    notes: string | null
    images: string[] | null
    data: unknown
    video_url: string | null
    ai_feedback: unknown
    updated_at: string | null
}): StageProgress {
    const feedback = row.ai_feedback as Record<string, unknown> | null
    const aiFeedback: StageAiFeedback | null = feedback && typeof feedback === 'object'
        ? {
            strengths: Array.isArray(feedback.strengths) ? (feedback.strengths as string[]) : [],
            gaps: Array.isArray(feedback.gaps) ? (feedback.gaps as string[]) : [],
            nextActions: Array.isArray(feedback.nextActions) ? (feedback.nextActions as string[]) : [],
            generatedAt: typeof feedback.generatedAt === 'string' ? feedback.generatedAt : undefined,
        }
        : null

    return {
        stageIndex: row.stage_index,
        status: ((row.status as StageProgressStatus) || 'not_started'),
        notes: row.notes || undefined,
        images: row.images || [],
        data: (row.data as Record<string, unknown>) || undefined,
        videoUrl: row.video_url || undefined,
        aiFeedback,
        updatedAt: row.updated_at || undefined,
    }
}

export function mapDbSpecies(dbSpecies: DbSpecies): Species {
    return {
        id: dbSpecies.id,
        slug: dbSpecies.slug,
        commonName: dbSpecies.common_name,
        scientificName: dbSpecies.scientific_name,
        aliases: dbSpecies.aliases || [],
        aliasesDisplay: (dbSpecies.aliases || []).join('、'),
        taxonGroup: dbSpecies.taxon_group,
        identificationNotes: dbSpecies.identification_notes,
        habitatNotes: dbSpecies.habitat_notes,
        seasonalityNotes: dbSpecies.seasonality_notes,
        coverImageUrl: dbSpecies.cover_image_url,
        audioUrl: dbSpecies.audio_url,
        isActive: dbSpecies.is_active,
        lifeForm: dbSpecies.life_form as PlantLifeForm | null,
        cultivationStatus: dbSpecies.cultivation_status as PlantCultivationStatus | null,
        plantUses: (dbSpecies.plant_uses || []) as PlantUseKey[],
    }
}

export function mapDbObservationEventSpecies(
    row: DbObservationEventSpecies,
    species: Pick<DbSpecies, 'id' | 'slug' | 'common_name' | 'scientific_name'>,
): ObservationSpeciesSummary {
    return {
        speciesId: species.id,
        speciesSlug: species.slug,
        commonName: species.common_name,
        scientificName: species.scientific_name,
        count: row.count,
        behaviorTags: row.behavior_tags || [],
        confidence: row.confidence,
        notes: row.notes,
    }
}

export function mapDbObservationEvent(
    dbObservationEvent: DbObservationEvent,
    species: ObservationSpeciesSummary[] = [],
): ObservationEvent {
    return {
        id: dbObservationEvent.id,
        userId: dbObservationEvent.user_id,
        observedAt: dbObservationEvent.observed_at,
        createdAt: dbObservationEvent.created_at,
        locationName: dbObservationEvent.location_name,
        latitude: dbObservationEvent.latitude,
        longitude: dbObservationEvent.longitude,
        locationPrecision: dbObservationEvent.location_precision,
        habitat: dbObservationEvent.habitat,
        weather: dbObservationEvent.weather,
        notes: dbObservationEvent.notes,
        mediaUrls: dbObservationEvent.media_urls || [],
        isPublic: dbObservationEvent.is_public,
        status: dbObservationEvent.status,
        natureTopic: dbObservationEvent.nature_topic as NatureTopicKey | null,
        identificationStatus: dbObservationEvent.identification_status as ObservationEvent['identificationStatus'],
        observedAtSource: dbObservationEvent.observed_at_source as ObservationEvent['observedAtSource'],
        locationSource: dbObservationEvent.location_source as ObservationEvent['locationSource'],
        coordinateSystem: dbObservationEvent.coordinate_system as ObservationEvent['coordinateSystem'],
        likesCount: (dbObservationEvent as Record<string, unknown>).likes_count as number || 0,
        commentsCount: (dbObservationEvent as Record<string, unknown>).comments_count as number || 0,
        species,
    }
}

/**
 * 将数据库 Profile 类型映射为前端 Profile 类型
 */
export function mapDbProfile(dbProfile: DbProfile): Profile {
    return {
        id: dbProfile.id,
        username: dbProfile.username,
        display_name: dbProfile.display_name,
        avatar_url: dbProfile.avatar_url,
        bio: dbProfile.bio,
        gender: dbProfile.gender ?? null,
        xp: dbProfile.xp,
        coins: 'coins' in dbProfile ? (dbProfile as { coins: number }).coins : undefined,
        equipped_avatar_frame_id: 'equipped_avatar_frame_id' in dbProfile ? (dbProfile as { equipped_avatar_frame_id: string | null }).equipped_avatar_frame_id : undefined,
        equipped_name_color_id: 'equipped_name_color_id' in dbProfile ? (dbProfile as { equipped_name_color_id: string | null }).equipped_name_color_id : undefined,
        role: (dbProfile.role as 'user' | 'teacher' | 'moderator' | 'admin') || 'user'
    }
}

/**
 * 将数据库 CompletedProject 类型映射为前端 ProjectCompletion 类型
 */
export function mapDbCompletion(
    dbCompletion: DbCompletedProject & {
        profiles?: Pick<DbProfile, 'display_name' | 'avatar_url' | 'equipped_avatar_frame_id'> & { equipped_name_color_id?: string | null; xp?: number | null } | null
    }
): Work {
    return {
        id: dbCompletion.id,
        userId: dbCompletion.user_id,
        projectId: dbCompletion.project_id,
        courseLessonId: dbCompletion.course_lesson_id ?? undefined,
        author: dbCompletion.profiles?.display_name || 'Unknown',
        avatar: dbCompletion.profiles?.avatar_url || undefined,
        avatarFrameId: dbCompletion.profiles?.equipped_avatar_frame_id ?? undefined,
        nameColorId: dbCompletion.profiles?.equipped_name_color_id ?? undefined,
        completedAt: new Date(dbCompletion.completed_at || '').toLocaleDateString('zh-CN'),
        completedAtIso: dbCompletion.completed_at || undefined,
        authorLevel: dbCompletion.profiles?.xp != null
            ? Math.floor(Math.sqrt(Number(dbCompletion.profiles.xp) / 100)) + 1
            : undefined,
        proofImages: dbCompletion.proof_images || [],
        proofCaptions: dbCompletion.proof_captions ?? undefined,
        proofVideoUrl: dbCompletion.proof_video_url || undefined,
        notes: dbCompletion.notes || undefined,
        isPublic: dbCompletion.is_public ?? true,
        likes: dbCompletion.likes_count ?? 0,
        coins: dbCompletion.coins_count ?? 0,
        status: (dbCompletion.status as 'pending' | 'approved' | 'rejected') || undefined,
        rejectionReason: dbCompletion.rejection_reason || undefined,
        recordKind: ((dbCompletion as { record_kind?: string }).record_kind === 'progress'
            ? 'progress'
            : 'final') as 'progress' | 'final',
        recordType: (dbCompletion as { record_type?: string | null }).record_type || undefined,
        stageLabel: (dbCompletion as { stage_label?: string | null }).stage_label || undefined,
    }
}

export function mapDbChallengeSubmission(
    dbSubmission: DbChallengeSubmission & {
        profiles?: Pick<DbProfile, 'display_name' | 'avatar_url' | 'equipped_avatar_frame_id'> & { equipped_name_color_id?: string | null; xp?: number | null } | null
        referenceProjects?: ObservationLinkedItem[]
        ratingSummary?: Partial<ChallengeSubmissionRatingSummary>
    }
): ChallengeSubmission {
    const ratingSummary = dbSubmission.ratingSummary || {}

    return {
        id: dbSubmission.id,
        challengeId: dbSubmission.challenge_id,
        userId: dbSubmission.user_id,
        title: dbSubmission.title,
        author: dbSubmission.profiles?.display_name || 'Unknown',
        avatar: dbSubmission.profiles?.avatar_url || undefined,
        avatarFrameId: dbSubmission.profiles?.equipped_avatar_frame_id ?? undefined,
        nameColorId: dbSubmission.profiles?.equipped_name_color_id ?? undefined,
        createdAt: dbSubmission.created_at,
        updatedAt: dbSubmission.updated_at,
        proofImages: dbSubmission.proof_images || [],
        proofCaptions: dbSubmission.proof_captions ?? undefined,
        proofVideoUrl: dbSubmission.proof_video_url || undefined,
        notes: dbSubmission.notes || undefined,
        isPublic: dbSubmission.is_public ?? true,
        status: (dbSubmission.status as 'pending' | 'approved' | 'rejected') || undefined,
        rejectionReason: dbSubmission.rejection_reason || undefined,
        ratingSummary: {
            avgCreativeExpression: ratingSummary.avgCreativeExpression ?? 0,
            avgCompletionQuality: ratingSummary.avgCompletionQuality ?? 0,
            avgEvidenceCompleteness: ratingSummary.avgEvidenceCompleteness ?? 0,
            avgReflectionDepth: ratingSummary.avgReflectionDepth ?? 0,
            avgScore: ratingSummary.avgScore ?? 0,
            ratingCount: ratingSummary.ratingCount ?? 0,
        },
        referenceProjects: dbSubmission.referenceProjects || [],
    }
}

// ============================================================
// 消息 & 举报类型（从 lib/types/database 迁移）
// ============================================================

export interface Message {
  id: number;
  sender_id: string;
  receiver_id: string;
  content: string;
  read_at?: string | null;
  created_at: string;
}

export type ReportContentType =
  | "project"
  | "discussion"
  | "discussion_reply"
  | "comment"
  | "message"
  | "completion_comment"
  | "observation";

export type ReportReason =
  | "spam"
  | "harassment"
  | "inappropriate"
  | "illegal"
  | "other";

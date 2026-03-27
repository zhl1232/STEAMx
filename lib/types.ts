/**
 * @deprecated 此文件已被 deprecated，请使用 @/lib/mappers/types
 * 新的类型定义从数据库类型映射而来，作为单一事实来源
 * 
 * 迁移指南：
 * - import { Project } from '@/lib/types' → import { Project } from '@/lib/mappers/types'
 * - import { Comment } from '@/lib/types' → import { Comment } from '@/lib/mappers/types'
 * 
 * 此文件将在所有引用更新后移除
 */

// 重新导出新类型以保持向后兼容
export type {
    Project,
    ProjectStep,
    Comment,
    Discussion,
    Challenge,
    Profile,
    Species,
    ObservationEvent,
    ObservationSpeciesSummary,
    ObservationLinkedItem,
} from '@/lib/mappers/types'

export {
    mapDbProject,
    mapDbComment,
    mapDbDiscussion,
    mapDbChallenge,
    mapDbProfile,
    mapDbSpecies,
    mapDbObservationEvent,
    mapDbObservationEventSpecies,
} from '@/lib/mappers/types'

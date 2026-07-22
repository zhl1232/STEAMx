import type { LessonTypeSlug } from '@/lib/courses/lesson-types'

export type CourseStatus = 'draft' | 'approved' | 'archived'
export type LessonType = LessonTypeSlug
export type CourseLessonTrack = 'foundation' | 'tactics' | 'ai' | 'review'

export interface CourseLessonStep {
  title: string
  description: string
  hint?: string
  checklist?: string[]
  /** Optional lesson visuals rendered by compatible workspaces. */
  visuals?: CourseLessonStepVisual[]
  /** Optional interactive practice rendered by compatible workspaces. */
  training?: CourseLessonTraining
}

export type GomokuBoardTone = 'blue' | 'amber' | 'success' | 'danger' | 'neutral'

export interface GomokuBoardPoint {
  r: number
  c: number
}

export interface GomokuBoardStone extends GomokuBoardPoint {
  label?: string
}

export interface GomokuBoardMark extends GomokuBoardPoint {
  label?: string
  tone?: GomokuBoardTone
  kind?: 'dot' | 'ring' | 'target'
}

export interface GomokuBoardLine {
  from: GomokuBoardPoint
  to: GomokuBoardPoint
  tone?: GomokuBoardTone
  dashed?: boolean
}

export interface GomokuBoardVisual {
  type: 'gomoku_board'
  caption: string
  ariaLabel?: string
  blackStones?: GomokuBoardStone[]
  whiteStones?: GomokuBoardStone[]
  marks?: GomokuBoardMark[]
  lines?: GomokuBoardLine[]
  winLine?: GomokuBoardLine
}

export type CourseLessonStepVisual = GomokuBoardVisual

export interface GomokuBestMoveCandidate extends GomokuBoardPoint {
  label?: string
  reason?: string
}

export interface GomokuBestMoveTraining {
  type: 'gomoku_best_move'
  prompt?: string
  player: 'black' | 'white'
  blackStones: GomokuBoardStone[]
  whiteStones: GomokuBoardStone[]
  bestMoves: GomokuBestMoveCandidate[]
  candidateMoves?: GomokuBestMoveCandidate[]
  explanation: string
  correctFeedback?: string
  wrongFeedback?: string
}

export type CourseLessonTraining = GomokuBestMoveTraining

export interface CourseLessonResource {
  title: string
  url: string
  type?: string
}

/** 完成课时的一条积木校验规则：作品里只要用到 anyOf 中任一 opcode 即算达成 */
export interface LessonRequiredBlock {
  /** 给孩子看的中文积木名，如「重复执行」「当角色被点击」 */
  label: string
  /** Scratch 3 标准 opcode 列表，满足其一即可 */
  anyOf: string[]
}

export interface LessonContent {
  /** 一句话课程目标，展示在侧边栏 */
  summary?: string
  /** Optional learning track label for course lists, e.g. foundation/tactics/AI/review. */
  track?: CourseLessonTrack
  /** Optional display override for the learning track. */
  levelLabel?: string
  /** 面向家长/老师的课前、引导、观察记录与延伸提示。 */
  teacherGuide?: CourseTeacherGuide
  /** 课时学习目标，适合在学习页快速浏览。 */
  learningGoals?: string[]
  /** 本课对应的 Scratch 官方教程 deck id（如 'tell-a-story'、'pong-game'），用于「教程」按钮按课直达 */
  tutorialDeckId?: string
  /** 完成本课必须用到的关键积木；为空或缺省时退化为「保存即可完成」 */
  requiredBlocks?: LessonRequiredBlock[]
  /** 大颗粒积木搭建课内容；仅 lesson_type=building_3d 时由搭建工作区读取 */
  building3d?: Building3DLessonContent
  /** 游乐场实训课配置；仅 lesson_type=playground 时由实训工作区读取 */
  playground?: PlaygroundLessonContent
  /** Whether this lesson produces a publishable work. */
  workSubmission?: {
    enabled: boolean
  }
  [key: string]: unknown
}

export interface CourseTeacherGuide {
  inquiryQuestion?: string
  prepare?: string[]
  guidePrompts?: string[]
  observe?: string[]
  extension?: string
  familyShare?: string
}

/**
 * 游乐场实训课内容：把游乐场里的某款游戏按「讲解 + 实战」组织成一节技能课。
 * `gameKey` 指向 lib/playground/catalog 的游戏标识，目前仅 'gomoku' 有完整课程化文案。
 */
export interface PlaygroundLessonContent {
  /** 游乐场游戏 key（与 playground 页面/目录对应），如 'gomoku' */
  gameKey: string
  /** 游乐场实战链接，例如 '/playground/gomoku'；缺省时按 gameKey 推导 */
  practiceHref?: string
  /** 实战按钮文案，例如「去和 AI 下一局」 */
  practiceCta?: string
}

export interface Building3DPart {
  id: string
  name: string
  color: string
  quantity: number
}

export type Building3DPrimitiveShape = 'box' | 'cylinder'
export type Building3DVector3 = [number, number, number]

export interface Building3DBrickInstance {
  /** Unique node id used by steps3d.partIds/highlightNodeIds for staged reveal. */
  id: string
  /** Inventory part id shown in the part list. */
  partId: string
  shape?: Building3DPrimitiveShape
  position: Building3DVector3
  scale: Building3DVector3
  rotation?: Building3DVector3
  color?: string
}

export interface Building3DStep {
  title: string
  description: string
  partIds: string[]
  highlightNodeIds?: string[]
  cameraHint?: 'front' | 'back' | 'side' | 'top' | 'isometric'
}

export interface Building3DLessonContent {
  /** GLTF/GLB 模型 URL（可选）；大颗粒课程优先使用 ldrawModelUrl。 */
  modelUrl?: string
  /**
   * 自托管的 LDraw 模型（建议为打包后的 .mpd，见 scripts/pack-ldraw-model.mjs）。
   * 设置后由 LDrawLoader 加载真实大颗粒零件，并用模型内的 `0 STEP` 驱动分步显隐。
   */
  ldrawModelUrl?: string
  /** LDraw 配色文件 URL；缺省时使用 /courses/ldraw/LDConfig.ldr */
  ldrawColorUrl?: string
  /** 零件库署名（LDraw 按 CC BY / CCAL 再分发时需展示） */
  attribution?: string
  /** 课程动画/讲解视频（mp4 等可被 <video> 直接播放的源）。原 PPT 内嵌的视频抽出后即此源。 */
  videoUrl?: string
  /** 授课课件：每页一张图（PPT 转图后的画廊，按顺序翻页）。 */
  slideImageUrls?: string[]
  /**
   * 视频所在的课件页码（1 基，对应 slideImageUrls 的第几页）。
   * 设置后，课件翻页到该页时就地播放 videoUrl，还原「动画嵌在 PPT 里播放」。
   */
  videoSlideIndex?: number
  /** 历史搭建说明 PDF；学习页不展示，仅保留供课程导入与后台管理使用。 */
  slidesPdfUrl?: string
  /** 成品参考照片；真实 3D 搭建步骤不展示此图。 */
  finishedImageUrl?: string
  parts: Building3DPart[]
  steps3d: Building3DStep[]
  /** 历史/开发兜底：未提供模型文件时由 3D 工作区直接渲染。新增大颗粒课程应使用 ldrawModelUrl。 */
  brickInstances?: Building3DBrickInstance[]
}

export interface CourseRow {
  id: number
  title: string
  description: string | null
  image_url: string | null
  tags: string[] | null
  difficulty_stars: number
  status: CourseStatus
  sort_order: number
  steam_weights: Record<string, number> | null
  created_at: string
  updated_at: string
}

export interface CourseLessonRow {
  id: number
  course_id: number
  title: string
  lesson_type: LessonType
  content: LessonContent | null
  steps: CourseLessonStep[]
  resources: CourseLessonResource[]
  starter_project_path: string | null
  sort_order: number
  duration_minutes: number | null
  created_at: string
  updated_at: string
}

export interface CourseListItem extends CourseRow {
  lesson_count: number
}

export interface CourseLessonSummary {
  id: number
  course_id: number
  title: string
  lesson_type: LessonType
  sort_order: number
  duration_minutes: number | null
  track: CourseLessonTrack | null
  level_label: string | null
}

export interface CourseOverview extends CourseRow {
  lessons: CourseLessonSummary[]
}

export interface UserLessonProgressRow {
  user_id: string
  lesson_id: number
  scratch_project_path: string | null
  completed_at: string | null
  updated_at: string
}

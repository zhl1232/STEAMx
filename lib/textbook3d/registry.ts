/**
 * 3D 物理课本课目登记表。
 *
 * 加新课：先在课本源码目录用 tools/build_split.py 构建，
 * 在这里追加一条，再运行 `node scripts/textbook3d/sync.mjs <dist-split 目录>` 复制静态文件。
 * 详见 docs/textbook3d.md。
 */

/** 静态包版本目录；只在嵌入协议不兼容时升级为 v2，旧版本保留不覆盖。 */
export const TEXTBOOK3D_VERSION = "v1"

/**
 * 共享运行时（three + 模板，带哈希的 JS）和字体的基址，构建时写进每课 HTML。
 * 以后挪到 OSS/CDN：改这里，并用同一个值设 TEXTBOOK3D_ASSET_BASE 重新构建、同步（CDN 需开 CORS）。
 */
export const TEXTBOOK3D_SHARED_BASE = `/textbook3d/${TEXTBOOK3D_VERSION}/shared/`

export type Textbook3dLesson = {
  /** 课号，与静态目录同名，例如 g8a-1-1 = 八年级上册第 1 章第 1 节 */
  id: string
  /** 节标题 */
  title: string
}

export type Textbook3dChapter = {
  id: string
  /** 册次，例如「八年级上册」 */
  volume: string
  /** 章标题，例如「第一章 机械运动」 */
  title: string
  lessons: Textbook3dLesson[]
}

export const TEXTBOOK3D_CHAPTERS: Textbook3dChapter[] = [
  {
    id: "g8a-1",
    volume: "八年级上册",
    title: "第一章 机械运动",
    lessons: [
      { id: "g8a-1-1", title: "长度和时间的测量" },
      { id: "g8a-1-2", title: "运动的描述" },
      { id: "g8a-1-3", title: "运动的快慢" },
      { id: "g8a-1-4", title: "速度的测量" },
    ],
  },
  {
    id: "g8a-2",
    volume: "八年级上册",
    title: "第二章 声现象",
    lessons: [
      { id: "g8a-2-1", title: "声音的产生与传播" },
      { id: "g8a-2-2", title: "声音的特性" },
      { id: "g8a-2-3", title: "声的利用" },
      { id: "g8a-2-4", title: "噪声的危害和控制" },
      { id: "g8a-2-5", title: "跨学科实践：制作隔音房间模型" },
    ],
  },
  {
    id: "g8a-3",
    volume: "八年级上册",
    title: "第三章 物态变化",
    lessons: [
      { id: "g8a-3-1", title: "温度" },
      { id: "g8a-3-2", title: "熔化和凝固" },
      { id: "g8a-3-3", title: "汽化和液化" },
      { id: "g8a-3-4", title: "升华和凝华" },
      { id: "g8a-3-5", title: "跨学科实践：探索厨房中的物态变化问题" },
    ],
  },
  {
    id: "g8a-4",
    volume: "八年级上册",
    title: "第四章 光现象",
    lessons: [
      { id: "g8a-4-1", title: "光的直线传播" },
      { id: "g8a-4-2", title: "光的反射" },
      { id: "g8a-4-3", title: "平面镜成像" },
      { id: "g8a-4-4", title: "光的折射" },
      { id: "g8a-4-5", title: "光的色散" },
    ],
  },
  {
    id: "g8b-11",
    volume: "八年级下册",
    title: "第十一章 功和机械能",
    lessons: [{ id: "g8b-11-4", title: "机械能及其转化" }],
  },
]

export const TEXTBOOK3D_LESSON_ID = /^g\d+[ab]-\d+-\d+$/

export function listTextbook3dLessons() {
  return TEXTBOOK3D_CHAPTERS.flatMap((chapter) =>
    chapter.lessons.map((lesson, index) => ({ ...lesson, chapter, number: index + 1 })),
  )
}

export function getTextbook3dLesson(id: string) {
  const lessons = listTextbook3dLessons()
  const index = lessons.findIndex((lesson) => lesson.id === id)
  if (index < 0) return null
  return { ...lessons[index], prev: lessons[index - 1] ?? null, next: lessons[index + 1] ?? null }
}

/** 同源静态包地址；只由登记表生成，不接受外部传入的 URL。 */
export function textbook3dSrc(id: string) {
  if (!TEXTBOOK3D_LESSON_ID.test(id)) throw new Error(`invalid textbook3d lesson id: ${id}`)
  return `/textbook3d/${TEXTBOOK3D_VERSION}/${id}/index.html?embed=1`
}

/** 只接受已登记的课号，其他一律返回 null。用于课程课时 content 和项目 interactive_url。 */
export function resolveTextbook3dLessonId(value: unknown): string | null {
  if (typeof value !== "string") return null
  return getTextbook3dLesson(value) ? value : null
}

/** 项目的 interactive_url 形如 /textbook3d/v1/<课号>/ 或 /textbook3d/v1/<课号>/index.html，解析出已登记的课号。 */
export function textbook3dLessonIdFromUrl(url: unknown): string | null {
  if (typeof url !== "string") return null
  const match = url.match(/^\/textbook3d\/v\d+\/(g\d+[ab]-\d+-\d+)(?:\/(?:index\.html)?)?$/)
  return match ? resolveTextbook3dLessonId(match[1]) : null
}

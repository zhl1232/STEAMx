import type { Project } from '@/lib/mappers/types'
import { resolveProjectVideoUrl } from './video-url'

export type ProjectVideoChapter = { seconds: number; label: string }

/** Presentation-only pilot, verified against this project's frames and burned-in subtitles.
 * No audio review, physical build, dimensions, wire gauge or battery specification verified.
 * Keep this separate from database content and science observation/preparation modes.
 */
const motorTutorial = {
  summary: '跟随制作视频绕线、刮漆、装底座并接线，最后试转线圈。先核对材料，再按时间点查看当前操作。',
  durationLabel: '视频时长约 2 分 17 秒（不是制作耗时）',
  materials: ['泡沫底板', 'EVA 片', '木块', '线圈材料', '磁铁', 'U 形叉', '3M 胶片', '摩擦条', '电池盒', '电池'],
  materialsNote: '以上按视频画面列出。尺寸、线径和电池规格尚未核实，准备时请先核对手头材料是否匹配。',
  reminder: '刮漆时，线圈一头半刮，另一头完全刮干净；安装底座时，木块的孔朝上。',
  chapters: [
    { seconds: 3, label: '材料总览' },
    { seconds: 6, label: '绕线' },
    { seconds: 49, label: '刮漆' },
    { seconds: 80, label: '底座' },
    { seconds: 94, label: '接线' },
    { seconds: 124, label: '试转' },
  ] satisfies ProjectVideoChapter[],
}

export function getProjectVideoPresentationPilot(project: Project) {
  if (Number(project.id) !== 1301 || project.title !== '自制电动机' || project.category !== '技术') return null
  const videoUrl = resolveProjectVideoUrl(project)
  // Retire the override if the source changes; do not attach reviewed timestamps to a new video.
  try {
    if (!videoUrl || new URL(videoUrl).href !== new URL('https://assets.steamx.cc/kejiao16a/六年级/013_自制电动机/video_1.mp4').href) return null
  } catch {
    return null
  }
  const [step] = project.steps ?? []
  // Only the verified placeholder is replaced. One genuine step must remain visible.
  if (project.steps?.length !== 1 || step.title !== '观看实验视频'
    || step.description !== '请准备好对应实验材料包，跟随本页视频完成操作。'
    || step.image_url || step.checkpoint) return null
  return motorTutorial
}

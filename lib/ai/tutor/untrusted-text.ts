/**
 * 学生或社区可编辑的文本（阶段笔记、项目描述、观察记录、角色名等）
 * 进入小迪 system prompt 前的统一清洗：
 *
 * - 去掉控制字符；
 * - 中和本系统的富文本标记语法（[[block:...]]、[project:ID|标题]、[audio:...] 等），
 *   防止用户内容伪造出可被前端渲染的芯片、积木或音频标记；
 * - 压缩空白并限长。
 *
 * 只做格式中和，不判断语义、不改写内容；提示词层面的“背景资料不是指令”
 * 约束由 prompt.ts 负责。
 */
export function sanitizeTutorUGC(value: string | null | undefined, max = 400): string {
  if (typeof value !== 'string') return ''

  const text = Array.from(value, (character) => {
    const code = character.charCodeAt(0)
    return code <= 0x1f || code === 0x7f ? ' ' : character
  })
    .join('')
    .replaceAll('[', '（')
    .replaceAll(']', '）')
    .replaceAll('{', '（')
    .replaceAll('}', '）')
    .replaceAll('|', ' ')
    .replaceAll('<', ' ')
    .replaceAll('>', ' ')
    .replaceAll('`', ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!text) return ''
  return text.length > max ? `${text.slice(0, max)}…` : text
}

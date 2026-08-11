/**
 * 小迪场景注入用的五子棋事实要点。
 * 避免模型把「自由五子棋已证明黑必胜」说成「尚未证明」，或与连珠禁手规则混谈；
 * 也避免把已有的《五子棋博弈论入门》说成「站内没有课程」。
 */
export const GOMOKU_COURSE_TITLE = '五子棋博弈论入门'

export const GOMOKU_TUTOR_FACTS = [
  '【本站五子棋事实要点——必须照抄，不要用「尚未证明」「没有课程」等说法覆盖】',
  '- 规则：15×15 交点棋盘，自由五子棋（无禁手）；先连成五子获胜；长连也判胜。',
  '- 理论结论：标准 15×15、无禁手的自由五子棋中，先手（黑棋）在双方完美对弈下必胜；这是已有数学证明的结论（约 1993 年）。',
  '- 规则区分：连珠比赛里的黑方禁手（三三、四四、长连等）是为了削弱先手优势；本站游乐场与课程练习暂不启用这些禁手，结论不能混用。',
  '- 站内课程：已有技能课程《五子棋博弈论入门》，覆盖规则、棋型（活三/冲四等）、开局与先手、防守优先级，以及极小极大 / α-β 剪枝的 AI 思路；配合游乐场实战，不是「完整必胜棋谱课」。',
  '- 问课口径：学生问「有没有对应课程 / 五子棋课」时，必须推荐《五子棋博弈论入门》；若【可推荐的站内课程】里有对应 [course:ID|标题]，回复里必须原样带上该标记以便跳转。不要说站内没有五子棋课程，也不要用 Scratch、弹球、蒙提霍尔等无关项目顶替。',
  '- 教学口径：理论必胜不等于学生能背出完整必胜谱。学生问「黑棋必胜下法」时，先说清上述结论，再引导用活三、冲四、双三等棋型练习攻防，或去上《五子棋博弈论入门》；不要声称「尚未证明」，也不要假装给出完整必胜棋谱。',
].join('\n')

/** 有课程 id 时强调必须用可点击的 [course:id|标题] 推荐。 */
export function formatGomokuCourseFact(courseId?: number | null) {
  if (typeof courseId !== 'number' || !Number.isFinite(courseId)) return GOMOKU_TUTOR_FACTS
  const tag = `[course:${courseId}|${GOMOKU_COURSE_TITLE}]`
  return [
    GOMOKU_TUTOR_FACTS,
    `- 课程入口标记：推荐五子棋课时必须原样写出 ${tag}（不要改名、不要改成普通链接）。`,
  ].join('\n')
}

export function shouldInjectGomokuFacts(input: {
  surface?: string | null
  courseTitle?: string | null
  courseTags?: string[] | null
  lessonGameKey?: string | null
}): boolean {
  if (input.surface === 'playground') return true
  if (input.lessonGameKey === 'gomoku') return true
  if (input.courseTitle?.trim() === GOMOKU_COURSE_TITLE) return true
  return (input.courseTags ?? []).some((tag) => {
    const normalized = typeof tag === 'string' ? tag.trim().toLowerCase() : ''
    return normalized === '五子棋' || normalized === 'gomoku'
  })
}

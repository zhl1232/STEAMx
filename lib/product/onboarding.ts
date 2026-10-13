/** Shared platform onboarding destinations and copy. Keep this independent of the brick-course mainline. */
export const PLATFORM_ONBOARDING_HREF = '/start'

export const PLATFORM_GUIDE_LINKS = [
  { href: '/learn/blocks', label: '积木与结构', description: '从动手搭建开始理解结构。' },
  { href: '/learn/scratch', label: 'Scratch 编程', description: '用积木代码做出互动作品。' },
  { href: '/learn/science', label: '科学实验', description: '提出问题，观察变化并验证。' },
  { href: '/learn/nature', label: '自然观察', description: '记录身边的植物、动物与季节。' },
  { href: '/pbl', label: '项目式学习', description: '围绕真实问题完成一段旅程。' },
  { href: '/playground', label: '游乐场', description: '在游戏和挑战中练习思考。' },
] as const

/** 注册落地只做方向选择；不要把 /learn 指南作为进入内容的必经步骤。 */
export const PLATFORM_START_ACTIONS = [
  { id: 'blocks', href: '/courses?category=brick', label: '搭积木', description: '看成品，选一个搭建。' },
  { id: 'science', href: '/explore?category=科学', label: '做小实验', description: '选一个想试的实验。' },
  { id: 'scratch', href: '/courses?category=programming', label: '学编程', description: '做动画或小游戏。' },
  { id: 'nature', href: '/nature', label: '去自然里观察', description: '看看身边的动植物。' },
] as const

/** 只接收已经支持的入门分类，数组或未知值不扩大筛选范围。 */
export function getStartCourseCategory(value: string | string[] | undefined) {
  return value === 'brick' || value === 'programming' ? value : 'recommended'
}

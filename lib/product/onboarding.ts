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

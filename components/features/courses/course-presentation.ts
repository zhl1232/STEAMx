/** Compact catalog copy; source titles and SEO metadata keep their full identity. */
export function courseDisplayTitle(title: string) {
  if (title === '五子棋博弈论入门') return '五子棋'
  return title.replace(/：从动画到作品$/, '')
}

export function courseDisplayDescription(course: { title: string; description?: string | null }) {
  if (['小班大颗粒积木', '中班大颗粒积木', '大班大颗粒积木'].includes(course.title)) {
    return '跟着动画与分步引导，动手搭建创意作品。'
  }
  if (courseDisplayTitle(course.title) === '五子棋') {
    return '学习攻防与连续威胁，在对弈中练习策略。'
  }
  if (courseDisplayTitle(course.title) === 'Scratch 创探编程') {
    return '从动画、故事到小游戏，动手创作自己的作品。'
  }
  return course.description
}

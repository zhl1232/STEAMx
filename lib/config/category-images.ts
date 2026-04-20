/**
 * 项目类别主题图片配置
 * 当用户未上传自定义封面时，根据项目类别使用对应的主题图片
 */

export const CATEGORY_THEME_IMAGES: Record<string, string> = {
  '科学': '/projects/science_physics.webp',
  '技术': '/projects/tech_programming.webp',
  '工程': '/projects/eng_mechanical.webp',
  '艺术': '/projects/art_painting.webp',
  '数学': '/projects/generated/project-0393.webp',
  '其他': '/projects/sensory_box.webp',
}

/**
 * 获取项目的封面图片
 * @param category - 项目类别
 * @param customImage - 用户自定义上传的图片URL（可选）
 * @returns 图片URL
 */
export function getProjectCoverImage(category: string, customImage?: string | null): string {
  // 优先使用用户上传的图片
  if (customImage) {
    return customImage
  }
  
  // 使用类别主题图片
  return CATEGORY_THEME_IMAGES[category] || CATEGORY_THEME_IMAGES['其他']
}

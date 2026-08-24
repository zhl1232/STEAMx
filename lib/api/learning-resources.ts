import { cache } from 'react'

import { createPublicClient } from '@/lib/supabase/server'
import { mapLearningResource, type LearningResource } from '@/lib/learning-resources'

const RESOURCE_COLUMNS =
  'id, title, summary, content_md, category, cover_image_url, status, created_at, updated_at'

/** 读取单张已发布资料卡（公开访问；React.cache 同请求去重） */
export const getPublishedLearningResource = cache(async function getPublishedLearningResource(
  id: number
): Promise<LearningResource | null> {
  const supabase = createPublicClient()

  const { data, error } = await supabase
    .from('learning_resources')
    .select(RESOURCE_COLUMNS)
    .eq('id', id)
    .eq('status', 'published')
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  return mapLearningResource(data)
})

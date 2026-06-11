import { NextRequest, NextResponse } from 'next/server'

import { TUTOR_CONTEXT_TYPES, type TutorContextType } from '@/lib/ai/tutor/types'
import { handleApiError, requireAuth } from '@/lib/api/auth'
import { createClient } from '@/lib/supabase/server'

const LIST_LIMIT = 20
const PREVIEW_LENGTH = 60
/** 预览扫描上限：单次 in 查询取回的用户消息行数，超长对话退化为无预览 */
const PREVIEW_SCAN_LIMIT = 400

/** 列出当前用户在指定场景下已归档的小迪对话线程（只读回看入口） */
export async function GET(request: NextRequest) {
  const supabase = await createClient()

  try {
    const user = await requireAuth(supabase)

    const searchParams = request.nextUrl.searchParams
    const contextTypeRaw = searchParams.get('contextType') || 'global'
    const contextType: TutorContextType = TUTOR_CONTEXT_TYPES.includes(contextTypeRaw as TutorContextType)
      ? (contextTypeRaw as TutorContextType)
      : 'global'
    const contextId = searchParams.get('contextId') || ''

    const { data, error } = await supabase
      .from('tutor_conversations')
      .select('id, title, created_at, archived_at')
      .eq('user_id', user.id)
      .eq('context_type', contextType)
      .eq('context_id', contextId)
      .eq('status', 'archived')
      .order('archived_at', { ascending: false })
      .limit(LIST_LIMIT)

    if (error) throw error
    const rows = data ?? []

    // 一次 in 查询取每条线程的首条用户消息作为预览，避免 N+1
    const previews = new Map<string, string>()
    if (rows.length > 0) {
      const { data: messageRows, error: messageError } = await supabase
        .from('tutor_messages')
        .select('conversation_id, content')
        .in('conversation_id', rows.map((row) => row.id))
        .eq('role', 'user')
        .order('id', { ascending: true })
        .limit(PREVIEW_SCAN_LIMIT)

      if (messageError) throw messageError
      for (const message of messageRows ?? []) {
        if (!previews.has(message.conversation_id)) {
          previews.set(message.conversation_id, message.content.slice(0, PREVIEW_LENGTH))
        }
      }
    }

    return NextResponse.json({
      conversations: rows.map((row) => ({
        id: row.id,
        title: row.title,
        preview: previews.get(row.id) ?? '',
        createdAt: row.created_at,
        archivedAt: row.archived_at,
      })),
    })
  } catch (error) {
    return handleApiError(error)
  }
}

import { NextRequest, NextResponse } from 'next/server'

import { handleApiError, requireAuth } from '@/lib/api/auth'
import { validateUUID } from '@/lib/api/validation'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/types'

const HISTORY_LIMIT = 200

type TutorMessageRow = Pick<
  Database['public']['Tables']['tutor_messages']['Row'],
  'role' | 'content' | 'images'
>

/** 只读回看：返回当前用户某条小迪对话线程的消息 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()

  try {
    const user = await requireAuth(supabase)
    const { id } = await params
    const conversationId = validateUUID(id, 'conversation id')

    const { data: conversation, error: conversationError } = await supabase
      .from('tutor_conversations')
      .select('id, title, status, created_at, archived_at')
      .eq('id', conversationId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (conversationError) throw conversationError
    if (!conversation) {
      return NextResponse.json({ error: '对话不存在' }, { status: 404 })
    }

    // 降序取最新 N 条再反转，与进行中对话的加载逻辑一致
    const { data: messageRows, error: messagesError } = await supabase
      .from('tutor_messages')
      .select('role, content, images')
      .eq('conversation_id', conversation.id)
      .order('id', { ascending: false })
      .limit(HISTORY_LIMIT)

    if (messagesError) throw messagesError

    const messages = ((messageRows ?? []) as TutorMessageRow[]).reverse().map((row) => ({
      role: row.role as 'user' | 'assistant',
      content: row.content,
      images: row.images ?? undefined,
    }))

    return NextResponse.json({
      conversation: {
        id: conversation.id,
        title: conversation.title,
        status: conversation.status,
        createdAt: conversation.created_at,
        archivedAt: conversation.archived_at,
      },
      messages,
    })
  } catch (error) {
    return handleApiError(error)
  }
}

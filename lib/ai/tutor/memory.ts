import type { SupabaseClient } from '@supabase/supabase-js'

import { summarizeConversationWindow, summarizeNotebook } from '@/lib/ai/tutor/engine'
import { supabaseAdmin } from '@/lib/supabase/admin'
import type { Database } from '@/lib/supabase/types'

export const MEMORY_SUMMARY_THRESHOLD = 12

/** 会话上下文窗口条数：与 chat route 的 CONTEXT_TURNS 保持一致 */
export const CONVERSATION_CONTEXT_WINDOW = 12
/** 至少积累这么多条窗口外消息才触发一次会话摘要，避免每回合都调一次模型 */
export const CONVERSATION_SUMMARY_MIN_BATCH = 4

/**
 * 用户级 notebook 字数上限按累计消息量放宽：
 * 活跃学生积累的偏好、项目线索更多，600 字装不下。
 */
export function resolveNotebookCharLimit(totalMessages: number) {
  if (totalMessages >= 800) return 1200
  if (totalMessages >= 300) return 900
  return 600
}

export async function loadTutorNotebook(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('tutor_notebooks')
    .select('content')
    .eq('user_id', userId)
    .maybeSingle()

  return data?.content?.trim() || null
}

export async function maybeUpdateTutorNotebook(userId: string) {
  if (!supabaseAdmin) return

  const { data: notebook } = await supabaseAdmin
    .from('tutor_notebooks')
    .select('content, last_message_id')
    .eq('user_id', userId)
    .maybeSingle()

  const lastId = notebook?.last_message_id ?? 0

  const { data: newMessages, error } = await supabaseAdmin
    .from('tutor_messages')
    .select('id, role, content')
    .eq('user_id', userId)
    .gt('id', lastId)
    .order('id', { ascending: true })
    .limit(50)

  if (error || !newMessages || newMessages.length < MEMORY_SUMMARY_THRESHOLD) return

  const latestId = newMessages[newMessages.length - 1]?.id
  if (!latestId) return

  try {
    // 只在确定要摘要时才数总量，按活跃度决定 notebook 容量
    const { count: totalMessages } = await supabaseAdmin
      .from('tutor_messages')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
    const charLimit = resolveNotebookCharLimit(totalMessages ?? 0)

    const summary = await summarizeNotebook(
      notebook?.content ?? '',
      newMessages.map((m) => ({ role: m.role, content: m.content })),
      charLimit,
    )
    const updatedAt = new Date().toISOString()

    if (notebook) {
      // 乐观并发：只有 last_message_id 仍是本次读取时的值才写入。
      // 多个请求同时触发摘要时，后完成的一方直接放弃，避免互相覆盖或倒退。
      const update = supabaseAdmin
        .from('tutor_notebooks')
        .update({
          content: summary,
          last_message_id: latestId,
          updated_at: updatedAt,
        } as never)
        .eq('user_id', userId)
      await (notebook.last_message_id == null
        ? update.is('last_message_id', null)
        : update.eq('last_message_id', notebook.last_message_id))
    } else {
      // 首次创建：并发时主键冲突直接忽略，让先到者生效。
      await supabaseAdmin.from('tutor_notebooks').upsert(
        {
          user_id: userId,
          content: summary,
          last_message_id: latestId,
          updated_at: updatedAt,
        } as never,
        { onConflict: 'user_id', ignoreDuplicates: true },
      )
    }
  } catch {
    // 静默失败，不影响主流程
  }
}

/**
 * 会话级滚动摘要：把滑出上下文窗口（最近 CONVERSATION_CONTEXT_WINDOW 条）的
 * 早期消息折叠进 tutor_conversations.summary。回复落库后在 after() 里调用。
 */
export async function maybeUpdateTutorConversationSummary(conversationId: string, userId: string) {
  if (!supabaseAdmin) return

  const { data: conversation } = await supabaseAdmin
    .from('tutor_conversations')
    .select('summary, summary_message_id')
    .eq('id', conversationId)
    .eq('user_id', userId)
    .maybeSingle()

  if (!conversation) return

  const anchor = conversation.summary_message_id ?? 0
  const { data: rows, error } = await supabaseAdmin
    .from('tutor_messages')
    .select('id, role, content')
    .eq('conversation_id', conversationId)
    .gt('id', anchor)
    .order('id', { ascending: true })
    .limit(80)

  if (error || !rows) return

  // 只折叠已经滑出窗口的部分；窗口内消息仍会原文进 prompt，不重复摘要。
  const overflow = rows.length - CONVERSATION_CONTEXT_WINDOW
  if (overflow < CONVERSATION_SUMMARY_MIN_BATCH) return

  const toFold = rows.slice(0, overflow)
  const latestFoldedId = toFold[toFold.length - 1]?.id
  if (!latestFoldedId) return

  try {
    const summary = await summarizeConversationWindow(
      conversation.summary ?? '',
      toFold.map((m) => ({ role: m.role, content: m.content })),
    )
    if (!summary.trim()) return

    // 乐观并发：锚点变了说明别的请求已经折叠过，放弃本次写入。
    const update = supabaseAdmin
      .from('tutor_conversations')
      .update({
        summary,
        summary_message_id: latestFoldedId,
      } as never)
      .eq('id', conversationId)
    await (conversation.summary_message_id == null
      ? update.is('summary_message_id', null)
      : update.eq('summary_message_id', conversation.summary_message_id))
  } catch {
    // 静默失败，不影响主流程
  }
}

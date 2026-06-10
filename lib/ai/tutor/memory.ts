import type { SupabaseClient } from '@supabase/supabase-js'

import { summarizeNotebook } from '@/lib/ai/tutor/engine'
import { supabaseAdmin } from '@/lib/supabase/admin'
import type { Database } from '@/lib/supabase/types'

export const MEMORY_SUMMARY_THRESHOLD = 12

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
    const summary = await summarizeNotebook(
      notebook?.content ?? '',
      newMessages.map((m) => ({ role: m.role, content: m.content })),
    )

    await supabaseAdmin.from('tutor_notebooks').upsert({
      user_id: userId,
      content: summary,
      last_message_id: latestId,
      updated_at: new Date().toISOString(),
    } as never)
  } catch {
    // 静默失败，不影响主流程
  }
}

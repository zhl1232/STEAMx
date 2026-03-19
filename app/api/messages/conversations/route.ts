import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, handleApiError } from '@/lib/api/auth'

type ConversationItem = {
  peerId: string
  displayName: string | null
  avatarUrl: string | null
  lastContent: string
  lastAt: string
}

export async function GET() {
  const supabase = await createClient()

  try {
    const user = await requireAuth(supabase)

    type MsgRow = { sender_id: string; receiver_id: string; content: string; created_at: string }
    const rows: MsgRow[] = []
    const batchSize = 200
    let offset = 0

    while (true) {
      const { data: batch, error: msgError } = await supabase
        .from('messages')
        .select('id, sender_id, receiver_id, content, created_at')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: false })
        .range(offset, offset + batchSize - 1)

      if (msgError) throw msgError

      const typedBatch = (batch || []) as MsgRow[]
      if (typedBatch.length === 0) break

      rows.push(...typedBatch)

      if (typedBatch.length < batchSize) break
      offset += batchSize
    }

    if (rows.length === 0) return NextResponse.json({ conversations: [] })

    const peerIds = new Set<string>()
    const latestByPeer = new Map<string, { content: string; created_at: string }>()
    for (const m of rows) {
      const peer = m.sender_id === user.id ? m.receiver_id : m.sender_id
      if (peerIds.has(peer)) continue
      peerIds.add(peer)
      latestByPeer.set(peer, { content: m.content, created_at: m.created_at })
    }

    const ids = Array.from(peerIds)
    const { data: profiles, error: profError } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url')
      .in('id', ids)

    if (profError) throw profError
    type ProfRow = { id: string; display_name: string | null; avatar_url: string | null }
    const profileMap = new Map(
      ((profiles || []) as ProfRow[]).map((p) => [
        p.id,
        { displayName: p.display_name, avatarUrl: p.avatar_url },
      ])
    )

    const conversations: ConversationItem[] = ids
      .map((peerId) => {
        const last = latestByPeer.get(peerId)
        const prof = profileMap.get(peerId)
        if (!last) return null
        return {
          peerId,
          displayName: prof?.displayName ?? null,
          avatarUrl: prof?.avatarUrl ?? null,
          lastContent: last.content,
          lastAt: last.created_at,
        }
      })
      .filter((x): x is ConversationItem => x !== null)
      .sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime())

    return NextResponse.json({ conversations })
  } catch (error) {
    return handleApiError(error)
  }
}

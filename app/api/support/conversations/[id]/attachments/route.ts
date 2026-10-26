import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { handleApiError } from '@/lib/api/auth'
import { requireRateLimit } from '@/lib/api/rate-limit'
import { conversationFor, supportSession } from '@/lib/support/server'
import { imageMime, SupportError } from '@/lib/support/validation'
import type { ConversationRoute } from '@/lib/support/handlers'
export async function POST(request: NextRequest, route: ConversationRoute) {
  try {
    const ctx = await supportSession()
    const conversation = await conversationFor(ctx, (await route.params).id)
    await requireRateLimit(ctx.session,{key:'support-upload',limit:12,windowMs:60_000})
    // Raw bytes keep the body bounded even for chunked requests; MIME is detected from content.
    const reader = request.body?.getReader()
    if (!reader) throw new SupportError('请选择图片')
    const chunks: Uint8Array[]=[]; let size=0
    try {
      for (;;) {
        const {done,value}=await reader.read()
        if (done) break
        size+=value.byteLength
        if(size>5*1024*1024) { await reader.cancel(); throw new SupportError('图片不能超过 5 MB') }
        chunks.push(value)
      }
    } finally { reader.releaseLock() }
    const bytes=Buffer.concat(chunks)
    const mime=imageMime(bytes)
    const id=randomUUID(); const path=`${conversation.id}/${id}`
    const upload=await ctx.db.storage.from('support-private').upload(path,bytes,{contentType:mime,upsert:false})
    if(upload.error) throw upload.error
    const inserted=await ctx.db.from('support_attachments').insert({id,conversation_id:conversation.id,uploader_id:ctx.user.id,storage_path:path,mime_type:mime,size_bytes:size}).select('id,mime_type,size_bytes').single()
    if(inserted.error) { await ctx.db.storage.from('support-private').remove([path]); throw inserted.error }
    return NextResponse.json({attachment:inserted.data})
  } catch(error) { return handleApiError(error) }
}

import { NextRequest, NextResponse } from 'next/server'
import { handleApiError } from '@/lib/api/auth'
import { conversationFor, supportSession } from '@/lib/support/server'
import { SupportError, uuid } from '@/lib/support/validation'
export async function GET(request: NextRequest, route: {params:Promise<{id:string}>}) {
  try {
    const ctx=await supportSession(request.nextUrl.searchParams.get('staff')==='1')
    const result=await ctx.db.from('support_attachments').select('conversation_id,storage_path,message_id,uploader_id').eq('id',uuid((await route.params).id)).maybeSingle()
    if(result.error) throw result.error
    if(!result.data) throw new SupportError('图片不存在',404)
    await conversationFor(ctx,result.data.conversation_id)
    if(!result.data.message_id && result.data.uploader_id!==ctx.user.id) throw new SupportError('图片不存在',404)
    const signed=await ctx.db.storage.from('support-private').createSignedUrl(result.data.storage_path,60)
    if(signed.error) throw signed.error
    return NextResponse.redirect(signed.data.signedUrl,{status:302,headers:{'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'}})
  } catch(error) { return handleApiError(error) }
}

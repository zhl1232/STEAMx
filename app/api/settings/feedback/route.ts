import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { handleApiError } from '@/lib/api/auth'
import { ownConversation,sendSupportMessage,supportSession } from '@/lib/support/server'
export async function POST(request:NextRequest) {
  try {
    const ctx=await supportSession()
    const body=await request.json()
    const conversation=await ownConversation(ctx,'platform')
    await sendSupportMessage(ctx,conversation,{content:body.content,clientId:body.clientId ?? randomUUID()})
    return NextResponse.json({success:true,recipientName:'平台帮助',href:'/support'})
  } catch(error) { return handleApiError(error) }
}

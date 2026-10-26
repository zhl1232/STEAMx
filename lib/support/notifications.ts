import 'server-only'
import { createHmac } from 'node:crypto'
import { supportDb } from './server'
import { feishuHealth } from './feishu/config'

function notificationConfig() {
  const webhook=process.env.SUPPORT_FEISHU_WEBHOOK?.trim()
  const secret=process.env.SUPPORT_FEISHU_SECRET?.trim()
  const site=process.env.SUPPORT_SITE_URL?.trim()
  try {
    if (!webhook || !secret || !site) return null
    const url=new URL(webhook); const origin=new URL(site)
    if(url.protocol!=='https:' || url.hostname!=='open.feishu.cn' || !url.pathname.startsWith('/open-apis/bot/v2/hook/') || url.username || url.password || origin.protocol!=='https:' || origin.username || origin.password) return null
    return {webhook,secret,origin:origin.origin}
  } catch { return null }
}
export function supportNotificationHealth() {
  if (process.env.FEISHU_BRIDGE_ENABLED === 'true') return { configured: feishuHealth().configured }
  return { configured:Boolean(notificationConfig()) }
}
export function feishuSignature(timestamp: string, secret: string) {
  return createHmac('sha256',`${timestamp}\n${secret}`).update('').digest('base64')
}
export async function runSupportNotifications() {
  // The app bridge owns delivery when enabled; do not also send legacy webhooks.
  if (process.env.FEISHU_BRIDGE_ENABLED === 'true') return {disabled:true,sent:0,failed:0}
  const config=notificationConfig()
  if(!config) return {disabled:true, sent:0, failed:0}
  const db=supportDb()
  const claimed=await db.rpc('support_claim_notifications',{p_limit:10})
  if(claimed.error) throw claimed.error
  let sent=0,failed=0
  const jobs = (claimed.data ?? []) as {conversation_id:string;message_seq:number;lease_id:string;attempts:number}[]
  await Promise.all(jobs.map(async job => {
    try {
      const timestamp=String(Math.floor(Date.now()/1000))
      const response=await fetch(config.webhook,{method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(8000),redirect:'error',body:JSON.stringify({timestamp,sign:feishuSignature(timestamp,config.secret),msg_type:'text',content:{text:`创探空间客服收到新咨询，请在管理后台查看并回复。\n${config.origin}/admin/support?conversation=${job.conversation_id}`}})})
      const result=await response.json()
      if(!response.ok || result.code!==0) throw new Error('delivery_failed')
      // A newer message may have arrived during delivery; only acknowledge this generation.
      const ack=await db.from('support_notification_outbox').update({delivered_at:new Date().toISOString(),lease_id:null,lease_until:null,last_error:null}).eq('conversation_id',job.conversation_id).eq('lease_id',job.lease_id).eq('message_seq',job.message_seq)
      if(ack.error) throw ack.error
      const release=await db.from('support_notification_outbox').update({lease_id:null,lease_until:null,available_at:new Date(Date.now()+30_000).toISOString()}).eq('conversation_id',job.conversation_id).eq('lease_id',job.lease_id)
      if(release.error) throw release.error
      sent++
    } catch {
      failed++
      const retry=await db.from('support_notification_outbox').update({lease_id:null,lease_until:null,last_error:'delivery_failed',available_at:new Date(Date.now()+Math.min(3600,30*2**Math.min(job.attempts,7))*1000).toISOString()}).eq('conversation_id',job.conversation_id).eq('lease_id',job.lease_id)
      if(retry.error) throw retry.error
    }
  }))
  return {disabled:false,sent,failed}
}

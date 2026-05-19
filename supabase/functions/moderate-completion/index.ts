/**
 * Supabase Edge Function: 探索记录 AI 审核
 * 由 Database Webhook 在 completed_projects INSERT (status=pending) 时调用。
 *
 * 部署后在 Supabase Dashboard → Edge Functions → Secrets 配置：
 * - APP_URL（站点根 URL，如 https://steamx.cc）
 * - CRON_SECRET（与 Next.js 环境变量相同）
 */
/// <reference path="../deno-global.d.ts" />

Deno.serve(async (req: Request) => {
  try {
    const payload = await req.json()
    const record = payload?.record ?? payload?.new ?? payload
    const completionId = Number(record?.id)

    if (!Number.isInteger(completionId) || completionId <= 0) {
      return new Response(JSON.stringify({ error: 'Invalid completion id' }), { status: 400 })
    }

    const appUrl = Deno.env.get('APP_URL') || Deno.env.get('NEXT_PUBLIC_APP_URL')
    const secret = Deno.env.get('CRON_SECRET') || Deno.env.get('INTERNAL_API_SECRET')

    if (!appUrl || !secret) {
      return new Response(JSON.stringify({ error: 'Missing APP_URL or CRON_SECRET' }), { status: 500 })
    }

    const response = await fetch(`${appUrl.replace(/\/$/, '')}/api/internal/moderate-completion`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({ completionId }),
    })

    const text = await response.text()
    return new Response(text, {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500 },
    )
  }
})

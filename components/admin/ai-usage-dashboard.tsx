'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { getApiErrorMessage } from '@/lib/utils/http'

type UsageDaily = {
  day: string
  chats: number
  creditsUsed: number
  freeChats: number
  memberChats: number
}

type TopUser = {
  userId: string
  displayName: string
  chats: number
  creditsUsed: number
}

export function AiUsageDashboard() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [daily, setDaily] = useState<UsageDaily[]>([])
  const [totals, setTotals] = useState({ chats: 0, creditsUsed: 0, freeChats: 0, memberChats: 0 })
  const [topUsers, setTopUsers] = useState<TopUser[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/ai-usage')
      if (!res.ok) throw new Error(await getApiErrorMessage(res, '加载失败'))
      const payload = await res.json()
      setDaily(payload.daily ?? [])
      setTotals(payload.totals ?? { chats: 0, creditsUsed: 0, freeChats: 0, memberChats: 0 })
      setTopUsers(payload.topUsers ?? [])
    } catch (error) {
      toast({
        title: '加载 AI 用量失败',
        description: error instanceof Error ? error.message : '请稍后重试',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div>
          <CardTitle>AI 导师用量看板</CardTitle>
          <CardDescription>近 30 天对话与代币消耗（基于 ai_credit_logs）</CardDescription>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1.5 h-4 w-4" />}
          刷新
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-4">
          <Stat label="总对话" value={totals.chats} />
          <Stat label="代币消耗" value={totals.creditsUsed} />
          <Stat label="免费次数" value={totals.freeChats} />
          <Stat label="会员钱包扣减" value={totals.memberChats} />
        </div>

        <div>
          <h4 className="mb-2 text-sm font-semibold">每日用量</h4>
          <div className="max-h-64 overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>日期</TableHead>
                  <TableHead className="text-right">对话</TableHead>
                  <TableHead className="text-right">代币</TableHead>
                  <TableHead className="text-right">免费</TableHead>
                  <TableHead className="text-right">会员</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {daily.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      暂无数据
                    </TableCell>
                  </TableRow>
                ) : (
                  daily.map((row) => (
                    <TableRow key={row.day}>
                      <TableCell>{row.day}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.chats}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.creditsUsed}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.freeChats}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.memberChats}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <div>
          <h4 className="mb-2 text-sm font-semibold">Top 10 用户</h4>
          <div className="overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>用户</TableHead>
                  <TableHead className="text-right">对话</TableHead>
                  <TableHead className="text-right">代币消耗</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      暂无数据
                    </TableCell>
                  </TableRow>
                ) : (
                  topUsers.map((user) => (
                    <TableRow key={user.userId}>
                      <TableCell>{user.displayName}</TableCell>
                      <TableCell className="text-right tabular-nums">{user.chats}</TableCell>
                      <TableCell className="text-right tabular-nums">{user.creditsUsed}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[var(--radius-sm)] border bg-[hsl(var(--surface-muted)/0.4)] px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
    </div>
  )
}

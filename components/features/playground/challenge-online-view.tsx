"use client"

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/lib/context/auth-context'
import { useChallenge, type ChallengeGame } from '@/hooks/playground/use-challenge'
import { MEMORY_LEVEL_THEMES } from '@/lib/playground/memory-levels'
import { GomokuBoard } from './gomoku-board'

function seconds(value: number) { return Math.max(0, Math.ceil(value / 1000)) }
function clock(value: number) { const s = seconds(value); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` }

export function ChallengeOnlineView({ game, initialRoomCode, onLegacyRoom }: { game: ChallengeGame; initialRoomCode?: string | null; onLegacyRoom?: () => void }) {
  const { user } = useAuth()
  const online = useChallenge(game, Boolean(user))
  const { challenge, busy, error, command, action } = online
  const [code, setCode] = useState('')
  const [theme, setTheme] = useState('optics')
  const [pairCount, setPairCount] = useState(6)
  const [now, setNow] = useState(() => Date.now())
  const [copied, setCopied] = useState(false)
  const joined = useRef(false)
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 200); return () => clearInterval(timer) }, [])
  useEffect(() => {
    if (!user || !initialRoomCode || joined.current) return
    joined.current = true
    void command('join', { code: initialRoomCode })
  }, [command, initialRoomCode, user])
  useEffect(() => {
    if (challenge?.status !== 'ready' || challenge.myReady || busy) return
    const timer = setTimeout(() => void action('ready'), 500)
    return () => clearTimeout(timer)
  }, [action, busy, challenge])
  if (!user) return <div className="space-y-4 rounded-xl border p-5 text-center"><p>登录后邀请好友或参加随机挑战</p><Button asChild><Link href={`/login?next=${encodeURIComponent(`/playground/${game === 'memory' ? 'memory' : 'gomoku'}${initialRoomCode ? `?room=${initialRoomCode}` : ''}`)}`}>去登录</Link></Button></div>
  const serverNow = now + online.clockOffset
  const active = challenge && ['ready', 'starting', 'playing'].includes(challenge.status)
  const waiting = challenge?.status === 'waiting'
  const finished = challenge && ['finished', 'cancelled', 'void'].includes(challenge.status)
  const elapsed = challenge?.createdAt ? serverNow - challenge.createdAt : 0
  const countdown = Math.max(0, 3 - Math.floor(elapsed / 1000))
  const state = challenge?.state || {}
  const cards = (state.cards || []) as Array<{ id: string; label?: string; face?: string; matched: boolean; open?: boolean }>
  const firstPlayer = Number(state.firstPlayer ?? 0)
  const playerIndex = challenge?.myRole === 'guest' ? 1 : 0
  const board = ((state.board || []) as Array<Array<number | null>>).map((line, row) => line.map((value, col) => ({ row, col, value: value === null ? null : value === firstPlayer ? 'black' as const : 'white' as const })))
  const clocks = (state.remainingMs || [120000, 120000]) as number[]
  const turnDeadline = Number(state.turnDeadlineAt || 0)
  const isMyTurn = Number(state.currentTurn) === playerIndex
  const displayedClock = (index: number) => clock(clocks[index] - (canPlaySnapshot() && Number(state.currentTurn) === index ? Math.max(0, serverNow - (challenge?.serverNow || serverNow)) : 0))
  function canPlaySnapshot() { return challenge?.status === 'playing' && (!challenge.startAt || serverNow >= challenge.startAt) }
  const canPlay = challenge?.status === 'playing' && (!challenge.startAt || serverNow >= challenge.startAt)
  const result = challenge?.status === 'cancelled' ? '房间已取消' : challenge?.status === 'void' ? '对局已作废，报名费已退还' : challenge?.winner === 'draw' ? '平局，报名费已退还' : challenge?.winner === challenge?.myRole ? '你获胜了！' : '对手获胜'
  return <div className="mx-auto w-full max-w-3xl space-y-4">
    {error && <div role="alert" className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive">{error}{onLegacyRoom && initialRoomCode && error === '房间不存在' && <Button variant="link" onClick={onLegacyRoom}>恢复旧版房间</Button>}</div>}
    {!challenge && <div className="space-y-5 rounded-xl border bg-card p-5">
      <div><h2 className="font-semibold">在线{game === 'memory' ? '竞速' : '对战'}</h2><p className="mt-1 text-sm text-muted-foreground">{game === 'memory' ? '同时翻自己的牌，先配完者获胜；限时 2 分钟。' : '每方 2 分钟，每步 20 秒，超时判负。'}</p></div>
      <div className="space-y-2"><Button disabled={busy || online.remaining <= 0} onClick={() => void command('queue')} className="w-full">随机挑战 · 2 硬币</Button><p className="text-center text-xs text-muted-foreground">今日剩余 {online.remaining}/5 局 · 获胜到账 3 硬币</p></div>
      <div className="space-y-3 border-t pt-4"><h3 className="text-sm font-medium">邀请好友 · 免费</h3>
      {game === 'memory' && <div className="flex flex-wrap gap-2"><select aria-label="主题" className="min-h-11 rounded-md border bg-background px-2" value={theme} onChange={e => setTheme(e.target.value)}>{MEMORY_LEVEL_THEMES.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select><select aria-label="配对数量" className="min-h-11 rounded-md border bg-background px-2" value={pairCount} onChange={e => setPairCount(Number(e.target.value))}>{[4, 6, 8].map(n => <option key={n} value={n}>{n} 对</option>)}</select></div>}
      <Button variant="outline" disabled={busy} onClick={() => void command('invite', { theme, pairCount })}>创建房间</Button>
      <div className="flex gap-2"><Input aria-label="房间码" placeholder="输入 6 位房间码" value={code} maxLength={6} onChange={e => setCode(e.target.value.toUpperCase())}/><Button variant="outline" disabled={busy || code.trim().length !== 6} onClick={() => void command('join', { code: code.trim() })}>加入</Button></div></div>
    </div>}
    {waiting && <div className="space-y-4 rounded-xl border p-5 text-center">
      {challenge.mode === 'invite' ? <><p>邀请好友加入</p><p className="text-2xl font-bold tracking-widest">{challenge.code}</p><Button variant="outline" onClick={async () => { try { await navigator.clipboard.writeText(`${location.origin}/playground/${game === 'memory' ? 'memory' : 'gomoku'}?room=${challenge.code}`); setCopied(true) } catch { setCopied(false) } }}>{copied ? '已复制邀请链接' : '复制邀请链接'}</Button></> : <><p role="status">{countdown > 0 ? `寻找对手 · ${countdown}` : '暂时没有玩家'}</p>{countdown === 0 && <><Button disabled={busy} onClick={() => void command('bot')}>挑战电脑 · 2 硬币</Button><p className="text-xs text-muted-foreground">也可以继续等待真人</p></>}</>}
      <div><Button variant="ghost" disabled={busy} onClick={() => void action('cancel')}>取消</Button></div>
    </div>}
    {(active || finished) && challenge && <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm"><span>{challenge.opponentKind === 'computer' ? `电脑 · 难度 ${challenge.botLevel || state.level || ''}` : '好友 / 真人对手'}</span><span>{challenge.startAt && serverNow < challenge.startAt ? '准备开始…' : challenge.status === 'ready' ? '等待双方就绪…' : game === 'memory' && challenge.deadlineAt ? `剩余 ${clock(challenge.deadlineAt - serverNow)}` : ''}</span></div>
      {game === 'memory' ? <><div className="flex justify-between text-sm"><span>你：{Number(state.myPairs || 0)}/{Number(state.pairCount || pairCount)} 对</span><span>对手：{Number(state.opponentPairs || 0)} 对</span></div><div className="grid grid-cols-4 gap-2">{cards.map((card, index) => <button key={card.id} aria-label={card.open || card.matched ? card.label : `第 ${index + 1} 张牌`} disabled={!canPlay || busy || serverNow < Number(state.nextActionAt || 0) || card.matched || card.open} onClick={() => void action('flip', { cardId: card.id })} className={`min-h-24 rounded-xl border p-2 text-sm ${card.matched ? 'border-primary/30 bg-primary/10' : card.open ? 'bg-card' : 'bg-primary text-primary-foreground'}`}>{card.open || card.matched ? card.label : '?'}</button>)}</div></> : <><div className="text-sm">{isMyTurn ? '轮到你落子' : '等待对手落子'} · 本步 {seconds(turnDeadline - serverNow)} 秒 · 你 {displayedClock(playerIndex)} / 对手 {displayedClock(1 - playerIndex)}</div><GomokuBoard board={board} disabled={!canPlay || busy || !isMyTurn} onCellClick={(row, col) => void action('move', { row, col })}/></>}
      {finished ? <div className="space-y-3 rounded-xl bg-muted p-4 text-center"><p className="font-semibold">{result}</p><Button onClick={online.reset}>返回大厅</Button></div> : <Button variant="outline" disabled={busy} onClick={() => void action('resign')}>认输退出</Button>}
    </div>}
  </div>
}

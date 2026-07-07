'use client'

import { useCallback, useEffect, useState } from 'react'

import { XIAODI_STATES, XiaoDi, type XiaoDiState, type XiaoDiVariant } from '@/components/features/tutor/xiaodi'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const STATE_INFO: Record<XiaoDiState, { label: string; duration: string; note: string }> = {
  idle: { label: 'idle 待命', duration: '≈3.4s/轮', note: '呼吸、姿势轻换、叶子随帧轻晃' },
  listening: { label: 'listening 倾听', duration: '≈1.8s/轮', note: '前倾、举放大镜' },
  thinking: { label: 'thinking 思考', duration: '≈2.3s/轮', note: '托下巴、眼睛上看、左右轻晃' },
  speaking: { label: 'speaking 讲解', duration: '≈1.7s/轮', note: '抬手讲解、点头起伏' },
  success: { label: 'success 成功', duration: '≈1s/轮', note: '跳起、竖拇指、亮一下' },
  error: { label: 'error 困惑', duration: '≈1s/轮', note: '歪头、摊手、挠头' },
  working: { label: 'working 操作', duration: '≈2s/轮', note: '点全息面板' },
}

const AI_DRAFT_DURATION: Partial<Record<XiaoDiState, string>> = {
  idle: 'AI≈3.6s/轮',
  listening: 'AI≈2.4s/轮',
  thinking: 'AI≈2.8s/轮',
  speaking: 'AI≈2.8s/轮',
  success: 'AI≈1.5s/轮',
  error: 'AI≈1.8s/轮',
  working: 'AI≈2.6s/轮',
}

export function XiaoDiPreviewClient() {
  const [state, setState] = useState<XiaoDiState>('idle')
  const [autoPlay, setAutoPlay] = useState(false)
  const [darkPanel, setDarkPanel] = useState(false)
  const [transientDemo, setTransientDemo] = useState(false)
  const [frameVariant, setFrameVariant] = useState<XiaoDiVariant>('ai-draft')

  useEffect(() => {
    if (!autoPlay) return
    const timer = setInterval(() => {
      setState((prev) => {
        const index = XIAODI_STATES.indexOf(prev)
        return XIAODI_STATES[(index + 1) % XIAODI_STATES.length]
      })
    }, 3600)
    return () => clearInterval(timer)
  }, [autoPlay])

  // 演示 success/error 播完一轮自动回 idle 的接法
  const handleCycleEnd = useCallback(
    (finished: XiaoDiState) => {
      if (!transientDemo) return
      if (finished === 'success' || finished === 'error') {
        setState('idle')
      }
    },
    [transientDemo],
  )

  return (
    <div className="min-h-screen bg-background text-foreground p-6 md:p-10 space-y-8 max-w-5xl mx-auto">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold">小迪动画预览</h1>
        <p className="text-sm text-muted-foreground">
          默认使用全状态 AI 8 帧候选；可切回原版 4 帧逐帧播放做对比。AI 候选帧统一从
          public/xiaodi-ai 读取。
        </p>
      </header>

      <section className="flex flex-wrap gap-2">
        {XIAODI_STATES.map((s) => (
          <Button
            key={s}
            size="sm"
            variant={state === s && !autoPlay ? 'default' : 'outline'}
            onClick={() => {
              setAutoPlay(false)
              setState(s)
            }}
          >
            {STATE_INFO[s].label}
          </Button>
        ))}
        <Button size="sm" variant={autoPlay ? 'default' : 'outline'} onClick={() => setAutoPlay((v) => !v)}>
          自动轮播
        </Button>
        <Button size="sm" variant={transientDemo ? 'default' : 'outline'} onClick={() => setTransientDemo((v) => !v)}>
          success/error 播一轮回 idle
        </Button>
        <Button size="sm" variant="outline" onClick={() => setDarkPanel((v) => !v)}>
          切换深/浅底
        </Button>
        <Button
          size="sm"
          variant={frameVariant === 'ai-draft' ? 'default' : 'outline'}
          onClick={() => setFrameVariant((value) => (value === 'ai-draft' ? 'default' : 'ai-draft'))}
        >
          {frameVariant === 'ai-draft' ? 'AI 8帧' : '原版4帧'}
        </Button>
      </section>

      <section
        className={cn(
          'rounded-md border p-8 flex flex-wrap items-end justify-center gap-10 transition-colors',
          darkPanel ? 'bg-slate-900' : 'bg-teal-50',
        )}
      >
        <div className="flex flex-col items-center gap-2">
          <XiaoDi state={state} size={96} variant={frameVariant} onCycleEnd={handleCycleEnd} />
          <span className={cn('text-xs', darkPanel ? 'text-slate-300' : 'text-slate-600')}>96px（悬浮球）</span>
        </div>
        <div className="flex flex-col items-center gap-2">
          <XiaoDi state={state} size={180} variant={frameVariant} onCycleEnd={handleCycleEnd} />
          <span className={cn('text-xs', darkPanel ? 'text-slate-300' : 'text-slate-600')}>180px（对话面板）</span>
        </div>
        <div className="flex flex-col items-center gap-2">
          <XiaoDi state={state} size={280} variant={frameVariant} onCycleEnd={handleCycleEnd} />
          <span className={cn('text-xs', darkPanel ? 'text-slate-300' : 'text-slate-600')}>280px（引导页）</span>
        </div>
      </section>

      <section className="text-sm">
        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-muted/60">
              <tr>
                <th className="px-3 py-2 font-medium">状态</th>
                <th className="px-3 py-2 font-medium">一轮时长</th>
                <th className="px-3 py-2 font-medium">动效</th>
              </tr>
            </thead>
            <tbody>
              {XIAODI_STATES.map((s) => (
                <tr
                  key={s}
                  className={cn('border-t cursor-pointer hover:bg-muted/40', state === s && 'bg-muted/50')}
                  onClick={() => {
                    setAutoPlay(false)
                    setState(s)
                  }}
                >
                  <td className="px-3 py-2 font-mono">{s}</td>
                  <td className="px-3 py-2">{frameVariant === 'ai-draft' ? (AI_DRAFT_DURATION[s] ?? STATE_INFO[s].duration) : STATE_INFO[s].duration}</td>
                  <td className="px-3 py-2 text-muted-foreground">{STATE_INFO[s].note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

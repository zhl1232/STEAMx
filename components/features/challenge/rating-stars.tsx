"use client"

import { useState } from 'react'
import { Star } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { useLoginPrompt } from '@/lib/context/login-prompt-context'
import { cn } from '@/lib/utils'
import {
  getApiErrorMessageFromPayload,
  getApiErrorPayload,
  getInteractionAccessRedirect,
  isAgeConfirmationRequired,
} from '@/lib/utils/http'

interface RatingStarsProps {
  submissionId: number
  initialRating?: {
    creativeExpression: number
    completionQuality: number
    evidenceCompleteness: number
    reflectionDepth: number
  } | null
  disabled?: boolean
  onRated?: () => void
}

const DIMENSIONS = [
  { key: 'creativeExpression', label: '创意表达', hint: '想法是否鲜明' },
  { key: 'completionQuality', label: '完成质量', hint: '完成是否扎实' },
  { key: 'evidenceCompleteness', label: '证据完整度', hint: '材料是否充分' },
  { key: 'reflectionDepth', label: '反思深度', hint: '总结是否有洞察' },
]

const SCORE_LABEL: Record<number, string> = {
  1: '待完善',
  2: '一般',
  3: '不错',
  4: '很好',
  5: '很强',
}

export function RatingStars({ submissionId, initialRating, disabled, onRated }: RatingStarsProps) {
  const [ratings, setRatings] = useState<Record<string, number>>({
    creativeExpression: initialRating?.creativeExpression || 0,
    completionQuality: initialRating?.completionQuality || 0,
    evidenceCompleteness: initialRating?.evidenceCompleteness || 0,
    reflectionDepth: initialRating?.reflectionDepth || 0,
  })
  const [hovering, setHovering] = useState<Record<string, number>>({})
  const [submitting, setSubmitting] = useState(false)
  const { toast } = useToast()
  const { runAfterAgeConfirmation } = useLoginPrompt()

  const allFilled = Object.values(ratings).every(v => v > 0)
  const filledCount = Object.values(ratings).filter(v => v > 0).length

  const handleSubmit = async () => {
    if (!allFilled) return
    setSubmitting(true)

    const submitRatingRequest = () => fetch('/api/challenges/submissions/ratings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ submissionId, ...ratings }),
    })
    let res = await submitRatingRequest()
    let errorPayload = await getApiErrorPayload(res)
    if (!res.ok && isAgeConfirmationRequired(errorPayload)) {
      res = await runAfterAgeConfirmation(submitRatingRequest, {
        redirectTo: getInteractionAccessRedirect(errorPayload) ?? undefined,
      })
      errorPayload = await getApiErrorPayload(res)
    }

    setSubmitting(false)

    if (res.ok) {
      toast({ title: '评分已提交' })
      onRated?.()
    } else {
      toast({
        title: '评分失败',
        description: getApiErrorMessageFromPayload(errorPayload, '请稍后重试'),
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[11px] text-muted-foreground">4 个维度</div>
        <div className="rounded-full bg-background/72 px-2.5 py-1 text-[10px] text-muted-foreground">
          {filledCount}/4 完成
        </div>
      </div>

      {DIMENSIONS.map(dim => {
        const current = hovering[dim.key] || ratings[dim.key]
        return (
          <div key={dim.key} className="rounded-md bg-background/72 p-2.5 sm:p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[13px] font-semibold">{dim.label}</div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">{dim.hint}</div>
              </div>
              <div className="shrink-0 rounded-full bg-background/84 px-2 py-0.5 text-[10px] text-muted-foreground">
                {ratings[dim.key] > 0 ? `${ratings[dim.key]}/5 ${SCORE_LABEL[ratings[dim.key]]}` : '未评分'}
              </div>
            </div>

            <div className="mt-2.5 flex gap-1">
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
                  type="button"
                  disabled={disabled}
                  className={cn(
                    'inline-flex h-8 w-8 items-center justify-center rounded-full transition-all sm:h-8.5 sm:w-8.5',
                    disabled ? 'cursor-default opacity-70' : 'hover:-translate-y-0.5 hover:bg-background',
                    star <= current
                      ? 'bg-yellow-50 text-yellow-500 dark:bg-yellow-950/20'
                      : 'bg-background/78 text-muted-foreground'
                  )}
                  onMouseEnter={() => !disabled && setHovering(h => ({ ...h, [dim.key]: star }))}
                  onMouseLeave={() => !disabled && setHovering(h => ({ ...h, [dim.key]: 0 }))}
                  onClick={() => !disabled && setRatings(r => ({ ...r, [dim.key]: star }))}
                >
                  <Star
                    className={cn(
                      'h-4.5 w-4.5 transition-colors',
                      star <= current ? 'fill-current' : ''
                    )}
                  />
                </button>
              ))}
            </div>
          </div>
        )
      })}

      {!disabled && (
        <div className="flex items-center justify-between gap-3 pt-0.5">
          <p className="text-[11px] text-muted-foreground">完成后提交</p>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!allFilled || submitting}
            className="h-8.5 rounded-full border-0 px-4"
          >
            {submitting ? '提交中...' : initialRating ? '更新评分' : '提交评分'}
          </Button>
        </div>
      )}
    </div>
  )
}

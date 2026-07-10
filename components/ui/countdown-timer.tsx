'use client'

import { useEffect, useState } from 'react'
import { Clock } from 'lucide-react'

interface CountdownTimerProps {
  endDate: Date | string
  compact?: boolean
  className?: string
}

interface TimeRemaining {
  days: number
  hours: number
  minutes: number
  seconds: number
}

/**
 * 倒计时组件
 * 显示距离结束日期的剩余时间
 * @param endDate - 结束日期(Date对象或ISO字符串)
 * @param compact - 是否为紧凑模式(仅显示天数)
 * @param className - 额外的CSS类名
 */
export function CountdownTimer({ endDate, compact = false, className = '' }: CountdownTimerProps) {
  const [timeRemaining, setTimeRemaining] = useState<TimeRemaining | null>(null)

  useEffect(() => {
    const calculateTimeRemaining = (): TimeRemaining | null => {
      const end = new Date(endDate).getTime()
      const now = new Date().getTime()
      const distance = end - now

      if (distance < 0) {
        return null
      }

      return {
        days: Math.floor(distance / (1000 * 60 * 60 * 24)),
        hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((distance % (1000 * 60)) / 1000),
      }
    }

    // 初始计算
    setTimeRemaining(calculateTimeRemaining())

    // 每秒更新
    const timer = setInterval(() => {
      setTimeRemaining(calculateTimeRemaining())
    }, 1000)

    return () => clearInterval(timer)
  }, [endDate])

  if (!timeRemaining) {
    return (
      <div className={`text-red-500 font-semibold ${className}`}>
        挑战已结束
      </div>
    )
  }

  if (compact) {
    return (
      <div className={`flex items-center gap-1 ${className}`}>
        <Clock className="h-3 w-3" />
        <span>还剩 {timeRemaining.days} 天</span>
      </div>
    )
  }

  return (
    <div className={`flex gap-2 ${className}`}>
      <TimeUnit value={timeRemaining.days} label="天" />
      <TimeUnit value={timeRemaining.hours} label="时" />
      <TimeUnit value={timeRemaining.minutes} label="分" />
      <TimeUnit value={timeRemaining.seconds} label="秒" />
    </div>
  )
}

function TimeUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="bg-primary text-primary-foreground rounded-xs px-3 py-2 text-xl font-bold min-w-12 text-center shadow-md">
        {String(value).padStart(2, '0')}
      </div>
      <div className="text-xs text-muted-foreground mt-1 font-medium">{label}</div>
    </div>
  )
}

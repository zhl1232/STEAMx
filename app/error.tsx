"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { AlertTriangle } from "lucide-react"
import { logger } from '@/lib/logger'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    logger.error(error)
  }, [error])

  return (
    <div className="flex min-h-[600px] flex-col items-center justify-center space-y-4 text-center p-8">
      <div className="rounded-full bg-destructive/10 p-6">
        <AlertTriangle className="h-12 w-12 text-destructive" />
      </div>
      <h2 className="text-3xl font-bold tracking-tight">哎呀，出错了！</h2>
      <p className="text-muted-foreground max-w-[500px] text-lg">
        我们在加载这个页面时遇到了一些问题。
      </p>
      <div className="flex gap-4 mt-6">
        <Button variant="outline" size="lg" onClick={() => window.location.href = '/'}>
          返回首页
        </Button>
        <Button size="lg" onClick={() => reset()}>
          重试
        </Button>
      </div>
    </div>
  )
}

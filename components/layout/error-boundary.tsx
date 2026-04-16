"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { AlertTriangle, Home, RefreshCw } from "lucide-react"
import Link from "next/link"
import { logger } from '@/lib/logger'

interface ErrorBoundaryProps {
  children: React.ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
  errorCount: number
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, errorCount: 0 }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error('Uncaught error', { error, errorInfo })
    // 可以在这里添加错误日志服务，比如 Sentry
  }

  handleRetry = () => {
    this.setState((prevState) => ({
      hasError: false,
      errorCount: prevState.errorCount + 1
    }))
  }

  render() {
    if (this.state.hasError) {
      const showTechnicalDetails = process.env.NODE_ENV === 'development' && this.state.error

      return (
        <div className="flex min-h-[500px] flex-col items-center justify-center space-y-6 text-center p-8">
          <div className="rounded-full bg-destructive/10 p-6 animate-pulse">
            <AlertTriangle className="h-16 w-16 text-destructive" />
          </div>

          <div className="space-y-2 max-w-md">
            <h2 className="text-3xl font-bold tracking-tight">哎呀！出错了</h2>
            <p className="text-muted-foreground text-lg">
              抱歉，应用遇到了一些问题。别担心，这不是你的错！
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              variant="default"
              size="lg"
              onClick={this.handleRetry}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              重试
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => window.location.reload()}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              刷新页面
            </Button>
            <Link href="/">
              <Button variant="ghost" size="lg" className="gap-2">
                <Home className="h-4 w-4" />
                返回首页
              </Button>
            </Link>
          </div>

          {this.state.errorCount > 2 && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 max-w-md">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                💡 提示：如果问题持续出现，请尝试清除浏览器缓存或联系技术支持。
              </p>
            </div>
          )}

          {showTechnicalDetails && (
            <details className="mt-6 max-w-2xl w-full">
              <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground mb-2">
                查看技术细节（开发模式）
              </summary>
              <pre className="overflow-auto rounded-lg bg-muted p-4 text-left text-xs border">
                <code>{this.state.error?.stack || this.state.error?.toString() || '未知错误'}</code>
              </pre>
            </details>
          )}
        </div>
      )
    }

    return this.props.children
  }
}

/**
 * 日志和错误监控工具
 * 可以与 Sentry 或其他监控服务集成
 */

type LogLevel = 'info' | 'warn' | 'error'
type LogContext = Record<string, any>

class Logger {
    private isDevelopment = process.env.NODE_ENV === 'development'

    /**
     * 记录信息日志
     */
    info(message: string, context?: LogContext) {
        if (this.isDevelopment) {
            console.info(`[INFO] ${message}`, context || '')
        }

        // 生产环境可以发送到监控服务
        this.sendToMonitoring('info', message, context)
    }

    /**
     * 记录警告日志
     */
    warn(message: string, context?: LogContext) {
        if (this.isDevelopment) {
            console.warn(`[WARN] ${message}`, context || '')
        }

        this.sendToMonitoring('warn', message, context)
    }

    /**
     * 记录错误日志
     */
    error(error: Error | string, context?: LogContext) {
        const errorMessage = error instanceof Error ? error.message : error
        const errorStack = error instanceof Error ? error.stack : undefined

        if (this.isDevelopment) {
            console.error(`[ERROR] ${errorMessage}`, { ...context, stack: errorStack })
        }

        this.sendToMonitoring('error', errorMessage, {
            ...context,
            stack: errorStack,
        })

        // 如果集成了 Sentry
        if (typeof window !== 'undefined' && (window as any).Sentry) {
            if (error instanceof Error) {
                (window as any).Sentry.captureException(error, { extra: context })
            } else {
                (window as any).Sentry.captureMessage(error, {
                    level: 'error',
                    extra: context,
                })
            }
        }
    }

    /**
     * 设置用户上下文(用于错误追踪)
     */
    setUser(userId: string, email?: string, username?: string) {
        if (typeof window !== 'undefined' && (window as any).Sentry) {
            (window as any).Sentry.setUser({ id: userId, email, username })
        }
    }

    /**
     * 清除用户上下文
     */
    clearUser() {
        if (typeof window !== 'undefined' && (window as any).Sentry) {
            (window as any).Sentry.setUser(null)
        }
    }

    /**
     * 发送到监控服务(预留接口)
     */
    private sendToMonitoring(_level: LogLevel, _message: string, _context?: LogContext) {
        // 这里可以集成其他监控服务
        // 例如: Google Analytics, 自定义API等

        // 示例: 发送到自定义 API
        if (!this.isDevelopment && typeof window !== 'undefined') {
            // fetch('/api/logs', {
            //   method: 'POST',
            //   headers: { 'Content-Type': 'application/json' },
            //   body: JSON.stringify({ level: _level, message: _message, context: _context, timestamp: new Date().toISOString() })
            // }).catch(console.error)
        }
    }
}

export const logger = new Logger()

/**
 * 日志和错误监控工具
 * 可以与 Sentry 或其他监控服务集成
 */

type LogLevel = 'info' | 'warn' | 'error'
type LogContext = Record<string, unknown>

function normalizeError(error: unknown): { message: string; stack?: string; details?: Record<string, unknown> } {
    if (error instanceof Error) {
        return {
            message: error.message,
            stack: error.stack,
        }
    }

    if (error && typeof error === 'object') {
        const candidate = error as Record<string, unknown>
        const messageParts = [
            typeof candidate.message === 'string' ? candidate.message : '',
            typeof candidate.details === 'string' ? candidate.details : '',
            typeof candidate.hint === 'string' ? candidate.hint : '',
        ].filter(Boolean)

        return {
            message: messageParts.join(' | ') || JSON.stringify(candidate),
            stack: typeof candidate.stack === 'string' ? candidate.stack : undefined,
            details: candidate,
        }
    }

    return {
        message: String(error),
    }
}

class Logger {
    private isDevelopment = process.env.NODE_ENV === 'development'

    /**
     * 记录信息日志
     */
    info(message: string, context?: LogContext) {
        if (this.isDevelopment) {
            console.info(`[INFO] ${message}`, context || '')
        }

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
    error(error: unknown, context?: LogContext) {
        const normalized = normalizeError(error)
        const errorMessage = normalized.message
        const errorStack = normalized.stack

        console.error(`[ERROR] ${errorMessage}`, {
            ...context,
            ...(normalized.details ? { error: normalized.details } : {}),
            stack: errorStack,
        })

        this.sendToMonitoring('error', errorMessage, {
            ...context,
            ...(normalized.details ? { error: normalized.details } : {}),
            stack: errorStack,
        })

        // 如果集成了 Sentry
        if (typeof window !== 'undefined' && (window as unknown as { Sentry?: { captureException: (e: Error, o?: object) => void; captureMessage: (m: string, o?: object) => void } }).Sentry) {
            const Sentry = (window as unknown as { Sentry: { captureException: (e: Error, o?: object) => void; captureMessage: (m: string, o?: object) => void } }).Sentry
            if (error instanceof Error) {
                Sentry.captureException(error, { extra: context })
            } else {
                Sentry.captureMessage(errorMessage, { level: 'error', extra: context } as { level: string; extra: LogContext })
            }
        }
    }

    /**
     * 设置用户上下文(用于错误追踪)
     */
    setUser(userId: string, email?: string, username?: string) {
        const w = window as Window & { Sentry?: { setUser: (u: object | null) => void } }
        if (typeof window !== 'undefined' && w.Sentry) {
            w.Sentry.setUser({ id: userId, email, username })
        }
    }

    /**
     * 清除用户上下文
     */
    clearUser() {
        const w = window as Window & { Sentry?: { setUser: (u: null) => void } }
        if (typeof window !== 'undefined' && w.Sentry) {
            w.Sentry.setUser(null)
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

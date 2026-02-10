'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Rocket, Database, CheckCircle2, XCircle, Loader2 } from 'lucide-react'

type MigrateType = 'projects' | 'discussions' | 'challenges' | 'all'

interface MigrationResult {
  success: number
  failed: number
  errors: string[]
}

interface MigrationResponse {
  success: boolean
  results: {
    projects: MigrationResult
    discussions: MigrationResult
    challenges: MigrationResult
  }
  message?: string
  error?: string
}

export default function MigratePage() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<MigrationResponse | null>(null)

  const handleMigrate = async (type: MigrateType) => {
    setLoading(true)
    setResult(null)

    try {
      const response = await fetch('/api/migrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      })

      const data = await response.json()
      setResult(data)
    } catch (error: unknown) {
      setResult({
        success: false,
        results: {
          projects: { success: 0, failed: 0, errors: [] },
          discussions: { success: 0, failed: 0, errors: [] },
          challenges: { success: 0, failed: 0, errors: [] },
        },
        error: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto py-12 max-w-4xl">
      <div className="text-center mb-12">
        <div className="flex justify-center mb-4">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Database className="h-8 w-8 text-primary" />
          </div>
        </div>
        <h1 className="text-4xl font-bold mb-4">数据迁移工具</h1>
        <p className="text-muted-foreground text-lg">
          将默认数据迁移到 Supabase 数据库
        </p>
      </div>

      {/* 迁移按钮 */}
      <div className="grid gap-4 md:grid-cols-2 mb-8">
        <Button
          onClick={() => handleMigrate('projects')}
          disabled={loading}
          size="lg"
          className="h-24 flex flex-col gap-2"
        >
          {loading ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            <>
              <Rocket className="h-6 w-6" />
              <span>迁移项目数据</span>
              <span className="text-xs opacity-80">6 个示例项目</span>
            </>
          )}
        </Button>

        <Button
          onClick={() => handleMigrate('discussions')}
          disabled={loading}
          size="lg"
          variant="outline"
          className="h-24 flex flex-col gap-2"
        >
          {loading ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            <>
              💬
              <span>迁移讨论数据</span>
              <span className="text-xs opacity-80">2 个讨论帖</span>
            </>
          )}
        </Button>

        <Button
          onClick={() => handleMigrate('challenges')}
          disabled={loading}
          size="lg"
          variant="outline"
          className="h-24 flex flex-col gap-2"
        >
          {loading ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            <>
              🏆
              <span>迁移挑战数据</span>
              <span className="text-xs opacity-80">3 个挑战赛</span>
            </>
          )}
        </Button>

        <Button
          onClick={() => handleMigrate('all')}
          disabled={loading}
          size="lg"
          className="h-24 flex flex-col gap-2 bg-gradient-to-r from-primary to-secondary"
        >
          {loading ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            <>
              ⚡
              <span>一键迁移全部</span>
              <span className="text-xs opacity-80">推荐</span>
            </>
          )}
        </Button>
      </div>

      {/* 结果展示 */}
      {result && (
        <div className="space-y-4">
          {result.success ? (
            <div className="rounded-lg border bg-card p-6">
              <div className="flex items-center gap-2 text-green-600 mb-4">
                <CheckCircle2 className="h-5 w-5" />
                <h2 className="text-xl font-bold">迁移成功！</h2>
              </div>

              <div className="space-y-4">
                {/* 项目结果 */}
                {result.results.projects.success > 0 && (
                  <div className="flex items-center justify-between p-4 rounded-md bg-muted">
                    <div className="flex items-center gap-2">
                      <Rocket className="h-5 w-5 text-primary" />
                      <span className="font-medium">项目</span>
                    </div>
                    <div className="text-sm">
                      <span className="text-green-600 font-bold">
                        ✓ {result.results.projects.success}
                      </span>
                      {result.results.projects.failed > 0 && (
                        <span className="text-red-600 ml-2">
                          ✗ {result.results.projects.failed}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* 讨论结果 */}
                {result.results.discussions.success > 0 && (
                  <div className="flex items-center justify-between p-4 rounded-md bg-muted">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">💬</span>
                      <span className="font-medium">讨论</span>
                    </div>
                    <div className="text-sm">
                      <span className="text-green-600 font-bold">
                        ✓ {result.results.discussions.success}
                      </span>
                      {result.results.discussions.failed > 0 && (
                        <span className="text-red-600 ml-2">
                          ✗ {result.results.discussions.failed}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* 挑战结果 */}
                {result.results.challenges.success > 0 && (
                  <div className="flex items-center justify-between p-4 rounded-md bg-muted">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">🏆</span>
                      <span className="font-medium">挑战</span>
                    </div>
                    <div className="text-sm">
                      <span className="text-green-600 font-bold">
                        ✓ {result.results.challenges.success}
                      </span>
                      {result.results.challenges.failed > 0 && (
                        <span className="text-red-600 ml-2">
                          ✗ {result.results.challenges.failed}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-6 p-4 rounded-md bg-primary/5 border border-primary/20">
                <p className="text-sm font-medium mb-2">✅ 下一步</p>
                <ol className="text-sm space-y-1 ml-4 list-decimal text-muted-foreground">
                  <li>打开 Supabase 控制台验证数据</li>
                  <li>访问 <a href="/explore" className="underline text-primary">探索页面</a> 查看项目</li>
                  <li>访问 <a href="/community" className="underline text-primary">社区页面</a> 查看讨论和挑战</li>
                </ol>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-destructive bg-destructive/5 p-6">
              <div className="flex items-center gap-2 text-destructive mb-4">
                <XCircle className="h-5 w-5" />
                <h2 className="text-xl font-bold">迁移失败</h2>
              </div>
              <p className="text-sm text-muted-foreground">{result.error}</p>
            </div>
          )}

          {/* 错误详情 */}
          {result.success && (
            <>
              {(result.results.projects.errors.length > 0 ||
                result.results.discussions.errors.length > 0 ||
                result.results.challenges.errors.length > 0) && (
                <details className="rounded-lg border bg-card p-4">
                  <summary className="cursor-pointer font-medium text-sm text-muted-foreground">
                    查看错误详情
                  </summary>
                  <div className="mt-4 space-y-2 text-sm">
                    {result.results.projects.errors.map((error, i) => (
                      <div key={i} className="text-red-600">• {error}</div>
                    ))}
                    {result.results.discussions.errors.map((error, i) => (
                      <div key={i} className="text-red-600">• {error}</div>
                    ))}
                    {result.results.challenges.errors.map((error, i) => (
                      <div key={i} className="text-red-600">• {error}</div>
                    ))}
                  </div>
                </details>
              )}
            </>
          )}
        </div>
      )}

      {/* 提示信息 */}
      {!result && !loading && (
        <div className="rounded-lg border bg-muted/50 p-6">
          <h3 className="font-medium mb-2">📝 使用提示</h3>
          <ul className="text-sm text-muted-foreground space-y-2 ml-4 list-disc">
            <li>首次使用请点击 &quot;一键迁移全部&quot; 按钮</li>
            <li>迁移会将示例数据插入到 Supabase 数据库</li>
            <li>如果数据已存在，可能会报错（这是正常的）</li>
            <li>迁移完成后可以在 Supabase Table Editor 中查看数据</li>
          </ul>
        </div>
      )}
    </div>
  )
}

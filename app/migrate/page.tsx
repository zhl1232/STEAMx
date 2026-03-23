'use client'

import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { Database, FileText, TerminalSquare } from 'lucide-react'

export default function MigratePage() {
  return (
    <div className="container mx-auto max-w-4xl py-12">
      <div className="mb-12 text-center">
        <div className="mb-4 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Database className="h-8 w-8 text-primary" />
          </div>
        </div>
        <h1 className="mb-4 text-4xl font-bold">数据迁移工具</h1>
        <p className="text-lg text-muted-foreground">
          当前版本不再提供网页内一键迁移。请通过 CLI 或 SQL 文件完成数据库迁移与种子导入。
        </p>
      </div>

      <div className="mb-8 grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border bg-card p-6">
          <div className="mb-4 flex items-center gap-2">
            <TerminalSquare className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">推荐方式</h2>
          </div>
          <p className="mb-4 text-sm text-muted-foreground">
            使用 `pnpm db:push` 或 `supabase db push` 按顺序应用 `supabase/migrations/` 中的迁移。
          </p>
          <pre className="overflow-x-auto rounded-md bg-muted p-4 text-sm">
            <code>{`set -a && source .env.local && set +a
pnpm db:push`}</code>
          </pre>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <div className="mb-4 flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">种子数据</h2>
          </div>
          <p className="mb-4 text-sm text-muted-foreground">
            示例项目、讨论和私信已包含在迁移与 `supabase/seed.sql` 中，重复执行前请确认当前环境允许重放。
          </p>
          <pre className="overflow-x-auto rounded-md bg-muted p-4 text-sm">
            <code>{`psql -h <IP> -p 5432 -U postgres -d postgres -f supabase/seed.sql`}</code>
          </pre>
        </div>
      </div>

      <div className="space-y-4 rounded-lg border bg-card p-6">
        <h2 className="text-xl font-semibold">相关文档</h2>
        <p className="text-sm text-muted-foreground">
          迁移说明见仓库内 `docs/database-psql.md` 与 `README.md` 的数据库章节。
        </p>
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="outline">
            <Link href="/explore">查看探索页</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/community">查看社区页</Link>
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          这样可以避免网页端重复执行迁移带来的副作用，也避免生产环境暴露高权限数据初始化入口。
        </p>
      </div>
    </div>
  )
}

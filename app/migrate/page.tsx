'use client'

import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { Database, FileText, TerminalSquare } from 'lucide-react'

export default function MigratePage() {
  return (
    <div className="page-shell py-8 pb-24 md:py-10">
      <section className="surface-panel mx-auto max-w-5xl px-5 py-8 sm:px-7 sm:py-9">
        <div className="mb-10 text-center">
          <p className="section-kicker">开发工具</p>
          <div className="mt-4 flex justify-center">
            <div className="surface-subtle flex h-16 w-16 items-center justify-center rounded-full border border-border/70 bg-primary/10 shadow-none">
              <Database className="h-8 w-8 text-primary" />
            </div>
          </div>
          <h1 className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">数据迁移工具</h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
            当前版本不再提供网页内一键迁移。请通过 CLI 或 SQL 文件完成数据库迁移与种子导入。
          </p>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-2">
          <div className="surface-subtle rounded-[var(--radius-lg)] border border-border/70 p-6 shadow-none">
            <div className="mb-4 flex items-center gap-2">
              <TerminalSquare className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">推荐方式</h2>
            </div>
            <p className="mb-4 text-sm leading-6 text-muted-foreground">
              使用 `pnpm db:push` 或 `supabase db push` 按顺序应用 `supabase/migrations/` 中的迁移。
            </p>
            <pre className="overflow-x-auto rounded-md border border-border/70 bg-muted/50 p-4 text-sm">
              <code>{`set -a && source .env.local && set +a
pnpm db:push`}</code>
            </pre>
          </div>

          <div className="surface-subtle rounded-[var(--radius-lg)] border border-border/70 p-6 shadow-none">
            <div className="mb-4 flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">种子数据</h2>
            </div>
            <p className="mb-4 text-sm leading-6 text-muted-foreground">
              示例项目、讨论和私信已包含在迁移与 `supabase/seed.sql` 中，重复执行前请确认当前环境允许重放。
            </p>
            <pre className="overflow-x-auto rounded-md border border-border/70 bg-muted/50 p-4 text-sm">
              <code>{`psql -h <IP> -p 5432 -U postgres -d postgres -f supabase/seed.sql`}</code>
            </pre>
          </div>
        </div>

        <div className="surface-subtle space-y-4 rounded-[var(--radius-lg)] border border-border/70 p-6 shadow-none">
          <h2 className="text-xl font-semibold">相关文档</h2>
          <p className="text-sm leading-6 text-muted-foreground">
            迁移说明见仓库内 `docs/database-psql.md` 与 `README.md` 的数据库章节。
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline">
              <Link href="/explore">查看探索页</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/create">查看创造营</Link>
            </Button>
          </div>
          <p className="text-sm leading-6 text-muted-foreground">
            这样可以避免网页端重复执行迁移带来的副作用，也避免生产环境暴露高权限数据初始化入口。
          </p>
        </div>
      </section>
    </div>
  )
}

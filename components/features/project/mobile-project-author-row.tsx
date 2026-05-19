import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

import { OptimizedImage } from '@/components/ui/optimized-image'
import { formatCount } from '@/lib/project/format-count'
import type { ProjectCompletion } from '@/lib/mappers/types'
import { cn } from '@/lib/utils'

export interface MobileProjectAuthorRowAuthor {
  id: string
  name: string
  avatarUrl?: string | null
  level: number
}

interface MobileProjectAuthorRowProps {
  author: MobileProjectAuthorRowAuthor | null
  projectId: string | number
  completionCount: number
  completions: ProjectCompletion[]
}

export function MobileProjectAuthorRow({
  author,
  projectId,
  completionCount,
  completions,
}: MobileProjectAuthorRowProps) {
  if (!author) return null

  const recordsHref = `/project/${projectId}/records`
  const explorerAvatars = completions.slice(0, 3)

  return (
    <section className="flex items-center justify-between gap-3 border-t border-[hsl(var(--surface-border)/0.72)] pt-4">
      <Link href={`/users/${author.id}`} className="flex min-w-0 items-center gap-3">
        <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-[hsl(var(--brand-green)/0.12)] ring-2 ring-white dark:ring-slate-900">
          {author.avatarUrl ? (
            <OptimizedImage
              src={author.avatarUrl}
              alt={author.name}
              fill
              variant="avatar"
              className="object-cover"
            />
          ) : (
            <div className="grid h-full w-full place-items-center text-base font-bold text-[hsl(var(--brand-green))]">
              {author.name[0] || '作'}
            </div>
          )}
        </div>
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <p className="truncate text-sm font-bold text-foreground">{author.name}</p>
            <span className="shrink-0 rounded-full bg-[hsl(var(--tone-tech-soft))] px-2 py-0.5 text-[10px] font-bold text-[hsl(var(--tone-tech))]">
              LV{author.level}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">项目创建者</p>
        </div>
      </Link>

      <Link
        href={recordsHref}
        className="flex shrink-0 items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
        aria-label={`${formatCount(completionCount)} 人探索过，查看探索记录`}
      >
        <div className="text-right">
          <p className="text-xs font-semibold text-foreground">
            {formatCount(completionCount)} 人探索过
          </p>
          {explorerAvatars.length > 0 ? (
            <div className="mt-1 flex justify-end -space-x-2">
              {explorerAvatars.map((completion) => (
                <div
                  key={completion.id}
                  className={cn(
                    'relative h-6 w-6 overflow-hidden rounded-full ring-2 ring-[hsl(var(--surface-raised))] bg-muted',
                  )}
                >
                  {completion.avatar ? (
                    <OptimizedImage
                      src={completion.avatar}
                      alt={completion.author}
                      fill
                      variant="avatar"
                      className="object-cover"
                    />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-[9px] font-bold text-muted-foreground">
                      {completion.author[0] || '?'}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : null}
        </div>
        <ChevronRight className="h-4 w-4 shrink-0" />
      </Link>
    </section>
  )
}

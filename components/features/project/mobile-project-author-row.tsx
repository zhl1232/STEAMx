import Link from 'next/link'

import { UserAvatar } from '@/components/ui/user-avatar'

export interface MobileProjectAuthorRowAuthor {
  id: string
  name: string
  avatarUrl?: string | null
  avatarFrameId?: string | null
  level: number
}

interface MobileProjectAuthorRowProps {
  author: MobileProjectAuthorRowAuthor | null
}

export function MobileProjectAuthorRow({
  author,
}: MobileProjectAuthorRowProps) {
  if (!author) return null

  return (
    <section className="flex items-center justify-between gap-3 border-t border-[hsl(var(--surface-border)/0.72)] pt-4">
      <Link href={`/users/${author.id}`} className="flex min-h-11 min-w-0 items-center gap-3">
        <UserAvatar
          userId={author.id}
          name={author.name}
          src={author.avatarUrl}
          avatarFrameId={author.avatarFrameId}
          href={null}
          className="h-11 w-11 bg-[hsl(var(--brand-green)/0.12)] ring-2 ring-white dark:ring-slate-900"
        />
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

    </section>
  )
}

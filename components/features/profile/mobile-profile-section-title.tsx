import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

export function MobileProfileSectionTitle({
  title,
  actionHref,
  actionLabel,
  trailing,
}: {
  title: string
  actionHref?: string
  actionLabel?: string
  trailing?: string
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="truncate text-base font-semibold text-foreground">{title}</h2>
      {actionHref && actionLabel ? (
        <Link
          href={actionHref}
          className="inline-flex min-h-11 shrink-0 items-center gap-0.5 text-xs font-semibold text-muted-foreground transition hover:text-[hsl(var(--brand-blue))]"
        >
          {actionLabel}
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      ) : trailing ? (
        <span className="inline-flex min-h-11 shrink-0 items-center gap-0.5 text-xs font-semibold text-muted-foreground">
          {trailing}
          <ChevronRight className="h-3.5 w-3.5" />
        </span>
      ) : null}
    </div>
  )
}

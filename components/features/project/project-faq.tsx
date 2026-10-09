import type { ProjectFaqItem } from '@/lib/mappers/types'

export function ProjectFaq({ items, projectId }: { items: ProjectFaqItem[]; projectId: string | number }) {
  if (Number(projectId) === 149) {
    return <div className="divide-y divide-border/60">
      {items.map(item => <details key={item.question} className="py-3 first:pt-0 last:pb-0">
        <summary className="cursor-pointer text-sm font-semibold leading-6 text-foreground">{item.question}</summary>
        <p className="mt-2 text-sm leading-6 text-foreground/85 wrap-anywhere">{item.answer}</p>
      </details>)}
    </div>
  }
  return (
    <div className="space-y-4">
      <dl className="space-y-5">
        {items.map(item => (
          <div key={item.question}>
            <dt className="text-sm font-semibold leading-6 text-foreground">{item.question}</dt>
            <dd className="mt-1 text-sm leading-6 text-foreground/85 wrap-anywhere">{item.answer}</dd>
          </div>
        ))}
      </dl>

    </div>
  )
}
